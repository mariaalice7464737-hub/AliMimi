"""Cardápio "Cozinha de Casa": pratos, categorias e receitas.

Os dados ficam em app/dados/*.json e as fotos em app/static/img/<id>.jpg.
Tudo é carregado uma vez na inicialização; o cardápio não muda em tempo de execução.
"""
import json
from functools import lru_cache
from pathlib import Path

DADOS = Path(__file__).parent / "dados"

# Ordem em que as categorias aparecem no app
ORDEM = ["carne", "frango", "massa", "peixe", "suina"]
# "Massas" é uma categoria montada a partir de pratos que já existem em outras
MASSAS = ["carne12", "carne10", "frango13", "frango14"]
# Capas próprias das categorias (static/img/categorias/<id>.jpg, do catálogo editorial).
# Categoria sem capa própria usa a foto de um prato: CAPAS_PRATO, ou o primeiro prato.
CAPAS_PRATO = {"massa": "carne12"}
PASTA_CAPAS = Path(__file__).parent / "static" / "img" / "categorias"


def _img(prato_id: str) -> str:
    return f"/img/{prato_id}.jpg"


def _capa(cat: dict) -> str:
    if (PASTA_CAPAS / f"{cat['id']}.jpg").exists():
        return f"/img/categorias/{cat['id']}.jpg"
    return _img(CAPAS_PRATO.get(cat["id"], cat["pratos"][0]))


@lru_cache
def carregar() -> dict:
    brutos = json.loads((DADOS / "pratos.json").read_text(encoding="utf-8"))
    receitas = json.loads((DADOS / "receitas.json").read_text(encoding="utf-8"))

    pratos: dict[str, dict] = {}
    categorias: list[dict] = []
    for cat in brutos:
        ids = []
        for p in cat["pratos"]:
            pratos[p["id"]] = {**p, "img": _img(p["id"]), "categoria": cat["id"]}
            ids.append(p["id"])
        categorias.append({"id": cat["id"], "nome": cat["nome"], "pratos": ids})

    massas = [i for i in MASSAS if i in pratos]
    if massas:
        categorias.append({"id": "massa", "nome": "Massas", "pratos": massas})

    categorias.sort(key=lambda c: ORDEM.index(c["id"]) if c["id"] in ORDEM else len(ORDEM))
    for c in categorias:
        c["capa"] = _capa(c)

    return {"categorias": categorias, "pratos": pratos, "receitas": receitas}


def existe_prato(prato_id: str) -> bool:
    return prato_id in carregar()["pratos"]


def total_ingredientes(prato_id: str) -> int:
    r = carregar()["receitas"].get(prato_id)
    return len(r["ingredientes"]) if r else 0
