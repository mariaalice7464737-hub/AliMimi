import { useEffect, useRef } from "react";
import { Navigate, useParams, useSearchParams } from "react-router-dom";
import Tela from "../componentes/Tela";
import { IcCheck, IcCopiar } from "../componentes/Ilustracoes";
import { useAviso, useCardapio, useSemana } from "../estado";
import { DIAS, nomeDia, pratoDoDia, proximoComPrato } from "../lib/dias";
import { copiar } from "../lib/copiar";
import { useIr } from "../navegar";

/* Ordem editorial: nome, foto, descrição, ficha, ingredientes (com o carrinho da família), preparo, ações.
   ?aba=mercado continua valendo: a página abre já nos ingredientes. */
export default function Receita() {
  const d = Number(useParams().dia);
  const [params] = useSearchParams();
  const { pratos, receitas } = useCardapio();
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
      <p className="nota">Receitas sugeridas para 4 pessoas — ajuste ao gosto da casa.</p>
    </Tela>
  );
}
