"""PR 2 — carrinho dos acompanhamentos, repetir em outros dias, sincronização e Recomeçar/Desfazer."""
import pytest

from tests.test_acompanhamentos import acomp, api, fam, put  # noqa: F401  (fixtures e utilitários do PR 1)


def carrinho(api, fam, dia, item, itens):
    return api.put(f"/api/familias/{fam}/compras/{dia}/acompanhamentos/{item}", json={"itens": itens})


def repetir(api, fam, item, dias):
    return api.post(f"/api/familias/{fam}/acompanhamentos/repetir", json={"item_id": item, "dias": dias})


@pytest.fixture
def semana(api, fam):
    """seg: carne0 + arroz | ter: pulado | qua: frango0 + salada | qui: vazio | sex: peixe0 (sem acompanhamento)"""
    put(api, fam, 0, prato_id="carne0"); acomp(api, fam, 0, ["t_arroz"])
    put(api, fam, 1, pulado=True)
    put(api, fam, 2, prato_id="frango0"); acomp(api, fam, 2, ["t_salada"])
    put(api, fam, 4, prato_id="peixe0")
    return fam


# ---------- 7. repetir em outros dias ----------
def test_7_repetir(api, semana):
    r = repetir(api, semana, "t_arroz", [0, 1, 2, 3, 4]).json()
    assert r["repeticao"] == {"aplicado": [2, 4], "ignorado": [0, 1, 3]}  # 0 já tem; 1 pulado; 3 sem almoço
    assert r["dias"]["2"]["acompanhamentos"] == ["t_salada", "t_arroz"]  # não substitui, acrescenta
    assert r["dias"]["4"]["acompanhamentos"] == ["t_arroz"]
    assert r["dias"]["1"] == {"pulado": True} and "3" not in r["dias"]
    # repetir de novo não duplica
    r = repetir(api, semana, "t_arroz", [2, 4]).json()
    assert r["repeticao"] == {"aplicado": [], "ignorado": [2, 4]}
    assert r["dias"]["2"]["acompanhamentos"] == ["t_salada", "t_arroz"]


def test_repetir_invalido(api, semana):
    assert repetir(api, semana, "nao_existe", [2]).status_code == 422
    assert repetir(api, semana, "carne1", [2]).status_code == 422  # proteína não é acompanhamento
    assert repetir(api, semana, "t_arroz", [9]).status_code == 422


# ---------- 9. carrinho dos acompanhamentos ----------
def test_9_marcar_e_desmarcar(api, semana):
    s = carrinho(api, semana, 0, "t_arroz", [2, 0, 2]).json()
    assert s["compras_acompanhamentos"] == {"0": {"t_arroz": [0, 2]}}
    s = carrinho(api, semana, 0, "t_arroz", [2]).json()
    assert s["compras_acompanhamentos"] == {"0": {"t_arroz": [2]}}
    assert s["compras"] == {}  # carrinho da proteína não muda


def test_carrinho_invalido(api, semana):
    assert carrinho(api, semana, 0, "t_salada", [0]).status_code == 409  # não está na segunda
    assert carrinho(api, semana, 1, "t_arroz", [0]).status_code == 409   # dia pulado
    assert carrinho(api, semana, 0, "t_arroz", [99]).status_code == 422


def test_mesmo_acompanhamento_em_dois_dias_tem_carrinhos_separados(api, semana):
    repetir(api, semana, "t_arroz", [2])
    carrinho(api, semana, 0, "t_arroz", [0])
    s = carrinho(api, semana, 2, "t_arroz", [1, 2]).json()
    assert s["compras_acompanhamentos"] == {"0": {"t_arroz": [0]}, "2": {"t_arroz": [1, 2]}}
    # tirar o arroz da quarta não mexe na segunda
    s = acomp(api, semana, 2, ["t_salada"]).json()
    assert s["compras_acompanhamentos"] == {"0": {"t_arroz": [0]}}
    assert s["dias"]["0"]["acompanhamentos"] == ["t_arroz"]


def test_carrinho_ao_trocar_proteina_e_ao_pular(api, semana):
    carrinho(api, semana, 0, "t_arroz", [1])
    s = put(api, semana, 0, prato_id="carne5").json()
    assert s["compras_acompanhamentos"] == {"0": {"t_arroz": [1]}}  # trocar proteína mantém
    s = put(api, semana, 0, pulado=True).json()
    assert "compras_acompanhamentos" not in s  # pular tira


# ---------- 11. dois dispositivos ----------
def test_11_outro_dispositivo_ve_tudo(api, semana):
    carrinho(api, semana, 0, "t_arroz", [0, 1])
    api.put(f"/api/familias/{semana}/compras/2", json={"itens": [0]})
    outro = api.get(f"/api/familias/{semana.lower()}").json()
    assert outro["dias"]["0"]["acompanhamentos"] == ["t_arroz"]
    assert outro["compras_acompanhamentos"] == {"0": {"t_arroz": [0, 1]}}
    assert outro["compras"] == {"2": [0]}


# ---------- Recomeçar / Desfazer ----------
def test_recomecar_e_desfazer_com_carrinho_dos_acompanhamentos(api, semana):
    carrinho(api, semana, 0, "t_arroz", [0, 2])
    antes = api.get(f"/api/familias/{semana}").json()
    api.put(f"/api/familias/{semana}/semana", json={})
    volta = api.put(f"/api/familias/{semana}/semana", json={
        "dias": antes["dias"], "compras": antes["compras"], "compras_acompanhamentos": antes["compras_acompanhamentos"]}).json()
    assert volta["dias"] == antes["dias"] and volta["compras_acompanhamentos"] == antes["compras_acompanhamentos"]


def test_semana_com_carrinho_incoerente(api, fam):
    r = api.put(f"/api/familias/{fam}/semana", json={
        "dias": {"0": {"prato_id": "carne0"}}, "compras_acompanhamentos": {"0": {"t_arroz": [0]}}})
    assert r.status_code == 422


def test_semana_sem_acompanhamentos_tem_a_mesma_resposta(api, fam):
    put(api, fam, 0, prato_id="carne0")
    s = api.get(f"/api/familias/{fam}").json()
    assert set(s) == {"codigo", "dias", "compras", "atualizada_em"}
