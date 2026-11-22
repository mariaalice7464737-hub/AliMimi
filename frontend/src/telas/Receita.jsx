import { useEffect, useRef, useState } from "react";
import Repetir from "../componentes/Repetir";
import { Navigate, useParams, useSearchParams } from "react-router-dom";
import Tela from "../componentes/Tela";
import { IcCheck, IcCopiar } from "../componentes/Ilustracoes";
import { useAviso, useCardapio, useSemana } from "../estado";
import { DIAS, acompanhamentosDoDia, nomeDia, pratoDoDia, proximoComPrato } from "../lib/dias";
import { copiar } from "../lib/copiar";
import { useIr } from "../navegar";

/* Ordem editorial: nome, foto, descrição, ficha, ingredientes (com o carrinho da família), preparo, ações.
   ?aba=mercado continua valendo: a página abre já nos ingredientes. */
export default function Receita() {
  const d = Number(useParams().dia);
  const [params] = useSearchParams();
  const { pratos, receitas, acompanhamentos } = useCardapio();
  const { sem, acoes } = useSemana();
  const avisar = useAviso();
  const ir = useIr();
  const ingredientesRef = useRef(null);
  const id = pratoDoDia(sem, d);
  const irParaIngredientes = params.get("aba") === "mercado";

  useEffect(() => {
    if (irParaIngredientes && ingredientesRef.current)
      requestAnimationFrame(() => ingredientesRef.current?.scrollIntoView({ block: "start" }));
  }, [irParaIngredientes, id]);

  if (!id) return <Navigate to={`${ir.base}/dia/${d}`} replace />;

  const p = pratos[id], r = receitas[id];
  const marcados = sem.compras[d] || [];
  const nx = proximoComPrato(sem, d + 1);
  const marcar = (k) => acoes.marcar(d, marcados.includes(k) ? marcados.filter((x) => x !== k) : [...marcados, k].sort((a, b) => a - b));

  return (
    <Tela dia={d} voltarPara={ir.base}
      rodape={<>
        <button className="botao contorno" onClick={() => ir.categorias(d, { editando: true })}>Trocar prato</button>
        <button className="botao principal" onClick={() => (nx < 0 ? ir.cardapio() : ir.receita(nx))}>{nx < 0 ? "Ver cardápio" : `Próximo: ${DIAS[nx].toLowerCase()}`}</button>
      </>}>
      <p className="sobrelinha">{nomeDia(d)}</p>
      <h1 className="titulo">{p.nome}</h1>
      <img className="foto-receita" src={p.img} alt={p.nome} />
      <p className="descricao">{p.descricao}</p>

      {r && <div className="ficha">
        <div><b>{r.tempo}</b><small>preparo</small></div>
        <div><b>{r.porcoes}</b><small>porções</small></div>
        <div><b>{r.ingredientes.length}</b><small>ingredientes</small></div>
      </div>}

      {!r ? <p className="nota">Receita ainda não disponível para este prato.</p> : <>
        <h2 className="secao" id="ingredientes" ref={ingredientesRef} style={{ scrollMarginTop: 140 }}>Ingredientes</h2>
        <div className="cabeca-lista">
          <span>{marcados.length} de {r.ingredientes.length} no carrinho</span>
          <button className="link" onClick={() => copiar(`Supermercado — ${DIAS[d]}: ${p.nome}\n` + r.ingredientes.map((x) => "• " + x).join("\n"), "Lista copiada", avisar)}>
            <IcCopiar /> Copiar lista
          </button>
        </div>
        <ul className="ingredientes">
          {r.ingredientes.map((x, k) => (
            <li key={k}>
              <button className="ingrediente" aria-pressed={marcados.includes(k)} onClick={() => marcar(k)}>
                <span className="caixa"><IcCheck /></span><span>{x}</span>
              </button>
            </li>
          ))}
        </ul>
        <p className="nota">Marque o que já está no carrinho. A marcação aparece para toda a família.</p>

        <h2 className="secao">Modo de preparo</h2>
        <ol className="passos">{r.preparo.map((s, k) => <li key={k}><span>{s}</span></li>)}</ol>
      </>}
      {(ir.temAcompanhamentos() || acompanhamentosDoDia(sem, d).length > 0) && (
        <AcompanhamentosDoDia dia={d} ids={acompanhamentosDoDia(sem, d).filter((a) => acompanhamentos?.itens?.[a])}
          itens={acompanhamentos?.itens || {}} receitas={receitas}
          carrinho={sem.compras_acompanhamentos?.[d] || {}}
          marcar={(item, itens) => acoes.marcarAcomp(d, item, itens)}
          editar={() => ir.acompanhamentos(d, { editando: true })} />
      )}
      <p className="nota">Receitas sugeridas para 4 pessoas — ajuste ao gosto da casa.</p>
    </Tela>
  );
}

/** Acompanhamentos do dia: cada um com a própria receita (ingredientes e preparo) */
function AcompanhamentosDoDia({ dia, ids, itens, receitas, carrinho, marcar, editar }) {
  const [repetindo, setRepetindo] = useState(null);
  return (
    <section aria-labelledby="acomp-titulo">
      <h2 className="secao" id="acomp-titulo">Acompanhamentos</h2>
      {ids.length === 0 && <p className="nota" style={{ marginTop: 0 }}>Nenhum acompanhamento neste dia.</p>}
      {ids.map((id) => {
        const it = itens[id], r = receitas[id];
        return (
          <details key={id} className="acomp-receita">
            <summary>
              <span className="acomp-nome">{it.nome}</span>
              <span className="acomp-meta">{r.tempo} · {r.ingredientes.length} ingredientes</span>
            </summary>
            {it.descricao && <p className="descricao" style={{ fontSize: 16 }}>{it.descricao}</p>}
            <div className="cabeca-lista" style={{ marginTop: 12 }}>
              <h3 className="acomp-sub" style={{ margin: 0 }}>Ingredientes</h3>
              <span>{(carrinho[id] || []).length} de {r.ingredientes.length} no carrinho</span>
            </div>
            <ul className="ingredientes">
              {r.ingredientes.map((x, k) => {
                const m = carrinho[id] || [], on = m.includes(k);
                return (
                  <li key={k}>
                    <button className="ingrediente" aria-pressed={on}
                      onClick={() => marcar(id, on ? m.filter((y) => y !== k) : [...m, k].sort((a, b) => a - b))}>
                      <span className="caixa"><IcCheck /></span><span>{x}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
            <h3 className="acomp-sub">Modo de preparo</h3>
            <ol className="passos">{r.preparo.map((x, k) => <li key={k}><span>{x}</span></li>)}</ol>
            <div className="acoes-lista" style={{ margin: "4px 0 16px" }}>
              <button className="botao contorno" onClick={() => setRepetindo(id)}>Repetir em outros dias</button>
            </div>
          </details>
        );
      })}
      <div className="acoes-lista">
        <button className="botao contorno" onClick={editar}>{ids.length ? "Adicionar ou remover acompanhamentos" : "Adicionar acompanhamentos"}</button>
      </div>
      {repetindo && <Repetir item={repetindo} nome={itens[repetindo].nome} diaAtual={dia} fechar={() => setRepetindo(null)} />}
    </section>
  );
}
