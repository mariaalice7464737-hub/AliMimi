import { useState } from "react";
import { Navigate, useLocation, useParams } from "react-router-dom";
import Tela from "../componentes/Tela";
import { IcCheck, IcLista, IcRelogio } from "../componentes/Ilustracoes";
import { useCardapio, useSemana } from "../estado";
import { DIAS, SEMANA, pratoDoDia, proximoAberto } from "../lib/dias";
import { useIr } from "../navegar";

export default function Pratos() {
  const { dia, cat } = useParams();
  const d = Number(dia);
  const { state } = useLocation();
  const { categorias, pratos, receitas } = useCardapio();
  const { sem, acoes } = useSemana();
  const ir = useIr();
  const [sel, setSel] = useState(() => pratoDoDia(sem, d));
  const categoria = categorias.find((c) => c.id === cat);
  if (!categoria || !(d >= 0 && d <= 6)) return <Navigate to={ir.base} replace />;

  const editando = !!state?.editando;
  const usadoEm = (id) => SEMANA.filter((i) => i !== d && pratoDoDia(sem, i) === id).map((i) => DIAS[i].toLowerCase());

  const semDepois = { ...sem, dias: { ...sem.dias, [d]: { prato_id: sel } } };
  const nx = editando ? -1 : proximoAberto(semDepois, d + 1);
  const rotulo = !sel ? "Toque em um prato"
    : ir.temAcompanhamentos() ? "Confirmar e escolher acompanhamentos"
    : nx < 0 ? "Confirmar e ver a semana" : `Confirmar e ir para ${DIAS[nx].toLowerCase()}`;

  function confirmar() {
    acoes.escolher(d, sel);
    ir.depoisDaProteina(semDepois, d, editando, `${DIAS[d]}: ${pratos[sel].nome}`);
  }

  return (
    <Tela dia={d} noFluxo={!editando} voltarPara={`${ir.base}/dia/${d}`}
      rodape={<button className="botao principal" disabled={!sel} onClick={confirmar}>{rotulo}</button>}>
      <p className="sobrelinha">{DIAS[d]} · {categoria.nome}</p>
      <h1 className="titulo">Escolha <em>o prato</em></h1>
      <p className="sub">Toque na foto para ver os ingredientes antes de confirmar.</p>
      <ul className="pratos">
        {categoria.pratos.map((id) => {
          const p = pratos[id], r = receitas[id], u = usadoEm(id), on = sel === id;
          return (
            <li key={id}>
              <button className={`prato ${on ? "sel" : ""}`} aria-pressed={on}
                onClick={(e) => { setSel(id); e.currentTarget.scrollIntoView({ block: "nearest", behavior: "smooth" }); }}>
                <img src={p.img} alt="" loading="lazy" />
                <span>
                  <span className="prato-nome">{p.nome}</span>
                  <span className="prato-desc">{p.descricao}</span>
                  <span className="meta">
                    {r && <span><IcRelogio />{r.tempo}</span>}
                    {r && <span><IcLista />{r.ingredientes.length} ingredientes</span>}
                    {u.length > 0 && <span className="ja-escolhido">Já na {u.join(", ")}</span>}
                    <span className="selo"><IcCheck />Escolhido</span>
                  </span>
                </span>
                {r && <span className="previa"><b>Vai precisar de</b>{r.ingredientes.join(" · ")}</span>}
              </button>
            </li>
          );
        })}
      </ul>
    </Tela>
  );
}
