"""API do AliMimi — Almoço da Semana.

  GET    /api/cardapio                         categorias, pratos e receitas
  POST   /api/familias                         cria uma família (devolve o código)
  GET    /api/familias/{codigo}                semana da família
  PUT    /api/familias/{codigo}/dias/{dia}     escolhe o prato ou pula o dia (0 = segunda)
  DELETE /api/familias/{codigo}/dias/{dia}     volta o dia para "sem prato"
  PUT    /api/familias/{codigo}/compras/{dia}  ingredientes já no carrinho
  PUT    /api/familias/{codigo}/semana         substitui a semana inteira (Recomeçar / Desfazer)

Em produção o mesmo servidor entrega o front já compilado (frontend/dist).
"""
import os
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, HTTPException, Path as P
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, model_validator

from . import cardapio
from .db import Banco

AQUI = Path(__file__).parent
DIA = P(ge=0, le=6, description="0 = segunda … 6 = domingo")


class Dia(BaseModel):
    prato_id: str | None = None
    pulado: bool = False

    @model_validator(mode="after")
    def um_ou_outro(self):
        if self.pulado == bool(self.prato_id):
            raise ValueError("envie prato_id OU pulado=true")
        if self.prato_id and not cardapio.existe_prato(self.prato_id):
            raise ValueError(f"prato desconhecido: {self.prato_id}")
        return self


class Compras(BaseModel):
    itens: list[int]


class Semana(BaseModel):
    dias: dict[int, Dia] = {}
    compras: dict[int, list[int]] = {}

    @model_validator(mode="after")
    def coerente(self):
        for d in list(self.dias) + list(self.compras):
            if not 0 <= d <= 6:
                raise ValueError(f"dia inválido: {d}")
        for d, itens in self.compras.items():
            dia = self.dias.get(d)
            if not dia or not dia.prato_id:
                raise ValueError(f"compras no dia {d}, que não tem prato")
            _checar_itens(dia.prato_id, itens)
        return self


def _checar_itens(prato_id: str, itens: list[int]):
    total = cardapio.total_ingredientes(prato_id)
    if any(not 0 <= i < total for i in itens):
        raise ValueError(f"ingrediente fora da lista (0 a {total - 1})")


def criar_app(caminho_db: str | None = None, pasta_front: str | None = None) -> FastAPI:
    # Postgres se houver DATABASE_URL (produção); senão, arquivo SQLite local
    banco = Banco(caminho_db or os.environ.get("DATABASE_URL") or os.environ.get("ALIMIMI_DB", str(AQUI.parent / "alimimi.db")))

    @asynccontextmanager
    async def ciclo(app):
        yield
        banco.fechar()

    app = FastAPI(title="AliMimi — Almoço da Semana", version="1.1", lifespan=ciclo)

    def familia(codigo: str) -> str:
        codigo = codigo.strip().upper()
        if not banco.existe(codigo):
            raise HTTPException(404, "Família não encontrada. Confira o código.")
        return codigo

    @app.get("/api/saude")
    def saude():
        return {"ok": True}

    @app.get("/api/cardapio")
    def get_cardapio():
        return cardapio.carregar()

    @app.post("/api/familias", status_code=201)
    def criar_familia():
        return banco.semana(banco.criar_familia())

    @app.get("/api/familias/{codigo}")
    def get_semana(codigo: str):
        return banco.semana(familia(codigo))

    @app.put("/api/familias/{codigo}/dias/{dia}")
    def put_dia(codigo: str, corpo: Dia, dia: int = DIA):
        c = familia(codigo)
        banco.definir_dia(c, dia, corpo.prato_id, corpo.pulado)
        return banco.semana(c)

    @app.delete("/api/familias/{codigo}/dias/{dia}")
    def delete_dia(codigo: str, dia: int = DIA):
        c = familia(codigo)
        banco.limpar_dia(c, dia)
        return banco.semana(c)

    @app.put("/api/familias/{codigo}/compras/{dia}")
    def put_compras(codigo: str, corpo: Compras, dia: int = DIA):
        c = familia(codigo)
        prato = banco.prato_do_dia(c, dia)
        if not prato:
            raise HTTPException(409, "Esse dia não tem prato escolhido.")
        try:
            _checar_itens(prato, corpo.itens)
        except ValueError as e:
            raise HTTPException(422, str(e))
        banco.definir_compras(c, dia, corpo.itens)
        return banco.semana(c)

    @app.put("/api/familias/{codigo}/semana")
    def put_semana(codigo: str, corpo: Semana):
        c = familia(codigo)
        dias = {str(d): v.model_dump(exclude_none=True, exclude_defaults=True) or {"pulado": True} for d, v in corpo.dias.items()}
        banco.substituir_semana(c, dias, {str(d): i for d, i in corpo.compras.items()})
        return banco.semana(c)

    # Fotos dos pratos
    app.mount("/img", StaticFiles(directory=AQUI / "static" / "img"), name="img")

    # Front compilado (npm run build) — qualquer rota que não seja /api cai no index.html
    dist = Path(pasta_front or os.environ.get("ALIMIMI_FRONT", AQUI.parent.parent / "frontend" / "dist"))
    if (dist / "index.html").exists():
        app.mount("/assets", StaticFiles(directory=dist / "assets"), name="assets")

        @app.get("/{caminho:path}", include_in_schema=False)
        def spa(caminho: str):
            if caminho.startswith("api/"):
                raise HTTPException(404)
            arquivo = dist / caminho
            if caminho and arquivo.is_file() and dist in arquivo.resolve().parents:
                return FileResponse(arquivo)
            return FileResponse(dist / "index.html")

    return app


app = criar_app()
