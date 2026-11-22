import os

import pytest
from fastapi.testclient import TestClient

from app.main import criar_app

# Os testes rodam no SQLite e, se TEST_DATABASE_URL existir, também num Postgres de verdade
PG = os.environ.get("TEST_DATABASE_URL")
BANCOS = ["sqlite"] + (["postgres"] if PG else [])


def _zerar_postgres():
    import psycopg
    with psycopg.connect(PG, autocommit=True) as c:
        c.execute("DROP TABLE IF EXISTS compras, dias, familias")


@pytest.fixture(params=BANCOS)
def api(request, tmp_path):
    if request.param == "postgres":
        _zerar_postgres()
        endereco = PG
    else:
        endereco = str(tmp_path / "teste.db")
    with TestClient(criar_app(endereco, pasta_front=str(tmp_path / "sem-front"))) as cliente:
        yield cliente


@pytest.fixture
def fam(api):
    r = api.post("/api/familias")
    assert r.status_code == 201
    return r.json()["codigo"]


def test_cardapio(api):
    c = api.get("/api/cardapio").json()
    assert [x["id"] for x in c["categorias"]] == ["carne", "frango", "massa", "peixe", "suina"]
    assert len(c["pratos"]) == 47
    assert set(c["pratos"]) == set(c["receitas"])
    assert c["pratos"]["carne0"]["img"] == "/img/carne0.jpg"
    assert api.get("/img/carne0.jpg").headers["content-type"] == "image/jpeg"


def test_familia_nova_vazia(api, fam):
    s = api.get(f"/api/familias/{fam}").json()
    assert len(fam) == 6 and s["dias"] == {} and s["compras"] == {}
    # código aceita minúsculas e espaços
    assert api.get(f"/api/familias/ {fam.lower()} ").status_code == 200


def test_familia_inexistente(api):
    assert api.get("/api/familias/XXXXXX").status_code == 404


def test_escolher_pular_e_limpar(api, fam):
    s = api.put(f"/api/familias/{fam}/dias/0", json={"prato_id": "carne0"}).json()
    assert s["dias"]["0"] == {"prato_id": "carne0"}
    s = api.put(f"/api/familias/{fam}/dias/1", json={"pulado": True}).json()
    assert s["dias"]["1"] == {"pulado": True}
    s = api.delete(f"/api/familias/{fam}/dias/1").json()
    assert "1" not in s["dias"]


@pytest.mark.parametrize("corpo", [{}, {"prato_id": "carne0", "pulado": True}, {"prato_id": "naoexiste"}])
def test_dia_invalido(api, fam, corpo):
    assert api.put(f"/api/familias/{fam}/dias/0", json=corpo).status_code == 422


def test_dia_fora_da_semana(api, fam):
    assert api.put(f"/api/familias/{fam}/dias/7", json={"pulado": True}).status_code == 422


def test_compras(api, fam):
    assert api.put(f"/api/familias/{fam}/compras/0", json={"itens": [0]}).status_code == 409
    api.put(f"/api/familias/{fam}/dias/0", json={"prato_id": "carne0"})
    s = api.put(f"/api/familias/{fam}/compras/0", json={"itens": [2, 0, 2]}).json()
    assert s["compras"]["0"] == [0, 2]
    assert api.put(f"/api/familias/{fam}/compras/0", json={"itens": [99]}).status_code == 422
    # mesmo prato de novo: carrinho fica
    s = api.put(f"/api/familias/{fam}/dias/0", json={"prato_id": "carne0"}).json()
    assert s["compras"]["0"] == [0, 2]
    # trocou o prato: carrinho zera
    s = api.put(f"/api/familias/{fam}/dias/0", json={"prato_id": "frango0"}).json()
    assert "0" not in s["compras"]


def test_recomecar_e_desfazer(api, fam):
    api.put(f"/api/familias/{fam}/dias/0", json={"prato_id": "carne0"})
    api.put(f"/api/familias/{fam}/dias/2", json={"pulado": True})
    api.put(f"/api/familias/{fam}/compras/0", json={"itens": [1]})
    antes = api.get(f"/api/familias/{fam}").json()

    vazia = api.put(f"/api/familias/{fam}/semana", json={}).json()
    assert vazia["dias"] == {} and vazia["compras"] == {}

    volta = api.put(f"/api/familias/{fam}/semana", json={"dias": antes["dias"], "compras": antes["compras"]}).json()
    assert volta["dias"] == antes["dias"] and volta["compras"] == antes["compras"]


def test_semana_incoerente(api, fam):
    r = api.put(f"/api/familias/{fam}/semana", json={"dias": {"1": {"pulado": True}}, "compras": {"1": [0]}})
    assert r.status_code == 422


def test_duas_familias_separadas(api, fam):
    outra = api.post("/api/familias").json()["codigo"]
    api.put(f"/api/familias/{fam}/dias/0", json={"prato_id": "carne0"})
    assert api.get(f"/api/familias/{outra}").json()["dias"] == {}
