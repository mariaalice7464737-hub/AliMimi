import { useState } from "react";
import { Navigate, useLocation, useNavigate, useParams, useSearchParams } from "react-router-dom";
import Tela from "../componentes/Tela";
import { IcCheck, IcRelogio, Ramo } from "../componentes/Ilustracoes";
import { useCardapio, useSemana } from "../estado";
import { DIAS, acompanhamentosDoDia, nomeDia, pratoDoDia, proximoAberto } from "../lib/dias";
import { useIr } from "../navegar";

/**
 * Etapa 2 — "O que vai acompanhar?" (escolha opcional, vários por grupo)
 * Etapa 3 — revisão do almoço (?revisar=1): proteína + acompanhamentos, salvar.
 * A seleção fica em rascunho até "Salvar almoço" (ou "Continuar sem acompanhamentos").
 */
export default function Acompanhamentos() {
  const d = Number(useParams().dia);
  const { state } = useLocation();
  const [params, setParams] = useSearchParams();
  const nav = useNavigate();
  const { pratos, receitas, acompanhamentos } = useCardapio();
  const { sem, acoes } = useSemana();
  const ir = useIr();
  const [sel, setSel] = useState(() => acompanhamentosDoDia(sem, d));
  const pratoId = pratoDoDia(sem, d);
  if (!(d >= 0 && d <= 6)) return <Navigate to={ir.base} replace />;
  if (!pratoId) return <Navigate to={`${ir.base}/dia/${d}`} replace />;

  const editando = !!state?.editando;
  const revisando = params.has("revisar");
  const itens = acompanhamentos.itens;
  const grupos = acompanhamentos.grupos.filter((g) => g.itens.length);
  const alternar = (id) => setSel((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  function salvar(lista) {
    acoes.acompanhamentos(d, lista);
    const prato = pratos[pratoId].nome;
    const flash = `${DIAS[d]}: ${prato}${lista.length ? ` + ${lista.length} ${lista.length === 1 ? "acompanhamento" : "acompanhamentos"}` : ""}`;
    if (editando) return ir.receita(d);
    const nx = proximoAberto(sem, d + 1);
    return nx < 0 ? ir.cardapio() : ir.categorias(nx, { flash });
  }
  const voltarEscolha = () => (state?.veioDaEscolha ? nav(-1) : setParams({}, { replace: true, state }));
  function trocarProteina() {
    acoes.acompanhamentos(d, sel); // não perde o que já foi escolhido
    ir.categorias(d, { editando: true });
  }

  /* ---------- etapa 3: revisar ---------- */
  if (revisando) {
    const p = pratos[pratoId];
    return (
      <Tela dia={d} voltarPara={`${ir.base}/dia/${d}/acompanhamentos`}
        rodape={<button className="botao principal" onClick={() => salvar(sel)}>Salvar almoço</button>}>
        <p className="sobrelinha">{nomeDia(d)}</p>
        <h1 className="titulo">Revise <em>o almoço</em></h1>

        <div className="revisao-prato">
          <img src={p.img} alt="" />
          <span>
            <span className="entrada-dia">Prato principal</span>
            <span className="entrada-nome">{p.nome}</span>
            <button className="link" onClick={trocarProteina}>Trocar a proteína</button>
          </span>
        </div>

        {acompanhamentos.grupos.map((g) => {
          const doGrupo = sel.filter((id) => itens[id]?.grupo === g.id);
          return (
            <section key={g.id} className="revisao-grupo">
              <h2 className="secao mini">{g.nome}</h2>
              {doGrupo.length === 0 ? <p className="nota">Nenhum.</p> : (
                <ul className="revisao-lista">
                  {doGrupo.map((id) => (
                    <li key={id}><span>+ {itens[id].nome}</span>
                      <button className="link" onClick={() => alternar(id)} aria-label={`Remover ${itens[id].nome}`}>Remover</button></li>
                  ))}
                </ul>
              )}
            </section>
          );
        })}
        <div className="acoes-lista">
          <button className="botao contorno" onClick={voltarEscolha}>Adicionar ou remover acompanhamentos</button>
        </div>
      </Tela>
    );
  }

  /* ---------- etapa 2: escolher ---------- */
  return (
    <Tela dia={d} voltarPara={`${ir.base}/dia/${d}`}
      rodape={sel.length === 0
        ? <button className="botao contorno cheio" onClick={() => salvar([])}>Continuar sem acompanhamentos</button>
        : <button className="botao principal" onClick={() => setParams({ revisar: "1" }, { state: { ...state, veioDaEscolha: true } })}>
            Revisar almoço · {sel.length} {sel.length === 1 ? "item" : "itens"}
          </button>}>
      <p className="sobrelinha">{DIAS[d]} · {pratos[pratoId].nome}</p>
      <h1 className="titulo">O que vai <em>acompanhar?</em></h1>
      <p className="sub">Complete seu almoço com os acompanhamentos que preferir.</p>

      {grupos.map((g) => (
        <section key={g.id} aria-labelledby={`g-${g.id}`}>
          <h2 className="secao mini" id={`g-${g.id}`}>{g.nome}</h2>
          <ul className="pratos">
            {g.itens.map((id) => {
              const it = itens[id], r = receitas[id], on = sel.includes(id);
              return (
                <li key={id}>
                  <button className={`prato acomp ${on ? "sel" : ""}`} aria-pressed={on} onClick={() => alternar(id)}>
                    {it.img ? <img src={it.img} alt="" loading="lazy" /> : <span className="sem-foto"><Ramo /></span>}
                    <span>
                      <span className="prato-nome">{it.nome}</span>
                      {it.descricao && <span className="prato-desc">{it.descricao}</span>}
                      <span className="meta">
                        {r && <span><IcRelogio />{r.tempo}</span>}
                        <span className={on ? "selo-on" : "selo-off"}>{on ? <><IcCheck />Adicionado</> : "+ Adicionar"}</span>
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </Tela>
  );
}
