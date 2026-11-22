/* PDFs da semana (gerados no celular). O jsPDF só é baixado quando a pessoa toca em "Baixar". */
import { DIAS, CURTO } from "./dias";
import { listaDaSemana, receitasDaSemana } from "./lista";

/** acompanhamentos do dia que existem no cardápio (com receita) */
const acompDoDia = (sem, i, acomp, receitas) =>
  (sem.dias[i].acompanhamentos || []).filter((id) => acomp?.itens?.[id] && receitas[id]);

const VERMELHO = [165, 72, 55] /* terracota */, TINTA = [33, 28, 24], CINZA = [109, 99, 91], LINHA = [228, 222, 214];
// a fonte padrão do jsPDF não tem travessão, bolinha nem ≈
const ascii = (s) => String(s).replace(/[—–]/g, "-").replace(/[•·]/g, "-").replace(/≈/g, "~");
const semanaCurta = (dias) => dias.map((i) => CURTO[i]).join(", ");

async function novoDoc() {
  const { jsPDF } = await import("jspdf");
  return new jsPDF({ unit: "mm", format: "a4" });
}

function faixa(doc, titulo, sub) {
  doc.setFillColor(...VERMELHO); doc.rect(0, 0, 210, 34, "F"); doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold"); doc.setFontSize(22); doc.text(ascii(titulo), 16, 18);
  doc.setFont("helvetica", "normal"); doc.setFontSize(11); doc.text(ascii(sub), 16, 27);
}

async function comoDataUrl(url) {
  try {
    const blob = await (await fetch(url)).blob();
    return await new Promise((ok, erro) => { const f = new FileReader(); f.onload = () => ok(f.result); f.onerror = erro; f.readAsDataURL(blob); });
  } catch { return null; }
}

/** dias: índices dos dias com prato; sem: semana; cardapio: {pratos, receitas} */
export async function pdfLista(dias, sem, { pratos, receitas, acompanhamentos }) {
  const doc = await novoDoc();
  faixa(doc, "Lista de supermercado", `Almoço da semana - ${dias.length} ${dias.length === 1 ? "prato" : "pratos"} (${semanaCurta(dias)})`);
  let y = 44; doc.setTextColor(...CINZA); doc.setFontSize(10);
  dias.forEach((i) => {
    const extras = acompDoDia(sem, i, acompanhamentos, receitas).map((id) => acompanhamentos.itens[id].nome);
    const linha = doc.splitTextToSize(ascii(`${DIAS[i]}: ${pratos[sem.dias[i].prato_id].nome}${extras.length ? " + " + extras.join(", ") : ""}`), 178);
    doc.text(linha, 16, y); y += linha.length * 5;
  });
  y += 4;
  const pagina = () => { if (y > 280) { doc.addPage(); y = 18; } };
  listaDaSemana(receitasDaSemana(sem, receitas), receitas).forEach((g) => {
    if (y > 262) { doc.addPage(); y = 18; }
    doc.setTextColor(...VERMELHO); doc.setFont("helvetica", "bold"); doc.setFontSize(13); doc.text(ascii(g.secao), 16, y); y += 2;
    doc.setDrawColor(...VERMELHO); doc.setLineWidth(0.4); doc.line(16, y, 194, y); y += 6;
    g.itens.forEach((it) => {
      pagina();
      doc.setDrawColor(...CINZA); doc.setLineWidth(0.3); doc.rect(16, y - 3.6, 4, 4);
      doc.setTextColor(...TINTA); doc.setFont("helvetica", "normal"); doc.setFontSize(11);
      const nm = doc.splitTextToSize(ascii(it.nome), 100); doc.text(nm, 24, y);
      doc.setFont("helvetica", "bold"); const q = doc.splitTextToSize(ascii(it.qtd), 66); doc.text(q, 194, y, { align: "right" });
      y += Math.max(nm.length, q.length) * 5 + 2.2;
      doc.setDrawColor(...LINHA); doc.setLineWidth(0.2); doc.line(24, y - 3.4, 194, y - 3.4);
    });
    y += 5;
  });
  doc.setTextColor(...CINZA); doc.setFont("helvetica", "normal"); doc.setFontSize(9); pagina();
  doc.text(ascii('Quantidades para receitas de 4 porções. "A gosto": confira se já tem em casa.'), 16, Math.min(y + 2, 290));
  return doc.output("blob");
}

