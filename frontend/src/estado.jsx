/* Estado compartilhado: cardápio (fixo), semana da família (sincronizada com o back) e avisos */
import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { api } from "./lib/api";

const CHAVE_FAMILIA = "alimimi-familia";
export const familiaSalva = () => { try { return localStorage.getItem(CHAVE_FAMILIA); } catch { return null; } };
export const lembrarFamilia = (c) => { try { localStorage.setItem(CHAVE_FAMILIA, c); } catch { /* modo privado */ } };

/* ---------- cardápio ---------- */
const CardapioCtx = createContext(null);
export const useCardapio = () => useContext(CardapioCtx);

export function CardapioProvider({ children }) {
  const [dados, setDados] = useState(null);
  const [erro, setErro] = useState(false);
  const carregar = useCallback(() => { setErro(false); api.cardapio().then(setDados).catch(() => setErro(true)); }, []);
  useEffect(carregar, [carregar]);
  if (erro) return <p className="load">Não consegui carregar o cardápio.<br /><button className="link" onClick={carregar}>Tentar de novo</button></p>;
  if (!dados) return <p className="load">Carregando o cardápio…</p>;
  return <CardapioCtx.Provider value={dados}>{children}</CardapioCtx.Provider>;
}

/* ---------- avisos (toast) ---------- */
const AvisoCtx = createContext(() => {});
export const useAviso = () => useContext(AvisoCtx);

export function AvisoProvider({ children }) {
  const [aviso, setAviso] = useState(null);
  const timer = useRef();
  const avisar = useCallback((texto, acao) => {
    clearTimeout(timer.current);
    setAviso({ texto, acao });
    timer.current = setTimeout(() => setAviso(null), acao ? 5000 : 1800);
  }, []);
  return (
    <AvisoCtx.Provider value={avisar}>
      {children}
      <div className={`toast ${aviso ? "on" : ""} ${aviso?.acao ? "act" : ""}`} role="status">
        {aviso && <span>{aviso.texto}</span>}
        {aviso?.acao && <button onClick={() => { setAviso(null); aviso.acao.fazer(); }}>{aviso.acao.rotulo}</button>}
      </div>
    </AvisoCtx.Provider>
  );
}

/* ---------- semana da família ---------- */
const SemanaCtx = createContext(null);
export const useSemana = () => useContext(SemanaCtx);
const INTERVALO = 15000; // busca mudanças feitas em outros celulares

export function useSemanaRemota(codigo) {
  const [sem, setSem] = useState(null);
  const [erro, setErro] = useState(null); // "naoexiste" | "offline"
  const pendentes = useRef(0);
  const avisar = useAviso();

  const buscar = useCallback(async () => {
    if (pendentes.current) return; // não atropela uma mudança ainda sendo salva
    try { setSem(await api.semana(codigo)); setErro(null); }
    catch (e) { setErro(e.status === 404 ? "naoexiste" : "offline"); }
  }, [codigo]);

  useEffect(() => {
    setSem(null); buscar();
    const t = setInterval(() => document.visibilityState === "visible" && buscar(), INTERVALO);
    const aoVoltar = () => document.visibilityState === "visible" && buscar();
    document.addEventListener("visibilitychange", aoVoltar);
    return () => { clearInterval(t); document.removeEventListener("visibilitychange", aoVoltar); };
  }, [buscar]);

  /* muda na tela na hora (otimista) e confirma com o servidor */
  const mudar = useCallback(async (local, chamada) => {
    setSem((s) => local(structuredClone(s)));
    pendentes.current++;
    try { const nova = await chamada(); setSem(nova); setErro(null); }
    catch { avisar("Sem conexão: não salvou. Tente de novo."); pendentes.current--; return buscar(); }
    pendentes.current--;
  }, [avisar, buscar]);

  const acoes = {
    escolher: (dia, pratoId) => mudar((s) => {
      if (s.dias[dia]?.prato_id !== pratoId) delete s.compras[dia];
      s.dias[dia] = { prato_id: pratoId }; return s;
    }, () => api.escolher(codigo, dia, pratoId)),
    pular: (dia) => mudar((s) => { delete s.compras[dia]; s.dias[dia] = { pulado: true }; return s; }, () => api.pular(codigo, dia)),
    marcar: (dia, itens) => mudar((s) => { s.compras[dia] = itens; return s; }, () => api.compras(codigo, dia, itens)),
    substituir: (nova) => mudar(() => structuredClone({ ...sem, dias: nova.dias, compras: nova.compras }), () => api.substituir(codigo, nova)),
  };

  return { sem, erro, acoes, codigo };
}

export function SemanaProvider({ valor, children }) {
  return <SemanaCtx.Provider value={valor}>{children}</SemanaCtx.Provider>;
}
