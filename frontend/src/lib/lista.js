/* Lista de supermercado da semana: soma as quantidades de todos os pratos e separa por seção */

export const SECOES = ["Açougue", "Peixaria", "Hortifrúti", "Frios e laticínios", "Mercearia", "Temperos"];

const fracao = (x) => {
  const w = Math.floor(x + 1e-9), f = x - w;
  const fr = Math.abs(f - 0.5) < 0.01 ? "½" : Math.abs(f - 0.25) < 0.01 ? "¼" : Math.abs(f - 0.75) < 0.01 ? "¾" : "";
  if (fr) return (w || "") + fr;
  if (f < 0.01) return String(w);
  return (Math.round(x * 10) / 10).toString().replace(".", ",");
};

const PLURAL = { xícara: "xícaras", lata: "latas", dente: "dentes", cabeça: "cabeças", folha: "folhas", ramo: "ramos", maço: "maços" };

function quantidade(q, u) {
  if (u === "g") return q >= 1000 ? fracao(q / 1000) + " kg" : Math.round(q) + " g";
  if (u === "ml") return q >= 1000 ? fracao(q / 1000) + (q > 1000 ? " litros" : " litro") : Math.round(q) + " ml";
  if (u === "un") return fracao(q) + " un";
  if (u === "c. sopa") return fracao(q) + (q > 1 ? " colheres (sopa)" : " colher (sopa)");
  if (u === "c. chá") return fracao(q) + (q > 1 ? " colheres (chá)" : " colher (chá)");
  return fracao(q) + " " + (q > 1 && PLURAL[u] ? PLURAL[u] : u);
}

// Itens "a gosto" que na prática se compram numa embalagem
const EMBALAGEM = {
  "Espetos de madeira": "1 pacote", "Papel-manteiga ou alumínio": "1 rolo", "Limão": "1 un", "Pão sírio": "1 pacote",
  "Pão": "1 un", "Alface": "1 pé", "Abacate (para o guacamole)": "1 un", "Azeitonas pretas": "1 vidro",
  "Coalhada seca": "1 pote", "Creme azedo": "1 pote", "Molho de tahine": "1 pote", "Maionese japonesa": "1 frasco",
  "Amêndoas ou pinoles": "1 pacote pequeno", "Alho (para o molho)": "1 cabeça", "Queijo ralado": "1 pacote",
};

/** @param pratosIds ids dos pratos da semana  @param receitas mapa id → receita */
export function listaDaSemana(pratosIds, receitas) {
  const m = {};
  pratosIds.forEach((id) => {
    const r = receitas[id];
    if (!r) return;
    r.compras.forEach((it) => {
      const e = (m[it.nome] ||= { nome: it.nome, secao: it.secao, q: {}, aGosto: false });
      if (it.qtd == null) e.aGosto = true;
      else e.q[it.unidade] = (e.q[it.unidade] || 0) + it.qtd;
    });
  });
  return SECOES.map((secao) => ({
    secao,
    itens: Object.values(m)
      .filter((e) => e.secao === secao)
      .sort((a, b) => a.nome.localeCompare(b.nome, "pt"))
      .map((e) => {
        let qtd = Object.entries(e.q)
          .map(([u, q]) =>
            e.nome === "Alho" && u === "dente" && q >= 10
              ? `${quantidade(q, u)} (cerca de ${Math.ceil(q / 10)} ${Math.ceil(q / 10) > 1 ? "cabeças" : "cabeça"})`
              : quantidade(q, u))
          .join(" + ");
        if (!qtd) qtd = EMBALAGEM[e.nome] || "a gosto";
        else if (e.aGosto) qtd += " + a gosto";
        return { nome: e.nome, qtd };
      }),
  })).filter((g) => g.itens.length);
}

export function listaComoTexto(grupos) {
  return "Lista de supermercado da semana\n" +
    grupos.map((g) => `\n${g.secao.toUpperCase()}\n` + g.itens.map((x) => `• ${x.nome}: ${x.qtd}`).join("\n")).join("\n");
}
