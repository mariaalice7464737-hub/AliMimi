import { useState } from "react";
import { useAviso, useSemana } from "../estado";
import { DIAS, SEMANA, acompanhamentosDoDia, pratoDoDia, pulado } from "../lib/dias";
import { IcCheck } from "./Ilustracoes";

/**
 * "Repetir em outros dias": escolhe um ou vários dias para receber o mesmo acompanhamento.
 * Só dias com proteína podem ser escolhidos; dia pulado, sem almoço ou que já tem o item ficam desativados.
 * Nada é substituído: o item é acrescentado aos acompanhamentos que o dia já tem.
 */
export default function Repetir({ item, nome, diaAtual, fechar }) {
  const { sem, acoes } = useSemana();
  const avisar = useAviso();
  const [sel, setSel] = useState([]);

  const situacao = (i) =>
    pulado(sem, i) ? "sem almoço" : !pratoDoDia(sem, i) ? "sem prato" : acompanhamentosDoDia(sem, i).includes(item) ? "já tem" : null;
  const dias = SEMANA.filter((i) => i !== diaAtual);
  const alternar = (i) => setSel((s) => (s.includes(i) ? s.filter((x) => x !== i) : [...s, i].sort()));

  function confirmar() {
    acoes.repetir(item, sel);
    const nomes = sel.map((i) => DIAS[i].toLowerCase());
    avisar(`${nome} em ${nomes.length > 1 ? nomes.slice(0, -1).join(", ") + " e " + nomes.at(-1) : nomes[0]}`);
    fechar();
  }

  return (
    <div className="sheet" onClick={(e) => e.target === e.currentTarget && fechar()}>
      <div className="pn" role="dialog" aria-modal="true" aria-labelledby="repT">
        <div className="grab" />
        <h3 id="repT">Repetir em outros dias</h3>
        <p>{nome} vai para os dias que você marcar, junto com o que já foi escolhido.</p>
        <ul className="ingredientes">
          {dias.map((i) => {
            const sit = situacao(i), on = sel.includes(i);
            return (
              <li key={i}>
                <button className="ingrediente" disabled={!!sit} aria-pressed={on} onClick={() => alternar(i)}>
                  <span className="caixa"><IcCheck /></span>
                  <span>{DIAS[i]}{sit && <small className="situacao"> · {sit}</small>}</span>
                </button>
              </li>
            );
          })}
        </ul>
        <div className="acoes-lista" style={{ marginBottom: 4 }}>
          <button className="botao contorno" onClick={fechar}>Cancelar</button>
          <button className="botao principal" style={{ flex: 1 }} disabled={!sel.length} onClick={confirmar}>
            {sel.length ? `Repetir em ${sel.length} ${sel.length === 1 ? "dia" : "dias"}` : "Escolha os dias"}
          </button>
        </div>
      </div>
    </div>
  );
}
