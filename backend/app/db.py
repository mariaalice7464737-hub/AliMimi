"""Banco com a semana de cada família.

SQLite no computador (arquivo local) ou Postgres em produção (quando há DATABASE_URL,
ex.: Neon). As consultas são as mesmas; só o jeito de conectar muda.

Tabelas:
  familias(codigo, criada_em, atualizada_em)
  dias(codigo, dia, prato_id, pulado)        -> um registro por dia decidido (0 = segunda)
  compras(codigo, dia, itens)                -> índices dos ingredientes já no carrinho (JSON)
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
        return {"codigo": codigo, "dias": dias, "compras": compras, "atualizada_em": fam["atualizada_em"]}

    def _tocar(self, c, codigo):
        c.execute("UPDATE familias SET atualizada_em=? WHERE codigo=?", (agora(), codigo))

    # ---------- dias ----------
    def definir_dia(self, codigo: str, dia: int, prato_id: str | None, pulado: bool):
        with self.conexao() as c:
            antigo = c.execute("SELECT prato_id FROM dias WHERE codigo=? AND dia=?", (codigo, dia)).fetchone()
            # trocou o prato (ou pulou): o carrinho daquele dia não vale mais
            if not antigo or antigo["prato_id"] != prato_id or pulado:
                c.execute("DELETE FROM compras WHERE codigo=? AND dia=?", (codigo, dia))
            c.execute(
                "INSERT INTO dias VALUES(?,?,?,?) ON CONFLICT(codigo,dia) DO UPDATE SET prato_id=excluded.prato_id, pulado=excluded.pulado",
                (codigo, dia, None if pulado else prato_id, int(pulado)),
            )
            self._tocar(c, codigo)

    def limpar_dia(self, codigo: str, dia: int):
        with self.conexao() as c:
            c.execute("DELETE FROM dias WHERE codigo=? AND dia=?", (codigo, dia))
            c.execute("DELETE FROM compras WHERE codigo=? AND dia=?", (codigo, dia))
            self._tocar(c, codigo)

    def prato_do_dia(self, codigo: str, dia: int) -> str | None:
        with self.conexao() as c:
            r = c.execute("SELECT prato_id FROM dias WHERE codigo=? AND dia=?", (codigo, dia)).fetchone()
            return r["prato_id"] if r else None

    # ---------- compras ----------
    def definir_compras(self, codigo: str, dia: int, itens: list[int]):
        with self.conexao() as c:
            c.execute(
                "INSERT INTO compras VALUES(?,?,?) ON CONFLICT(codigo,dia) DO UPDATE SET itens=excluded.itens",
                (codigo, dia, json.dumps(sorted(set(itens)))),
            )
            self._tocar(c, codigo)

    # ---------- semana inteira ----------
    def substituir_semana(self, codigo: str, dias: dict, compras: dict):
        """Apaga tudo e grava de novo (usado por "Recomeçar" e "Desfazer")."""
        with self.conexao() as c:
            c.execute("DELETE FROM dias WHERE codigo=?", (codigo,))
            c.execute("DELETE FROM compras WHERE codigo=?", (codigo,))
            for dia, v in dias.items():
                c.execute("INSERT INTO dias VALUES(?,?,?,?)", (codigo, int(dia), v.get("prato_id"), int(bool(v.get("pulado")))))
            for dia, itens in compras.items():
                c.execute("INSERT INTO compras VALUES(?,?,?)", (codigo, int(dia), json.dumps(sorted(set(itens)))))
            self._tocar(c, codigo)
