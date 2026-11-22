/* Desenhos de traço fino, no espírito de livro de receitas antigo.
   Usam currentColor: a cor vem do CSS de onde forem colocados. Todos são decorativos (aria-hidden). */

const traco = { fill: "none", stroke: "currentColor", strokeWidth: 1.3, strokeLinecap: "round", strokeLinejoin: "round" };

/* folhas do alecrim, geradas ao longo do galho */
function folhas(n, x0, y0, x1, y1, tam) {
  const out = [];
  for (let i = 0; i < n; i++) {
    const t = (i + 0.6) / (n + 0.4);
    const x = (x0 + (x1 - x0) * t).toFixed(1), y = (y0 + (y1 - y0) * t).toFixed(1);
    const lado = i % 2 ? 1 : -1, l = tam * (1 - t * 0.45);
    const f = (v) => v.toFixed(1);
    // folha estreita, inclinada para a ponta do galho (duas curvas formando a folha)
    out.push(`M${x} ${y} q${f(l * 0.35)} ${f(lado * l * 0.5)} ${f(l * 0.85)} ${f(lado * l * 0.55)}`);
    out.push(`M${x} ${y} q${f(l * 0.55)} ${f(lado * l * 0.15)} ${f(l * 0.85)} ${f(lado * l * 0.55)}`);
  }
  return out.join(" ");
}

/* ---------- traços (sem <svg>, para compor) ---------- */
const RamoTraco = () => (<>
  <path {...traco} d="M4 14 C34 11, 70 9, 116 8" />
  <path {...traco} strokeWidth={1.1} d={folhas(9, 8, 13.6, 112, 8.2, 12)} />
</>);

const TomateTraco = () => (<>
  <path {...traco} d="M24 13c-9.5 0-17 6.6-17 15.4C7 37.3 14.8 43 24 43s17-5.7 17-14.6C41 19.6 33.5 13 24 13z" />
  <path {...traco} d="M15.5 21c-2.4 2.3-3.6 5.1-3.4 8.4" opacity=".55" />
  <path {...traco} d="M24 13l-2.6-4.2M24 13l5.6-2.8M24 13l-6.6-.6M24 13l4.2 3.6M24 13l-4.4 3.4M21.4 8.8c.4-2.2 1.8-3.8 4-4.6" />
</>);

const TalheresTraco = () => (<>
  <path {...traco} d="M14 6v10c0 2.6 1.8 4.4 4 4.4s4-1.8 4-4.4V6M18 6v9M18 20.4V43" />
  <path {...traco} d="M33 43V6c3.6 2.5 5.6 7.6 5.6 13.8 0 3.2-1.4 5-5.6 5.2" />
</>);

const AzeiteTraco = () => (<>
  <path {...traco} d="M21 4h6M21.5 4v6.5c0 1.5-6.5 4.5-6.5 10.5v18.5c0 2 1.6 3.5 3.5 3.5h11c1.9 0 3.5-1.5 3.5-3.5V21c0-6-6.5-9-6.5-10.5V4" />
  <path {...traco} d="M15.5 27h17M15.5 36h17" opacity=".55" />
  <path {...traco} d="M24 29.6c2 0 3.3 1 3.3 1.9s-1.3 1.9-3.3 1.9-3.3-1-3.3-1.9 1.3-1.9 3.3-1.9zM27 30.5l2.6-1.8" />
</>);

const svg = (viewBox, Traco) => function Desenho({ className }) {
  return <svg className={className} viewBox={viewBox} aria-hidden="true" focusable="false"><Traco /></svg>;
};

export const Ramo = svg("0 0 120 22", RamoTraco);
export const Tomate = svg("0 0 48 48", TomateTraco);
export const Talheres = svg("0 0 48 48", TalheresTraco);
export const Azeite = svg("0 0 48 48", AzeiteTraco);

/** Estado vazio do cardápio: azeite, prato coberto, tomate, talheres e um ramo de alecrim */
export function MesaPosta({ className }) {
  return (
    <svg className={`ilustra ${className || ""}`} viewBox="0 0 200 112" aria-hidden="true" focusable="false">
      <g transform="translate(14 44)"><AzeiteTraco /></g>
      {/* prato com tampa */}
      <g transform="translate(62 20)">
        <path {...traco} d="M10 66c0-19 14-32 28-32s28 13 28 32" />
        <path {...traco} d="M2 66h72M8 71h60" />
        <path {...traco} d="M38 34v-4M34 30h8" />
        <path {...traco} d="M20 56c1.5-6 5-10.5 10-13" opacity=".5" />
      </g>
      <g transform="translate(118 62) scale(.6)" style={{ color: "var(--terracota)" }}><TomateTraco /></g>
      <g transform="translate(146 44)"><TalheresTraco /></g>
      <g transform="translate(40 92)"><RamoTraco /></g>
    </svg>
  );
}

/* ---------- ícones de interface (traço, 24px) ---------- */
const icone = (d) => function Icone() {
  return <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path {...traco} strokeWidth={1.8} d={d} /></svg>;
};
export const IcVoltar = icone("M15 5l-7 7 7 7");
export const IcCardapio = icone("M5 5h14M5 10h14M5 15h9M5 20h6");
export const IcRelogio = icone("M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 7v5l3 2");
export const IcLista = icone("M9 6h11M9 12h11M9 18h11M4.5 6h.01M4.5 12h.01M4.5 18h.01");
export const IcCopiar = icone("M9 9h10v11H9zM5 15V4h10");
export const IcCheck = icone("M5 12.5l4.5 4.5L19 7.5");
export const IcPessoas = icone("M8.5 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM2 20c0-3.6 2.9-6 6.5-6s6.5 2.4 6.5 6M16 4.3a3.5 3.5 0 0 1 0 6.4M18 14.4c2.4.6 4 2.6 4 5.6");
export const IcCarrinho = icone("M3 4h2l2.4 11.2a1 1 0 0 0 1 .8h9.2a1 1 0 0 0 1-.8L20 8H6.2M9 20h.01M17 20h.01");
export const IcLivro = icone("M4 5a2 2 0 0 1 2-2h12v16H6a2 2 0 0 0-2 2zM4 21V5M8 7h6M8 11h6");
export const IcBaixar = icone("M12 4v11M7 10l5 5 5-5M5 20h14");
