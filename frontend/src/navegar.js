/* Navegação com URLs de verdade: o voltar do celular, o recarregar e o link compartilhado funcionam */
import { useNavigate } from "react-router-dom";
import { useSemana } from "./estado";
import { pratoDoDia, proximoAberto } from "./lib/dias";

/** há uma tela anterior dentro do app? (o React Router guarda a posição em history.state.idx) */
export const temHistorico = () => (window.history.state?.idx ?? 0) > 0;

export function useIr() {
  const nav = useNavigate();
  const { codigo, sem } = useSemana();
  const base = `/f/${codigo}`;
  const ir = {
    base,
    cardapio: (opts) => nav(base, opts),
    receita: (d, opts) => nav(`${base}/receita/${d}`, opts),
    /* editando = depois de confirmar, volta para a receita do dia em vez de seguir para o próximo */
    categorias: (d, state, opts) => nav(`${base}/dia/${d}`, { state, ...opts }),
    pratos: (d, cat, state) => nav(`${base}/dia/${d}/${cat}`, { state }),
    /** toque num dia da barra ou do cardápio */
    dia: (i, noFluxo = false) =>
      pratoDoDia(sem, i) ? ir.receita(i) : ir.categorias(i, { editando: !noFluxo || proximoAberto(sem) < 0 }),
    /** depois de escolher ou pular: segue para o próximo dia vazio, ou volta para a receita se estava trocando */
    avancar: (semDepois, d, editando, flash) => {
      if (editando) return pratoDoDia(semDepois, d) ? ir.receita(d) : ir.cardapio();
      const nx = proximoAberto(semDepois, d + 1);
      return nx < 0 ? ir.cardapio() : ir.categorias(nx, { flash });
    },
    /** voltar do app = voltar do celular; sem histórico (link aberto direto), vai para `alternativa` */
    voltar: (alternativa) => (temHistorico() ? nav(-1) : nav(alternativa || base, { replace: true })),
  };
  return ir;
}
