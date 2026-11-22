import { Navigate, useLocation, useParams } from "react-router-dom";
import Tela from "../componentes/Tela";
import { useCardapio, useSemana } from "../estado";
import { DIAS, acompanhamentosDoDia, escolhidos, nomeDia, pulado } from "../lib/dias";
import { useIr } from "../navegar";

export default function Categorias() {
  const d = Number(useParams().dia);
  const { state } = useLocation();
  const { categorias } = useCardapio();
  const { sem, acoes } = useSemana();
  const ir = useIr();
  if (!(d >= 0 && d <= 6)) return <Navigate to={ir.base} replace />;

  const editando = !!state?.editando;
  const n = escolhidos(sem).length;
  const flash = state?.flash;

  function pular() {
    const n = acompanhamentosDoDia(sem, d).length;
    if (n && !window.confirm(`Pular ${DIAS[d].toLowerCase()} tira o almoço desse dia, inclusive ${n === 1 ? "o acompanhamento escolhido" : `os ${n} acompanhamentos escolhidos`}. Continuar?`)) return;
    acoes.pular(d);
    ir.avancar({ ...sem, dias: { ...sem.dias, [d]: { pulado: true } } }, d, editando, `${DIAS[d]} pulado`);
  }

  return (
    <Tela dia={d} noFluxo={!editando} voltarPara={ir.base}
      rodape={n > 0 && !editando && <button className="botao contorno cheio" onClick={() => ir.cardapio()}>Terminar e ver o cardápio</button>}>
      <p className="sobrelinha">
        {flash ? <span className="ok">✓ {flash}</span> : `${nomeDia(d)}${n ? ` · ${n} ${n === 1 ? "prato escolhido" : "pratos escolhidos"}` : ""}`}
      </p>
      <h1 className="titulo">Qual a proteína de <em>{DIAS[d].toLowerCase()}?</em></h1>
      <p className="sub">
        {pulado(sem, d)
          ? `${DIAS[d]} está pulado. Escolha um prato abaixo para incluir o dia.`
          : <>Sem almoço em casa nesse dia? <button className="link" onClick={pular}>Pular {DIAS[d].toLowerCase()}</button></>}
      </p>
      <div className="cats">
        {categorias.map((c, i) => (
          <button key={c.id} className={`cat ${i === categorias.length - 1 && categorias.length % 2 ? "larga" : ""}`}
            onClick={() => ir.pratos(d, c.id, { editando })}>
            <img src={c.capa} alt="" />
            <span className="cat-rotulo"><b>{c.nome}</b><small>{c.pratos.length} receitas</small></span>
          </button>
        ))}
      </div>
    </Tela>
  );
}
