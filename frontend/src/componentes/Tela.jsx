import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { useSemana } from "../estado";
import { CURTO, DIAS, SEMANA, pratoDoDia, pulado } from "../lib/dias";
import { temHistorico, useIr } from "../navegar";
import { IcCardapio, IcVoltar, Ramo } from "./Ilustracoes";

/**
 * Moldura de toda tela da família: cabeçalho creme com a semana, conteúdo e ações fixas embaixo.
 * dia: dia em foco (null no Cardápio) · voltarPara: rota alternativa do voltar (false = sem botão)
 * noFluxo: a pessoa está montando a semana (tocar num dia vazio segue o fluxo normal)
 */
export default function Tela({ dia = null, voltarPara, noFluxo = false, rodape, children }) {
  const { sem, erro } = useSemana();
  const ir = useIr();
  const naCardapio = dia === null;
  const mostraVoltar = voltarPara !== false || temHistorico();

  const { pathname } = useLocation();
  useEffect(() => { window.scrollTo(0, 0); }, [pathname]);

  return (
    <div className={`app ${rodape ? "com-barra" : ""}`}>
      <header className="topo">
        <div className="topo-linha">
          {mostraVoltar && <button className="icone" aria-label="Voltar" onClick={() => ir.voltar(voltarPara || undefined)}><IcVoltar /></button>}
          <button className="marca" aria-label="Almoço da Semana: ir para o cardápio" onClick={() => ir.cardapio()}>Almoço <em>da</em> Semana<Ramo /></button>
          <button className="ir-cardapio" aria-label="Cardápio" aria-current={naCardapio ? "page" : undefined} onClick={() => ir.cardapio()}>
            <IcCardapio /><span className="rotulo-curto">Cardápio</span>
          </button>
        </div>
        <nav className="dias" aria-label="Dias da semana">
          {SEMANA.map((i) => {
            const tem = !!pratoDoDia(sem, i), pul = pulado(sem, i), atual = i === dia;
            const c = ["dia", atual && "atual", tem && "tem", pul && "pulado"].filter(Boolean).join(" ");
            return (
              <button key={i} className={c} aria-current={atual ? "date" : undefined}
                aria-label={DIAS[i] + (tem ? " (prato escolhido)" : pul ? " (pulado)" : " (sem prato)")}
                onClick={() => ir.dia(i, noFluxo)}>{CURTO[i]}</button>
            );
          })}
        </nav>
      </header>
      {erro === "offline" && <div className="offline" role="status">Sem conexão. Mostrando a última versão salva.</div>}
      <main><div className="view" key={pathname}>{children}</div></main>
      {rodape && <div className="bar"><div className="in">{rodape}</div></div>}
    </div>
  );
}
