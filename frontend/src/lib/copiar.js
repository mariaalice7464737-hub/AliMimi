export async function copiar(texto, ok, avisar) {
  try { await navigator.clipboard.writeText(texto); avisar(ok); }
  catch { avisar("Não deu para copiar aqui"); }
}
