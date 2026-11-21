import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { useSemana } from "../estado";
import { CURTO, DIAS, SEMANA, nomeDia, pratoDoDia, pulado } from "../lib/dias";
import { temHistorico, useIr } from "../navegar";

const IconeVoltar = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M15 5l-7 7 7 7" /></svg>
);

/**
 * Moldura de toda tela da família: cabeçalho vermelho, barra de dias, conteúdo e botões fixos embaixo.
 * dia: dia em foco (null no Cardápio) · voltarPara: rota alternativa do voltar (false = sem botão)
 * noFluxo: a pessoa está montando a semana (tocar num dia vazio segue o fluxo normal)
 */
export default function Tela({ titulo, dia = null, voltarPara, noFluxo = false, rodape, children }) {
  const { sem, erro } = useSemana();
  const ir = useIr();
  const naCardapio = dia === null;
  const mostraVoltar = voltarPara !== false || temHistorico();

  const { pathname } = useLocation();
  useEffect(() => { window.scrollTo(0, 0); }, [pathname]);

  return (
    <div className="app">
      <header>
        <div className="top">
          {mostraVoltar && <button className="ib" aria-label="Voltar" onClick={() => ir.voltar(voltarPara || undefined)}><IconeVoltar /></button>}
          <h1>{titulo ?? (naCardapio ? "Cardápio" : nomeDia(dia))}</h1>
        </div>
        <div className="days">
          {SEMANA.map((i) => {
            const tem = !!pratoDoDia(sem, i), pul = pulado(sem, i), atual = i === dia;
            const c = ["dp", atual && "on", !atual && !tem && "off", tem && "done", pul && "skip"].filter(Boolean).join(" ");
            return (
              <button key={i} className={c} aria-current={atual ? "date" : undefined}
                aria-label={DIAS[i] + (tem ? "" : pul ? " (pulado)" : " (sem prato)")}
                onClick={() => ir.dia(i, noFluxo)}>{CURTO[i]}</button>
            );
          })}
          <button className={`dp menu ${naCardapio ? "on" : ""}`} onClick={() => ir.cardapio()}>Cardápio</button>
        </div>
      </header>
      {erro === "offline" && <div className="offline">Sem conexão. Mostrando a última versão salva.</div>}
      <main><div className="view" key={pathname}>{children}</div></main>
      {rodape && <div className="bar"><div className="in">{rodape}</div></div>}
    </div>
  );
}