export async function pdfCardapio(dias, sem, { pratos, receitas, acompanhamentos }) {
  const doc = await novoDoc();
  const fotos = Object.fromEntries(await Promise.all(dias.map(async (i) => {
    const p = pratos[sem.dias[i].prato_id]; return [p.id, await comoDataUrl(p.img)];
  })));
  faixa(doc, "Cardápio da semana", `${dias.length} ${dias.length === 1 ? "almoço" : "almoços"} (${semanaCurta(dias)}) - receitas para 4 pessoas`);
  let y = 46;
  const novaPagina = (topo) => { doc.addPage(); doc.setFillColor(...VERMELHO); doc.rect(0, 0, 210, 6, "F"); y = topo; };
  const cabe = (h) => { if (y + h > 284) novaPagina(18); };

  dias.forEach((i, n) => {
    const it = pratos[sem.dias[i].prato_id], r = receitas[it.id];
    if (n > 0) {
      doc.setFontSize(11); let h = 82;
      if (r) {
        r.ingredientes.forEach((x) => (h += doc.splitTextToSize(ascii(x), 168).length * 5 + 1.6));
        r.preparo.forEach((x) => (h += doc.splitTextToSize(ascii(x), 164).length * 5 + 3.5));
      }
      if (y + h > 284) novaPagina(22);
      else { doc.setDrawColor(...LINHA); doc.setLineWidth(0.5); doc.line(16, y - 6, 194, y - 6); y += 4; }
    }
    const topo = y;
    if (fotos[it.id]) { try { doc.addImage(fotos[it.id], "JPEG", 152, topo - 5, 42, 42); } catch { /* sem foto */ } }
    doc.setTextColor(...VERMELHO); doc.setFont("helvetica", "bold"); doc.setFontSize(11);
    doc.text(ascii(DIAS[i] + (i < 5 ? "-feira" : "")).toUpperCase(), 16, y);
    doc.setTextColor(...TINTA); doc.setFontSize(18); const t = doc.splitTextToSize(ascii(it.nome), 128); doc.text(t, 16, y + 8); y += 8 + t.length * 7;
    doc.setFont("helvetica", "normal"); doc.setFontSize(10.5); doc.setTextColor(...CINZA);
    const d = doc.splitTextToSize(ascii(it.descricao), 128); doc.text(d, 16, y); y += d.length * 5 + 2;
    if (r) { doc.setFont("helvetica", "bold"); doc.setTextColor(...TINTA); doc.text(ascii(`${r.porcoes} porções  -  ${r.tempo}`), 16, y); }
    const extras = acompDoDia(sem, i, acompanhamentos, receitas);
    if (extras.length) {
      y += 6; doc.setFont("helvetica", "normal"); doc.setFontSize(10.5); doc.setTextColor(...TINTA);
      extras.forEach((id) => { const l = doc.splitTextToSize(ascii("+ " + acompanhamentos.itens[id].nome), 128); doc.text(l, 16, y); y += l.length * 5; });
    }
    y = Math.max(y + 10, topo + 46);
    if (!r) return;
    const titulo = (txt) => {
      cabe(16); doc.setTextColor(...VERMELHO); doc.setFont("helvetica", "bold"); doc.setFontSize(13); doc.text(txt, 16, y); y += 2;
      doc.setDrawColor(...VERMELHO); doc.setLineWidth(0.4); doc.line(16, y, 194, y); y += 7;
    };
    titulo("Ingredientes");
    r.ingredientes.forEach((x) => {
      doc.setFontSize(11); const l = doc.splitTextToSize(ascii(x), 168); cabe(l.length * 5 + 2);
      doc.setDrawColor(...CINZA); doc.setLineWidth(0.3); doc.rect(16, y - 3.6, 4, 4);
      doc.setTextColor(...TINTA); doc.setFont("helvetica", "normal"); doc.text(l, 24, y); y += l.length * 5 + 1.6;
    });
    y += 6; titulo("Modo de preparo");
    r.preparo.forEach((x, k) => {
      doc.setFontSize(11); const l = doc.splitTextToSize(ascii(x), 164); cabe(l.length * 5 + 3);
      doc.setFillColor(...VERMELHO); doc.circle(19, y - 1.3, 3.2, "F"); doc.setTextColor(255, 255, 255);
      doc.setFont("helvetica", "bold"); doc.setFontSize(9); doc.text(String(k + 1), 19, y, { align: "center" });
      doc.setTextColor(...TINTA); doc.setFont("helvetica", "normal"); doc.setFontSize(11); doc.text(l, 26, y); y += l.length * 5 + 3.5;
    });
    extras.forEach((id) => {
      const ra = receitas[id];
      y += 6; cabe(24);
      doc.setTextColor(...CINZA); doc.setFont("helvetica", "bold"); doc.setFontSize(9); doc.text("ACOMPANHAMENTO", 16, y); y += 6;
      doc.setTextColor(...TINTA); doc.setFontSize(14);
      const t = doc.splitTextToSize(ascii(acompanhamentos.itens[id].nome), 178); doc.text(t, 16, y); y += t.length * 6;
      doc.setFont("helvetica", "normal"); doc.setFontSize(10); doc.setTextColor(...CINZA); doc.text(ascii(`${ra.porcoes} porções  -  ${ra.tempo}`), 16, y); y += 7;
      ra.ingredientes.forEach((x) => {
        doc.setFontSize(11); const l = doc.splitTextToSize(ascii(x), 168); cabe(l.length * 5 + 2);
        doc.setDrawColor(...CINZA); doc.setLineWidth(0.3); doc.rect(16, y - 3.6, 4, 4);
        doc.setTextColor(...TINTA); doc.setFont("helvetica", "normal"); doc.text(l, 24, y); y += l.length * 5 + 1.6;
      });
      y += 3;
      ra.preparo.forEach((x, k) => {
        doc.setFontSize(11); const l = doc.splitTextToSize(ascii(x), 164); cabe(l.length * 5 + 3);
        doc.setTextColor(...VERMELHO); doc.setFont("helvetica", "bold"); doc.text(`${k + 1}.`, 17, y);
        doc.setTextColor(...TINTA); doc.setFont("helvetica", "normal"); doc.text(l, 26, y); y += l.length * 5 + 3;
      });
    });
    y += 14;
  });
  return doc.output("blob");
}

/** Compartilhar do celular (WhatsApp, Arquivos…) quando der; senão, download comum */
export async function salvarArquivo(blob, nome) {
  const arquivo = new File([blob], nome, { type: "application/pdf" });
  if (navigator.canShare?.({ files: [arquivo] })) {
    try { await navigator.share({ files: [arquivo], title: nome }); return "Pronto"; }
    catch (e) { if (e.name === "AbortError") return "Envio cancelado"; }
  }
  const url = URL.createObjectURL(blob), a = document.createElement("a");
  a.href = url; a.download = nome; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
  return "Arquivo baixado";
}
