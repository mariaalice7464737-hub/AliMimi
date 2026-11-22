import { useState } from "react";
import { Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { familiaSalva, lembrarFamilia, useCardapio } from "../estado";
import { api } from "../lib/api";

const FOTOS = ["carne0", "frango12", "peixe0", "carne12", "suina4", "peixe10"];

/** Só aparece na primeira vez: quem já tem família salva vai direto para o Cardápio */
export default function Inicio() {
  const { pratos } = useCardapio();
  const nav = useNavigate();
  const [params] = useSearchParams();
  const [codigo, setCodigo] = useState("");
  const [erro, setErro] = useState("");
  const [ocupado, setOcupado] = useState(false);

  const salva = familiaSalva();
  if (salva && !params.has("nova")) return <Navigate to={`/f/${salva}`} replace />;

  async function comecar() {
    setOcupado(true); setErro("");
    try {
      const f = await api.criarFamilia();
      lembrarFamilia(f.codigo);
      nav(`/f/${f.codigo}/dia/0`, { replace: true });
    } catch { setErro("Não consegui criar agora. Confira a internet."); setOcupado(false); }
  }

  async function entrar(e) {
    e.preventDefault();
    const c = codigo.trim().toUpperCase();
    if (c.length < 6) return setErro("O código tem 6 letras/números.");
    setOcupado(true); setErro("");
    try { await api.semana(c); lembrarFamilia(c); nav(`/f/${c}`, { replace: true }); }
    catch (err) { setErro(err.status === 404 ? "Não achei essa família. Confira o código." : "Sem conexão agora."); setOcupado(false); }
  }

  return (
    <div className="app">
      <header><div className="top"><h1>Almoço da semana</h1></div></header>
      <main><div className="view">
        <div className="hero">{FOTOS.filter((id) => pratos[id]).map((id) => <img key={id} src={pratos[id].img} alt="" />)}</div>
        <h2>Monte o almoço da semana</h2>
        <p className="lead">Escolha um prato para cada dia (ou pule o dia) e receba a receita e a lista de compras prontas. Toda a família vê a mesma semana.</p>
        <form onSubmit={entrar}>
          <span className="ou">Alguém da família já começou? Digite o código:</span>
          <div className="campo">
            <input value={codigo} onChange={(e) => setCodigo(e.target.value)} maxLength={8} placeholder="EX.: K7QM2P"
              autoCapitalize="characters" autoComplete="off" aria-label="Código da família" />
            <button className="ghost" disabled={ocupado}>Entrar</button>
          </div>
        </form>
        {erro && <p className="erro">{erro}</p>}
      </div></main>
      <div className="bar"><div className="in">
        <button className="cta" onClick={comecar} disabled={ocupado}>Começar uma semana nova</button>
      </div></div>
    </div>
  );
}
