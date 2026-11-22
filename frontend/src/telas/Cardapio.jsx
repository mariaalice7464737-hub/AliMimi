import { useState } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import Tela from "../componentes/Tela";
import { IcBaixar, IcCarrinho, IcCopiar, IcLista, IcLivro, MesaPosta, Ramo } from "../componentes/Ilustracoes";
import { useAviso, useCardapio, useSemana } from "../estado";
import { DIAS, SEMANA, escolhidos, proximoAberto } from "../lib/dias";
import { copiar } from "../lib/copiar";
import { listaComoTexto, listaDaSemana } from "../lib/lista";
import { pdfCardapio, pdfLista, salvarArquivo } from "../lib/pdf";
import { useIr } from "../navegar";

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
  const comecar = () => ir.categorias(Math.max(0, proximoAberto(sem)));

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

  const copiarSemana = () =>
    copiar(listaComoTexto(listaDaSemana(dias.map((i) => sem.dias[i].prato_id), receitas)), "Lista da semana copiada", avisar);

  return (
    <Tela dia={null} voltarPara={false}
      rodape={n > 0 && <>
        <button className="botao contorno" onClick={recomecar}>Recomeçar</button>
        <button className="botao principal" onClick={abrirJanela}><IcBaixar />Baixar</button>
      </>}>

      <p className="sobrelinha">Nossa mesa, nossa semana</p>
      <h1 className="titulo">O que vamos comer <em>esta semana?</em></h1>
      <p className="apoio">Uma semana de bons almoços começa com boas escolhas.</p>
      {n > 0 && <p className="contagem">{n} {n === 1 ? "almoço planejado" : "almoços planejados"}</p>}

      {n === 0 && (
        <section className="vazio-estado" aria-labelledby="vazio-titulo">
          <MesaPosta />
          <h2 id="vazio-titulo">Toda boa semana começa à mesa.</h2>
          <p>Escolha os pratos que vão fazer parte dos próximos almoços.</p>
          <button className="botao principal" onClick={comecar}>Começar meu cardápio</button>
        </section>
      )}

      {decididos.length > 0 && (
        <section aria-labelledby="menu-titulo">
          <h2 className="secao" id="menu-titulo">Seu cardápio</h2>
          <ol className="menu">
            {decididos.map((i) => {
              if (sem.dias[i].pulado)
                return (
                  <li key={i}>
                    <button className="entrada" onClick={() => ir.dia(i)}>
                      <span>
                        <span className="entrada-dia">{DIAS[i]}</span>
                        <span className="entrada-nome vazio">Sem almoço em casa</span>
                        <span className="entrada-acao">Escolher um prato</span>
                      </span>
                      <span className="sem-foto"><Ramo /></span>
                    </button>
                  </li>
                );
              const p = pratos[sem.dias[i].prato_id];
              return (
                <li key={i}>
                  <button className="entrada" onClick={() => ir.dia(i)}>
                    <span>
                      <span className="entrada-dia">{DIAS[i]}</span>
                      <span className="entrada-nome">{p.nome}</span>
                      <span className="entrada-acao">Ver receita</span>
                    </span>
                    <img src={p.img} alt="" />
                  </button>
                </li>
              );
            })}
          </ol>
          {n > 0 && (
            <div className="acoes-lista">
              <button className="botao contorno" onClick={copiarSemana}><IcLista />Copiar lista da semana</button>
            </div>
          )}
        </section>
      )}

      {abertos.length > 0 && decididos.length > 0 && (
        <section aria-labelledby="falta-titulo">
          <h2 className="secao mini" id="falta-titulo">Ainda falta escolher</h2>
          <div className="chips">
            {abertos.map((i) => <button key={i} className="chip" onClick={() => ir.dia(i)}>{DIAS[i]}</button>)}
          </div>
        </section>
      )}

      <section className="familia" aria-label="Compartilhar com a família">
        <div>
          <p className="familia-rotulo">Código da família</p>
          <button className="familia-codigo" onClick={() => copiar(codigo, "Código copiado", avisar)} aria-label={`Copiar código ${codigo.split("").join(" ")}`}>
            {codigo}<IcCopiar />
          </button>
        </div>
        <button className="link" onClick={compartilharFamilia}>Chamar a família</button>
      </section>

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
        <button className="botao contorno cheio" onClick={fechar}>Cancelar</button>
      </div>
    </div>
  );
}
