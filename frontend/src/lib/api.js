async function req(metodo, url, corpo) {
  const r = await fetch(url, {
    method: metodo,
    headers: corpo ? { "Content-Type": "application/json" } : {},
    body: corpo ? JSON.stringify(corpo) : undefined,
  });
  if (!r.ok) {
    const info = await r.json().catch(() => ({}));
    const e = new Error(typeof info.detail === "string" ? info.detail : r.statusText);
    e.status = r.status;
    throw e;
  }
  return r.json();
}

const fam = (c) => `/api/familias/${encodeURIComponent(c)}`;

export const api = {
  cardapio: () => req("GET", "/api/cardapio"),
  criarFamilia: () => req("POST", "/api/familias"),
  semana: (c) => req("GET", fam(c)),
  escolher: (c, dia, pratoId) => req("PUT", `${fam(c)}/dias/${dia}`, { prato_id: pratoId }),
  pular: (c, dia) => req("PUT", `${fam(c)}/dias/${dia}`, { pulado: true }),
  compras: (c, dia, itens) => req("PUT", `${fam(c)}/compras/${dia}`, { itens }),
  acompanhamentos: (c, dia, itens) => req("PUT", `${fam(c)}/dias/${dia}/acompanhamentos`, { itens }),
  substituir: (c, sem) => req("PUT", `${fam(c)}/semana`, { dias: sem.dias, compras: sem.compras }),
};
