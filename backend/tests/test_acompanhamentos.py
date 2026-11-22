"""PR 1 — estrutura de refeições (uma proteína + acompanhamentos) e compatibilidade.

Usa um catálogo FICTÍCIO (tests/dados/acompanhamentos_teste.json); produção começa vazia.
"""
import json
import os
import sqlite3
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app import cardapio
from app.db import Banco
from app.main import criar_app

CATALOGO_TESTE = str(Path(__file__).parent / "dados" / "acompanhamentos_teste.json")
PG = os.environ.get("TEST_DATABASE_URL")
BANCOS = ["sqlite"] + (["postgres"] if PG else [])


@pytest.fixture(params=BANCOS)
def api(request, tmp_path):
    if request.param == "postgres":
        import psycopg
        with psycopg.connect(PG, autocommit=True) as c:
            c.execute("DROP TABLE IF EXISTS acompanhamentos, compras, dias, familias")
        endereco = PG
    else:
        endereco = str(tmp_path / "teste.db")
    with TestClient(criar_app(endereco, pasta_front=str(tmp_path / "x"), acompanhamentos=CATALOGO_TESTE)) as c:
        yield c


@pytest.fixture
def fam(api):
    return api.post("/api/familias").json()["codigo"]


def put(api, fam, dia, **corpo):
    return api.put(f"/api/familias/{fam}/dias/{dia}", json=corpo)


def acomp(api, fam, dia, itens):
    return api.put(f"/api/familias/{fam}/dias/{dia}/acompanhamentos", json={"itens": itens})


# ---------- catálogo ----------
def test_catalogo_de_producao_comeca_vazio():
    c = cardapio.carregar()
    assert c["acompanhamentos"]["itens"] == {}
    assert [g["id"] for g in c["acompanhamentos"]["grupos"]] == ["acompanhamentos", "leguminosas", "saladas"]
    assert len(c["pratos"]) == 47 and len(c["receitas"]) == 47


def test_catalogo_de_teste_e_receita_incompleta_fica_fora(api):
    c = api.get("/api/cardapio").json()
    a = c["acompanhamentos"]
    assert {g["id"]: g["itens"] for g in a["grupos"]} == {
        "acompanhamentos": ["t_arroz", "t_pure"], "leguminosas": ["t_feijao", "t_baiao"], "saladas": ["t_salada"]}
    assert "t_incompleta" not in a["itens"] and "t_incompleta" not in c["receitas"]
    assert a["pendentes"] == 1
    # proteínas intactas
    assert len(c["pratos"]) == 47 and all(p in c["receitas"] for p in c["pratos"])


def test_as_47_receitas_atuais_passam_na_validacao():
    rec = cardapio.carregar()["receitas"]
    assert {k: cardapio.problemas_receita(v) for k, v in rec.items() if cardapio.problemas_receita(v)} == {}


# ---------- regra: uma proteína por dia ----------
def test_acompanhamento_nao_vira_proteina(api, fam):
    assert put(api, fam, 0, prato_id="t_arroz").status_code == 422


def test_acompanhamento_exige_proteina(api, fam):
    assert acomp(api, fam, 0, ["t_arroz"]).status_code == 409
    put(api, fam, 0, pulado=True)
    assert acomp(api, fam, 0, ["t_arroz"]).status_code == 409


def test_acompanhamento_desconhecido_ou_incompleto(api, fam):
    put(api, fam, 0, prato_id="carne0")
    assert acomp(api, fam, 0, ["nao_existe"]).status_code == 422
    assert acomp(api, fam, 0, ["t_incompleta"]).status_code == 422
    assert acomp(api, fam, 0, ["carne1"]).status_code == 422  # proteína não é acompanhamento


# ---------- testes obrigatórios 1, 2, 3, 4, 5, 6 ----------
def test_1_so_proteina(api, fam):
    s = put(api, fam, 0, prato_id="carne0").json()
    assert s["dias"]["0"] == {"prato_id": "carne0"}  # mesma resposta de antes


def test_2_proteina_com_varios(api, fam):
    put(api, fam, 0, prato_id="carne0")
    s = acomp(api, fam, 0, ["t_arroz", "t_feijao", "t_salada", "t_pure"]).json()
    assert s["dias"]["0"] == {"prato_id": "carne0", "acompanhamentos": ["t_arroz", "t_feijao", "t_salada", "t_pure"]}


def test_3_adicionar_remover_sem_repetir(api, fam):
    put(api, fam, 0, prato_id="carne0")
    acomp(api, fam, 0, ["t_arroz", "t_salada", "t_arroz"])
    assert api.get(f"/api/familias/{fam}").json()["dias"]["0"]["acompanhamentos"] == ["t_arroz", "t_salada"]
    s = acomp(api, fam, 0, ["t_salada"]).json()
    assert s["dias"]["0"]["acompanhamentos"] == ["t_salada"]
    s = acomp(api, fam, 0, []).json()
    assert s["dias"]["0"] == {"prato_id": "carne0"}


def test_4_trocar_proteina_mantem_acompanhamentos(api, fam):
    put(api, fam, 2, prato_id="carne0")
    acomp(api, fam, 2, ["t_arroz", "t_salada"])
    s = put(api, fam, 2, prato_id="frango3").json()
    assert s["dias"]["2"] == {"prato_id": "frango3", "acompanhamentos": ["t_arroz", "t_salada"]}


