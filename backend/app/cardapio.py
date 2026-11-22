"""Cardápio "Cozinha de Casa": pratos principais (proteínas), acompanhamentos e receitas.

Os dados ficam em app/dados/*.json e as fotos em app/static/img/<id>.jpg.
Tudo é carregado uma vez na inicialização; o cardápio não muda em tempo de execução.

Pratos principais (pratos.json + receitas.json): uma proteína por dia.
Acompanhamentos (acompanhamentos.json): zero ou mais por dia, em três grupos.
Um acompanhamento só entra no app se a receita estiver COMPLETA (ingredientes,
preparo e lista de compras válidos) — receita incompleta nunca gera lista de compras.
"""
import json
import logging
import os
from functools import lru_cache
from pathlib import Path

DADOS = Path(__file__).parent / "dados"
FOTOS = Path(__file__).parent / "static" / "img"
log = logging.getLogger("alimimi.cardapio")

# Ordem em que as categorias aparecem no app
ORDEM = ["carne", "frango", "massa", "peixe", "suina"]
# "Massas" é uma categoria montada a partir de pratos que já existem em outras
MASSAS = ["carne12", "carne10", "frango13", "frango14"]
# Foto de capa de cada categoria (padrão: o primeiro prato)
CAPAS = {"frango": "frango12"}

# Grupos de acompanhamento, na ordem da tela "O que vai acompanhar?"
GRUPOS = [("acompanhamentos", "Acompanhamentos"), ("leguminosas", "Leguminosas e vegetais"), ("saladas", "Saladas")]
# Seções da lista de compras (as mesmas do front); item fora delas sumiria da lista
SECOES = ["Açougue", "Peixaria", "Hortifrúti", "Frios e laticínios", "Mercearia", "Temperos"]


def _img(prato_id: str) -> str:
    return f"/img/{prato_id}.jpg"


def problemas_receita(r) -> list[str]:
    """Vazio se a receita estiver completa o bastante para entrar na lista de compras."""
    p = []
    if not isinstance(r, dict):
        return ["receita ausente"]
    if not isinstance(r.get("tempo"), str) or not r["tempo"].strip():
        p.append("sem tempo de preparo")
    if not isinstance(r.get("porcoes"), int) or r["porcoes"] <= 0:
        p.append("sem porções")
    for campo in ("ingredientes", "preparo"):
        v = r.get(campo)
        if not isinstance(v, list) or not v or not all(isinstance(x, str) and x.strip() for x in v):
            p.append(f"sem {campo}")
    compras = r.get("compras")
    if not isinstance(compras, list) or not compras:
        p.append("sem lista de compras")
    else:
        for x in compras:
            if not isinstance(x, dict) or not isinstance(x.get("nome"), str) or not x["nome"].strip():
                p.append("item de compra sem nome"); break
            if x.get("secao") not in SECOES:
                p.append(f"seção inválida em '{x.get('nome')}'"); break
            q, u = x.get("qtd"), x.get("unidade")
            if q is not None and (not isinstance(q, (int, float)) or q <= 0 or not isinstance(u, str) or not u):
                p.append(f"quantidade/unidade inválida em '{x['nome']}'"); break
    return p


def _acompanhamentos(arquivo: Path, ids_existentes: set) -> tuple[dict, dict]:
    """Lê o catálogo de acompanhamentos e devolve (bloco para a API, receitas válidas)."""
    grupos = {g: {"id": g, "nome": nome, "itens": []} for g, nome in GRUPOS}
    itens, receitas = {}, {}
    pendentes = 0
    if arquivo.exists():
        dados = json.loads(arquivo.read_text(encoding="utf-8"))
        for g in dados.get("grupos", []):
            if g.get("id") not in grupos:
                log.warning("grupo de acompanhamento desconhecido: %s", g.get("id")); continue
            for it in g.get("itens", []):
                iid = it.get("id")
                prob = problemas_receita(it.get("receita"))
                if not iid or iid in ids_existentes or iid in itens:
                    prob.append("id ausente ou repetido")
                if not it.get("nome"):
                    prob.append("sem nome")
                if prob:  # receita incompleta: fica fora do app (não gera lista errada)
                    pendentes += 1
                    log.warning("acompanhamento '%s' fora do app: %s", iid, "; ".join(prob)); continue
                foto = FOTOS / f"{iid}.jpg"
                itens[iid] = {"id": iid, "nome": it["nome"], "descricao": it.get("descricao", ""),
                              "img": _img(iid) if foto.exists() else None, "grupo": g["id"]}
                receitas[iid] = it["receita"]
                grupos[g["id"]]["itens"].append(iid)
    return {"grupos": list(grupos.values()), "itens": itens, "pendentes": pendentes}, receitas


@lru_cache
def carregar(arquivo_acompanhamentos: str | None = None) -> dict:
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
        c["capa"] = _img(CAPAS.get(c["id"], c["pratos"][0]))

    arquivo = Path(arquivo_acompanhamentos or os.environ.get("ALIMIMI_ACOMPANHAMENTOS") or DADOS / "acompanhamentos.json")
    acomp, receitas_acomp = _acompanhamentos(arquivo, set(pratos))
    # receitas dos acompanhamentos ficam no mesmo mapa (ids não colidem com os pratos)
    return {"categorias": categorias, "pratos": pratos, "receitas": {**receitas, **receitas_acomp}, "acompanhamentos": acomp}


def existe_prato(prato_id: str) -> bool:
    """Só pratos principais: um acompanhamento nunca vira proteína do dia."""
    return prato_id in carregar()["pratos"]


def total_ingredientes(prato_id: str) -> int:
    r = carregar()["receitas"].get(prato_id)
    return len(r["ingredientes"]) if r else 0
