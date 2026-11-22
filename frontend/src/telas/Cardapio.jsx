import { useState } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import Tela from "../componentes/Tela";
import { useAviso, useCardapio, useSemana } from "../estado";
import { DIAS, SEMANA, escolhidos, proximoAberto } from "../lib/dias";
import { copiar } from "../lib/copiar";
import { listaComoTexto, listaDaSemana } from "../lib/lista";
import { pdfCardapio, pdfLista, salvarArquivo } from "../lib/pdf";
import { useIr } from "../navegar";

const IcCarrinho = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 4h2l2.4 11.2a1 1 0 0 0 1 .8h9.2a1 1 0 0 0 1-.8L20 8H6.2" /><circle cx="9" cy="20" r="1.3" /><circle cx="17" cy="20" r="1.3" /></svg>;
const IcLivro = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 5a2 2 0 0 1 2-2h12v16H6a2 2 0 0 0-2 2z" /><path d="M4 21V5M8 7h6M8 11h6" /></svg>;

export default function Cardapio() {
  const cardapio = useCardapio();
  const { pratos, receitas } = cardapio;
  const { sem, acoes, codigo } = useSemana();
  const avisar = useAviso();
  const ir = useIr();
  const nav = useNavigate();
  const { state } = useLocation();
  const [params, setParams] = useSearchParams();

  const dias = escolhidos(sem), n = dias.length;
  const decididos = SEMANA.filter((i) => sem.dias[i]), abertos = SEMANA.filter((i) => !sem.dias[i]);

  /* janela "Baixar" vira uma entrada no histórico: o voltar do celular fecha a janela */
  const janelaAberta = params.has("baixar");
  const abrirJanela = () => setParams({ baixar: "1" }, { state: { abriuJanela: true } });
  const fecharJanela = () => (state?.abriuJanela ? nav(-1) : setParams({}, { replace: true }));

  function recomecar() {
    const copia = { dias: sem.dias, compras: sem.compras };
    acoes.substituir({ dias: {}, compras: {} });
    avisar("Semana apagada", { rotulo: "Desfazer", fazer: () => acoes.substituir(copia) });
  }

  async function compartilharFamilia() {
    const url = `${location.origin}/f/${codigo}`;
    const texto = `Monta o almoço da semana comigo! Código da família: ${codigo}`;
    if (navigator.share) { try { await navigator.share({ title: "Almoço da Semana", text: texto, url }); return; } catch (e) { if (e.name === "AbortError") return; } }
    copiar(`${texto}\n${url}`, "Link copiado", avisar);
  }

  return (
    <Tela dia={null} voltarPara={false}
      rodape={n
        ? <><button className="ghost" onClick={recomecar}>Recomeçar</button><button className="cta" onClick={abrirJanela}>Baixar</button></>
        : <button className="cta" onClick={() => ir.categorias(Math.max(0, proximoAberto(sem)))}>Montar a semana</button>}>
      <p className="kick">{n ? `${n} ${n === 1 ? "almoço na semana" : "almoços na semana"}` : "Nenhum prato ainda"}</p>
      <h2>Seu cardápio</h2>

      {decididos.length > 0 && <div className="sum">
        {decididos.map((i) => {
          if (sem.dias[i].pulado)
            return <button key={i} className="row" onClick={() => ir.dia(i)}><span className="ph">—</span><span><small>{DIAS[i]}</small><b>Dia pulado</b></span><span className="ed">Escolher</span></button>;
          const p = pratos[sem.dias[i].prato_id];
          return <button key={i} className="row" onClick={() => ir.dia(i)}><img src={p.img} alt="" /><span><small>{DIAS[i]}</small><b>{p.nome}</b></span><span className="ed">Ver</span></button>;
        })}
      </div>}

      {n > 0 ? <>
        <div className="addd" style={{ marginTop: 14 }}>
          <button className="mini" onClick={() => copiar(listaComoTexto(listaDaSemana(dias.map((i) => sem.dias[i].prato_id), receitas)), "Lista da semana copiada", avisar)}>Copiar lista da semana</button>
        </div>
        <p className="note">Toque em um dia para ver a receita e a lista de compras do prato.</p>
      </> : <p className="note">Escolha pelo menos um dia para montar o cardápio.</p>}

      {abertos.length > 0 && <>
        <p className="kick" style={{ marginTop: 22 }}>Ainda sem prato</p>
        <div className="addd">{abertos.map((i) => <button key={i} className="mini" onClick={() => ir.dia(i)}>{DIAS[i]}</button>)}</div>
      </>}

      <div className="fam">
        <span><small>Código da família</small><b>{codigo}</b></span>
        <button className="mini" onClick={compartilharFamilia}>Chamar a família</button>
      </div>

      {janelaAberta && <JanelaBaixar fechar={fecharJanela} gerar={async (tipo) => {
        const blob = tipo === "lista" ? await pdfLista(dias, sem, cardapio) : await pdfCardapio(dias, sem, cardapio);
        return salvarArquivo(blob, tipo === "lista" ? "lista-de-supermercado.pdf" : "cardapio-da-semana.pdf");
      }} />}
    </Tela>
  );
}

function JanelaBaixar({ fechar, gerar }) {
  const avisar = useAviso();
  const [ocupado, setOcupado] = useState(null);
  async function baixar(tipo) {
    setOcupado(tipo);
    try { const msg = await gerar(tipo); fechar(); avisar(msg); }
    catch { avisar("Não foi possível gerar o PDF agora"); }
    finally { setOcupado(null); }
  }
  return (
    <div className="sheet" onClick={(e) => e.target === e.currentTarget && fechar()}>
      <div className="pn" role="dialog" aria-modal="true" aria-labelledby="shT">
        <div className="grab" />
        <h3 id="shT">O que você quer baixar?</h3>
        <p>Os dois arquivos saem em PDF, prontos para imprimir ou mandar no WhatsApp.</p>
        <button className="dlo" disabled={!!ocupado} onClick={() => baixar("lista")}>
          <span className="ic"><IcCarrinho /></span>
          <span><b>{ocupado === "lista" ? "Gerando…" : "Lista de supermercado"}</b><small>Tudo da semana numa lista só, sem repetir: quantidades somadas e separadas por seção.</small></span>
        </button>
        <button className="dlo" disabled={!!ocupado} onClick={() => baixar("cardapio")}>
          <span className="ic"><IcLivro /></span>
          <span><b>{ocupado === "cardapio" ? "Gerando…" : "Cardápio completo"}</b><small>Cada dia com o prato, o modo de preparo e a lista de compras daquele prato.</small></span>
        </button>
        <button className="ghost" onClick={fechar}>Cancelar</button>
      </div>
    </div>
  );
}
