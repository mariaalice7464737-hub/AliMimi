import { useState } from "react";
import { Navigate, useLocation, useParams } from "react-router-dom";
import Tela from "../componentes/Tela";
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
  const rotulo = !sel ? "Toque em um prato" : nx < 0 ? "Confirmar e ver a semana" : `Confirmar e ir para ${DIAS[nx].toLowerCase()}`;

  function confirmar() {
    acoes.escolher(d, sel);
    ir.avancar(semDepois, d, editando, `${DIAS[d]}: ${pratos[sel].nome}`);
  }

  return (
    <Tela dia={d} noFluxo={!editando} voltarPara={`${ir.base}/dia/${d}`}
      rodape={<button className="cta" disabled={!sel} onClick={confirmar}>{rotulo}</button>}>
      <p className="kick">{DIAS[d]} · {categoria.nome}</p>
      <h2>Escolha o prato</h2>
      <div className="list">
        {categoria.pratos.map((id) => {
          const p = pratos[id], r = receitas[id], u = usadoEm(id), on = sel === id;
          return (
            <button key={id} className={`dish ${on ? "sel" : ""}`} aria-pressed={on}
              onClick={(e) => { setSel(id); e.currentTarget.scrollIntoView({ block: "nearest", behavior: "smooth" }); }}>
              <img src={p.img} alt="" loading="lazy" />
              <div>
                <b>{p.nome}</b>
                <span>{p.descricao}</span>
                {r && <small className="dm">{r.tempo} · {r.ingredientes.length} ingredientes</small>}
                {u.length > 0 && <em>Já na {u.join(", ")}</em>}
              </div>
              {r && <span className="peek"><b>Vai precisar de</b>{r.ingredientes.join(" · ")}</span>}
            </button>
          );
        })}
      </div>
    </Tela>
  );
}
