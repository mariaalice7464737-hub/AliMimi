import { useEffect } from "react";
import { Link, Outlet, useParams } from "react-router-dom";
import { SemanaProvider, lembrarFamilia, useSemanaRemota } from "../estado";

/** Tudo dentro de /f/:codigo — carrega a semana da família e mantém sincronizada */
export default function Familia() {
  const codigo = useParams().codigo.toUpperCase();
  const valor = useSemanaRemota(codigo);

  useEffect(() => { if (valor.sem) lembrarFamilia(codigo); }, [valor.sem, codigo]);

  if (valor.erro === "naoexiste")
    return <p className="load">Não achei a família <b>{codigo}</b>.<br /><Link className="link" to="/?nova" replace>Começar de novo</Link></p>;
  if (!valor.sem)
    return <p className="load">{valor.erro === "offline" ? "Sem conexão. Tentando de novo…" : "Carregando a semana…"}</p>;
  return <SemanaProvider valor={valor}><Outlet /></SemanaProvider>;
}