def test_5_pular_dia_tira_acompanhamentos(api, fam):
    put(api, fam, 1, prato_id="carne0")
    acomp(api, fam, 1, ["t_arroz"])
    s = put(api, fam, 1, pulado=True).json()
    assert s["dias"]["1"] == {"pulado": True}
    # voltar a ter almoço começa sem acompanhamentos antigos
    s = put(api, fam, 1, prato_id="carne0").json()
    assert s["dias"]["1"] == {"prato_id": "carne0"}


def test_limpar_dia_tira_acompanhamentos(api, fam):
    put(api, fam, 0, prato_id="carne0"); acomp(api, fam, 0, ["t_arroz"])
    api.delete(f"/api/familias/{fam}/dias/0")
    put(api, fam, 0, prato_id="carne0")
    assert api.get(f"/api/familias/{fam}").json()["dias"]["0"] == {"prato_id": "carne0"}


def test_6_reabrir_e_editar(api, fam):
    put(api, fam, 3, prato_id="peixe0"); acomp(api, fam, 3, ["t_pure"])
    s = api.get(f"/api/familias/{fam.lower()}").json()  # reabre (outro dispositivo, código em minúsculas)
    assert s["dias"]["3"]["acompanhamentos"] == ["t_pure"]
    s = acomp(api, fam, 3, s["dias"]["3"]["acompanhamentos"] + ["t_salada"]).json()
    assert s["dias"]["3"]["acompanhamentos"] == ["t_pure", "t_salada"]


def test_carrinho_da_proteina_nao_muda_com_acompanhamentos(api, fam):
    put(api, fam, 0, prato_id="carne0")
    api.put(f"/api/familias/{fam}/compras/0", json={"itens": [0, 1]})
    s = acomp(api, fam, 0, ["t_arroz"]).json()
    assert s["compras"]["0"] == [0, 1]


# ---------- Recomeçar / Desfazer com a refeição completa ----------
def test_recomecar_e_desfazer_preservam_acompanhamentos(api, fam):
    put(api, fam, 0, prato_id="carne0"); acomp(api, fam, 0, ["t_arroz", "t_salada"])
    put(api, fam, 1, pulado=True)
    antes = api.get(f"/api/familias/{fam}").json()
    api.put(f"/api/familias/{fam}/semana", json={})
    volta = api.put(f"/api/familias/{fam}/semana", json={"dias": antes["dias"], "compras": antes["compras"]}).json()
    assert volta["dias"] == antes["dias"]


def test_semana_com_acompanhamento_invalido(api, fam):
    r = api.put(f"/api/familias/{fam}/semana", json={"dias": {"0": {"pulado": True, "acompanhamentos": ["t_arroz"]}}})
    assert r.status_code == 422
    r = api.put(f"/api/familias/{fam}/semana", json={"dias": {"0": {"prato_id": "carne0", "acompanhamentos": ["nao_existe"]}}})
    assert r.status_code == 422


# ---------- 12: semanas criadas antes da atualização ----------
ESQUEMA_ANTIGO = """
CREATE TABLE familias(codigo TEXT PRIMARY KEY, criada_em TEXT NOT NULL, atualizada_em TEXT NOT NULL);
CREATE TABLE dias(codigo TEXT NOT NULL REFERENCES familias(codigo) ON DELETE CASCADE, dia INTEGER NOT NULL CHECK(dia BETWEEN 0 AND 6),
  prato_id TEXT, pulado INTEGER NOT NULL DEFAULT 0, PRIMARY KEY(codigo, dia));
CREATE TABLE compras(codigo TEXT NOT NULL REFERENCES familias(codigo) ON DELETE CASCADE, dia INTEGER NOT NULL, itens TEXT NOT NULL,
  PRIMARY KEY(codigo, dia));
"""


def test_12_banco_antigo_abre_sem_perder_nada(tmp_path):
    caminho = tmp_path / "antigo.db"
    c = sqlite3.connect(caminho)
    c.executescript(ESQUEMA_ANTIGO)
    c.execute("INSERT INTO familias VALUES('ANTIGA','2026-11-01T00:00:00+00:00','2026-11-01T00:00:00+00:00')")
    c.execute("INSERT INTO dias VALUES('ANTIGA',0,'carne0',0)")
    c.execute("INSERT INTO dias VALUES('ANTIGA',1,NULL,1)")
    c.execute("INSERT INTO compras VALUES('ANTIGA',0,?)", (json.dumps([0, 2]),))
    c.commit(); c.close()

    with TestClient(criar_app(str(caminho), pasta_front=str(tmp_path / "x"), acompanhamentos=CATALOGO_TESTE)) as api:
        s = api.get("/api/familias/ANTIGA").json()
        assert s["dias"] == {"0": {"prato_id": "carne0"}, "1": {"pulado": True}}
        assert s["compras"] == {"0": [0, 2]}
        # e a semana antiga já aceita acompanhamentos
        s = acomp(api, "ANTIGA", 0, ["t_arroz"]).json()
        assert s["dias"]["0"]["acompanhamentos"] == ["t_arroz"] and s["compras"] == {"0": [0, 2]}

    # nada das tabelas antigas foi apagado ou reescrito
    c = sqlite3.connect(caminho)
    assert c.execute("SELECT count(*) FROM dias").fetchone()[0] == 2
    assert c.execute("SELECT itens FROM compras").fetchone()[0] == "[0, 2]"
