"""Banco com a semana de cada família.

SQLite no computador (arquivo local) ou Postgres em produção (quando há DATABASE_URL,
ex.: Neon). As consultas são as mesmas; só o jeito de conectar muda.

Tabelas:
  familias(codigo, criada_em, atualizada_em)
  dias(codigo, dia, prato_id, pulado)        -> um registro por dia decidido (0 = segunda)
  compras(codigo, dia, itens)                -> índices dos ingredientes já no carrinho (JSON)
  acompanhamentos(codigo, dia, item_id, ordem) -> acompanhamentos do dia (zero ou mais). Tabela nova:
                                                semanas antigas simplesmente não têm linhas aqui.
  compras_acompanhamentos(codigo, dia, item_id, itens) -> carrinho de cada acompanhamento do dia (JSON)
"""
import json
import secrets
import sqlite3
from contextlib import contextmanager
from datetime import datetime, timezone

# Sem letras/números que se confundem (0/O, 1/I/L) — o código é digitado à mão
ALFABETO = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"
TAM_CODIGO = 6

ESQUEMA = """
CREATE TABLE IF NOT EXISTS familias(
  codigo TEXT PRIMARY KEY,
  criada_em TEXT NOT NULL,
  atualizada_em TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS dias(
  codigo TEXT NOT NULL REFERENCES familias(codigo) ON DELETE CASCADE,
  dia INTEGER NOT NULL CHECK(dia BETWEEN 0 AND 6),
  prato_id TEXT,
  pulado INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY(codigo, dia)
);
CREATE TABLE IF NOT EXISTS compras(
  codigo TEXT NOT NULL REFERENCES familias(codigo) ON DELETE CASCADE,
  dia INTEGER NOT NULL,
  itens TEXT NOT NULL,
  PRIMARY KEY(codigo, dia)
);
CREATE TABLE IF NOT EXISTS acompanhamentos(
  codigo TEXT NOT NULL REFERENCES familias(codigo) ON DELETE CASCADE,
  dia INTEGER NOT NULL CHECK(dia BETWEEN 0 AND 6),
  item_id TEXT NOT NULL,
  ordem INTEGER NOT NULL,
  PRIMARY KEY(codigo, dia, item_id)
);
CREATE TABLE IF NOT EXISTS compras_acompanhamentos(
  codigo TEXT NOT NULL REFERENCES familias(codigo) ON DELETE CASCADE,
  dia INTEGER NOT NULL,
  item_id TEXT NOT NULL,
  itens TEXT NOT NULL,
  PRIMARY KEY(codigo, dia, item_id)
);
"""


def agora() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


class _Postgres:
    """Deixa uma conexão psycopg com a mesma cara da sqlite3 (placeholders "?")."""
    def __init__(self, c):
        self.c = c

    def execute(self, sql, params=()):
        return self.c.execute(sql.replace("?", "%s"), params)


