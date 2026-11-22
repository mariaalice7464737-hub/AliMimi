/* Testes da lista de compras (rodar com: npm test). Usa as receitas reais + itens fictícios de teste. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { listaComoTexto, listaDaSemana, receitasDaSemana } from "./lista.js";

const ler = (p) => JSON.parse(readFileSync(new URL(p, import.meta.url), "utf8"));
const reais = ler("../../../backend/app/dados/receitas.json");
const teste = ler("../../../backend/tests/dados/acompanhamentos_teste.json");
const acomp = Object.fromEntries(teste.grupos.flatMap((g) => g.itens).filter((i) => i.id !== "t_incompleta").map((i) => [i.id, i.receita]));
const receitas = { ...reais, ...acomp };
const item = (grupos, nome) => grupos.flatMap((g) => g.itens).find((x) => x.nome === nome);

test("semana só com proteínas: igual ao cálculo de antes (só os pratos)", () => {
  const sem = { dias: { 0: { prato_id: "carne0" }, 1: { pulado: true }, 2: { prato_id: "frango2" } } };
  assert.deepEqual(receitasDaSemana(sem, receitas), ["carne0", "frango2"]);
  assert.deepEqual(listaDaSemana(receitasDaSemana(sem, receitas), receitas), listaDaSemana(["carne0", "frango2"], receitas));
});

test("acompanhamento entra na lista e soma quando se repete em vários dias", () => {
  const sem = { dias: {
    0: { prato_id: "carne0", acompanhamentos: ["t_arroz"] },
    2: { prato_id: "frango2", acompanhamentos: ["t_arroz", "t_salada"] },
    4: { prato_id: "peixe0", acompanhamentos: ["t_arroz"] },
  } };
  const g = listaDaSemana(receitasDaSemana(sem, receitas), receitas);
  assert.equal(item(g, "Arroz").qtd, "6 xícaras");           // 2 xícaras × 3 dias
  assert.equal(item(g, "Alface").qtd, "1 pé");
  assert.ok(item(g, "Óleo").qtd === "a gosto");              // sem quantidade no original
});

test("unidades incompatíveis não se misturam nem são convertidas", () => {
  const sem = { dias: { 0: { prato_id: "carne0", acompanhamentos: ["t_arroz", "t_baiao"] } } };
  const arroz = item(listaDaSemana(receitasDaSemana(sem, receitas), receitas), "Arroz");
  assert.equal(arroz.qtd, "2 xícaras + 200 g");
});

test("ingrediente comum soma com a proteína quando a unidade é a mesma", () => {
  // carne0 (rosbife) leva 4 dentes de alho; t_arroz 2 e t_feijao 3 → 9 dentes
  const sem = { dias: { 0: { prato_id: "carne0", acompanhamentos: ["t_arroz", "t_feijao"] } } };
  assert.equal(item(listaDaSemana(receitasDaSemana(sem, receitas), receitas), "Alho").qtd, "9 dentes");
});

test("tirar o acompanhamento de um dia não afeta os outros dias", () => {
  const com = { dias: { 0: { prato_id: "carne0", acompanhamentos: ["t_arroz"] }, 2: { prato_id: "frango2", acompanhamentos: ["t_arroz"] } } };
  const sem2 = { dias: { 0: { prato_id: "carne0", acompanhamentos: ["t_arroz"] }, 2: { prato_id: "frango2" } } };
  assert.equal(item(listaDaSemana(receitasDaSemana(com, receitas), receitas), "Arroz").qtd, "4 xícaras");
  assert.equal(item(listaDaSemana(receitasDaSemana(sem2, receitas), receitas), "Arroz").qtd, "2 xícaras");
});

test("dia pulado e acompanhamento sem receita não entram", () => {
  const sem = { dias: { 0: { pulado: true }, 1: { prato_id: "carne0", acompanhamentos: ["t_incompleta", "nao_existe"] } } };
  assert.deepEqual(receitasDaSemana(sem, receitas), ["carne0"]);
});

test("texto copiado traz as seções", () => {
  const sem = { dias: { 0: { prato_id: "carne0", acompanhamentos: ["t_salada"] } } };
  const t = listaComoTexto(listaDaSemana(receitasDaSemana(sem, receitas), receitas));
  assert.match(t, /HORTIFRÚTI[\s\S]*• Alface: 1 pé/);
});
