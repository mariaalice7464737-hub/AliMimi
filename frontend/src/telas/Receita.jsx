import { Navigate, useParams, useSearchParams } from "react-router-dom";
import Tela from "../componentes/Tela";
import { useAviso, useCardapio, useSemana } from "../estado";
import { DIAS, pratoDoDia, proximoComPrato } from "../lib/dias";
import { copiar } from "../lib/copiar";
import { useIr } from "../navegar";

const Check = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
);

export default function Receita() {
  const d = Number(useParams().dia);
  const [params, setParams] = useSearchParams();
  const { pratos, receitas } = useCardapio();
  const { sem, acoes } = useSemana();
  const avisar = useAviso();
  const ir = useIr();
  const id = pratoDoDia(sem, d);
  if (!id) return <Navigate to={`${ir.base}/dia/${d}`} replace />;

  const p = pratos[id], r = receitas[id];
  const aba = params.get("aba") === "mercado" ? "mercado" : "receita";
  const marcados = sem.compras[d] || [];
  const nx = proximoComPrato(sem, d + 1);

  const trocarAba = (a) => setParams(a === "mercado" ? { aba: a } : {}, { replace: true }); // aba não vira entrada no histórico
  const marcar = (k) => acoes.marcar(d, marcados.includes(k) ? marcados.filter((x) => x !== k) : [...marcados, k].sort((a, b) => a - b));

  return (
    <Tela dia={d} voltarPara={ir.base}
      rodape={<>
        <button className="ghost" onClick={() => ir.categorias(d, { editando: true })}>Trocar prato</button>
        <button className="cta" onClick={() => (nx < 0 ? ir.cardapio() : ir.receita(nx))}>{nx < 0 ? "Ver cardápio" : `Próximo: ${DIAS[nx].toLowerCase()}`}</button>
      </>}>
      <div className="dhero"><img src={p.img} alt="" /></div>
      <h2>{p.nome}</h2>
      {r && <div className="meta"><span>{r.porcoes} porções</span><span>{r.tempo}</span><span>{r.ingredientes.length} ingredientes</span></div>}
      <div className="tabs" role="tablist">
        {[["receita", "Receita"], ["mercado", "Supermercado"]].map(([k, t]) => (
          <button key={k} className={`tab ${aba === k ? "on" : ""}`} role="tab" aria-selected={aba === k} onClick={() => trocarAba(k)}>{t}</button>
        ))}
      </div>
      {!r ? <p className="note">Receita ainda não disponível para este prato.</p>
        : aba === "receita" ? <ol className="steps">{r.preparo.map((s, k) => <li key={k}><span>{s}</span></li>)}</ol>
        : <>
          <div className="shophd">
            <span>{marcados.length} de {r.ingredientes.length} no carrinho</span>
            <button className="mini" onClick={() => copiar(`Supermercado — ${DIAS[d]}: ${p.nome}\n` + r.ingredientes.map((x) => "• " + x).join("\n"), "Lista copiada", avisar)}>Copiar lista</button>
          </div>
          <div className="shop">
            {r.ingredientes.map((x, k) => (
              <button key={k} className={`it ${marcados.includes(k) ? "ck" : ""}`} aria-pressed={marcados.includes(k)} onClick={() => marcar(k)}>
                <span className="box"><Check /></span><span>{x}</span>
              </button>
            ))}
          </div>
        </>}
      <p className="note">Receitas sugeridas para 4 pessoas — ajuste ao gosto da casa. O carrinho é o mesmo para toda a família.</p>
    </Tela>
  );
}