class Banco:
    def __init__(self, endereco: str):
        """endereco: caminho de um arquivo .db (SQLite) ou URL postgresql://…"""
        self.pg = endereco.startswith(("postgres://", "postgresql://"))
        if self.pg:
            from psycopg.rows import dict_row
            from psycopg_pool import ConnectionPool
            self.pool = ConnectionPool(
                endereco.replace("postgres://", "postgresql://", 1),
                min_size=1, max_size=5, open=True,
                kwargs={"row_factory": dict_row},
                check=ConnectionPool.check_connection,  # o Neon derruba conexões paradas
            )
        else:
            self.caminho = endereco
        with self.conexao() as c:
            if not self.pg:
                c.execute("PRAGMA journal_mode=WAL")
            for comando in filter(str.strip, ESQUEMA.split(";")):
                c.execute(comando)

    @contextmanager
    def conexao(self):
        if self.pg:
            with self.pool.connection() as c:  # o pool faz commit (ou rollback se der erro)
                yield _Postgres(c)
            return
        c = sqlite3.connect(self.caminho)
        c.row_factory = sqlite3.Row
        c.execute("PRAGMA foreign_keys=ON")
        try:
            yield c
            c.commit()
        finally:
            c.close()

    def fechar(self):
        if self.pg:
            self.pool.close()

    # ---------- famílias ----------
    def criar_familia(self) -> str:
        with self.conexao() as c:
            while True:
                codigo = "".join(secrets.choice(ALFABETO) for _ in range(TAM_CODIGO))
                cur = c.execute("INSERT INTO familias VALUES(?,?,?) ON CONFLICT(codigo) DO NOTHING", (codigo, agora(), agora()))
                if cur.rowcount == 1:
                    return codigo
                # código repetido (raríssimo): tenta outro

    def existe(self, codigo: str) -> bool:
        with self.conexao() as c:
            return c.execute("SELECT 1 FROM familias WHERE codigo=?", (codigo,)).fetchone() is not None

    def semana(self, codigo: str) -> dict:
        with self.conexao() as c:
            fam = c.execute("SELECT atualizada_em FROM familias WHERE codigo=?", (codigo,)).fetchone()
            dias = {
                str(r["dia"]): ({"pulado": True} if r["pulado"] else {"prato_id": r["prato_id"]})
                for r in c.execute("SELECT * FROM dias WHERE codigo=? ORDER BY dia", (codigo,))
            }
            compras = {
                str(r["dia"]): json.loads(r["itens"])
                for r in c.execute("SELECT * FROM compras WHERE codigo=? ORDER BY dia", (codigo,))
            }
            # acompanhamentos só aparecem no dia quando existem: semanas antigas ficam com a mesma resposta
            for r in c.execute("SELECT dia, item_id FROM acompanhamentos WHERE codigo=? ORDER BY dia, ordem", (codigo,)):
                d = dias.get(str(r["dia"]))
                if d and d.get("prato_id"):
                    d.setdefault("acompanhamentos", []).append(r["item_id"])
            carrinho_acomp: dict[str, dict[str, list[int]]] = {}
            for r in c.execute("SELECT * FROM compras_acompanhamentos WHERE codigo=? ORDER BY dia, item_id", (codigo,)):
                carrinho_acomp.setdefault(str(r["dia"]), {})[r["item_id"]] = json.loads(r["itens"])
        semana = {"codigo": codigo, "dias": dias, "compras": compras, "atualizada_em": fam["atualizada_em"]}
        if carrinho_acomp:  # só aparece quando existe: semanas antigas mantêm a mesma resposta
            semana["compras_acompanhamentos"] = carrinho_acomp
        return semana

    def _tocar(self, c, codigo):
        c.execute("UPDATE familias SET atualizada_em=? WHERE codigo=?", (agora(), codigo))

    # ---------- dias ----------
    def definir_dia(self, codigo: str, dia: int, prato_id: str | None, pulado: bool):
        with self.conexao() as c:
            antigo = c.execute("SELECT prato_id FROM dias WHERE codigo=? AND dia=?", (codigo, dia)).fetchone()
            # trocou o prato (ou pulou): o carrinho daquele dia não vale mais
            if not antigo or antigo["prato_id"] != prato_id or pulado:
                c.execute("DELETE FROM compras WHERE codigo=? AND dia=?", (codigo, dia))
            # trocar a proteína mantém os acompanhamentos; pular o dia (sem almoço) tira
            if pulado:
                c.execute("DELETE FROM acompanhamentos WHERE codigo=? AND dia=?", (codigo, dia))
                c.execute("DELETE FROM compras_acompanhamentos WHERE codigo=? AND dia=?", (codigo, dia))
            c.execute(
                "INSERT INTO dias VALUES(?,?,?,?) ON CONFLICT(codigo,dia) DO UPDATE SET prato_id=excluded.prato_id, pulado=excluded.pulado",
                (codigo, dia, None if pulado else prato_id, int(pulado)),
            )
            self._tocar(c, codigo)

    def limpar_dia(self, codigo: str, dia: int):
        with self.conexao() as c:
            c.execute("DELETE FROM dias WHERE codigo=? AND dia=?", (codigo, dia))
            c.execute("DELETE FROM compras WHERE codigo=? AND dia=?", (codigo, dia))
            c.execute("DELETE FROM acompanhamentos WHERE codigo=? AND dia=?", (codigo, dia))
            c.execute("DELETE FROM compras_acompanhamentos WHERE codigo=? AND dia=?", (codigo, dia))
            self._tocar(c, codigo)

    def prato_do_dia(self, codigo: str, dia: int) -> str | None:
        with self.conexao() as c:
            r = c.execute("SELECT prato_id FROM dias WHERE codigo=? AND dia=?", (codigo, dia)).fetchone()
            return r["prato_id"] if r else None

    # ---------- acompanhamentos ----------
    def definir_acompanhamentos(self, codigo: str, dia: int, itens: list[str]):
        """Substitui os acompanhamentos do dia (ordem preservada, sem repetir).
        O carrinho de quem saiu do dia é apagado; o de quem ficou, mantido."""
        itens = list(dict.fromkeys(itens))
        with self.conexao() as c:
            c.execute("DELETE FROM acompanhamentos WHERE codigo=? AND dia=?", (codigo, dia))
            for ordem, item in enumerate(itens):
                c.execute("INSERT INTO acompanhamentos VALUES(?,?,?,?)", (codigo, dia, item, ordem))
            for r in c.execute("SELECT item_id FROM compras_acompanhamentos WHERE codigo=? AND dia=?", (codigo, dia)).fetchall():
                if r["item_id"] not in itens:
                    c.execute("DELETE FROM compras_acompanhamentos WHERE codigo=? AND dia=? AND item_id=?", (codigo, dia, r["item_id"]))
            self._tocar(c, codigo)

    def acompanhamentos_do_dia(self, codigo: str, dia: int) -> list[str]:
        with self.conexao() as c:
            return [r["item_id"] for r in c.execute(
                "SELECT item_id FROM acompanhamentos WHERE codigo=? AND dia=? ORDER BY ordem", (codigo, dia))]

    def repetir_acompanhamento(self, codigo: str, item: str, dias: list[int]) -> tuple[list[int], list[int]]:
        """Acrescenta o item ao fim da lista de cada dia pedido. Não substitui nada, não repete
        no mesmo dia e ignora dias pulados ou sem proteína. Devolve (aplicados, ignorados)."""
        aplicados, ignorados = [], []
        with self.conexao() as c:
            for dia in sorted(set(dias)):
                r = c.execute("SELECT prato_id FROM dias WHERE codigo=? AND dia=?", (codigo, dia)).fetchone()
                atuais = [x["item_id"] for x in c.execute(
                    "SELECT item_id FROM acompanhamentos WHERE codigo=? AND dia=? ORDER BY ordem", (codigo, dia))]
                if not r or not r["prato_id"] or item in atuais:
                    ignorados.append(dia); continue
                c.execute("INSERT INTO acompanhamentos VALUES(?,?,?,?)", (codigo, dia, item, len(atuais)))
                aplicados.append(dia)
            if aplicados:
                self._tocar(c, codigo)
        return aplicados, ignorados

    def definir_compras_acompanhamento(self, codigo: str, dia: int, item: str, itens: list[int]):
        with self.conexao() as c:
            c.execute(
                "INSERT INTO compras_acompanhamentos VALUES(?,?,?,?) ON CONFLICT(codigo,dia,item_id) DO UPDATE SET itens=excluded.itens",
                (codigo, dia, item, json.dumps(sorted(set(itens)))),
            )
            self._tocar(c, codigo)

    # ---------- compras ----------
    def definir_compras(self, codigo: str, dia: int, itens: list[int]):
        with self.conexao() as c:
            c.execute(
                "INSERT INTO compras VALUES(?,?,?) ON CONFLICT(codigo,dia) DO UPDATE SET itens=excluded.itens",
                (codigo, dia, json.dumps(sorted(set(itens)))),
            )
            self._tocar(c, codigo)

    # ---------- semana inteira ----------
    def substituir_semana(self, codigo: str, dias: dict, compras: dict, compras_acomp: dict | None = None):
        """Apaga tudo e grava de novo (usado por "Recomeçar" e "Desfazer")."""
        with self.conexao() as c:
            c.execute("DELETE FROM dias WHERE codigo=?", (codigo,))
            c.execute("DELETE FROM compras WHERE codigo=?", (codigo,))
            c.execute("DELETE FROM acompanhamentos WHERE codigo=?", (codigo,))
            c.execute("DELETE FROM compras_acompanhamentos WHERE codigo=?", (codigo,))
            for dia, por_item in (compras_acomp or {}).items():
                for item, itens in por_item.items():
                    c.execute("INSERT INTO compras_acompanhamentos VALUES(?,?,?,?)", (codigo, int(dia), item, json.dumps(sorted(set(itens)))))
            for dia, v in dias.items():
                c.execute("INSERT INTO dias VALUES(?,?,?,?)", (codigo, int(dia), v.get("prato_id"), int(bool(v.get("pulado")))))
                if v.get("prato_id"):
                    for ordem, item in enumerate(dict.fromkeys(v.get("acompanhamentos") or [])):
                        c.execute("INSERT INTO acompanhamentos VALUES(?,?,?,?)", (codigo, int(dia), item, ordem))
            for dia, itens in compras.items():
                c.execute("INSERT INTO compras VALUES(?,?,?)", (codigo, int(dia), json.dumps(sorted(set(itens)))))
            self._tocar(c, codigo)
