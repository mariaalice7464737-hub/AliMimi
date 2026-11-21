export const DIAS = ["Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado", "Domingo"];
export const CURTO = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];
export const SEMANA = [0, 1, 2, 3, 4, 5, 6];

export const nomeDia = (i) => DIAS[i] + (i < 5 ? "-feira" : "");
export const pratoDoDia = (sem, i) => sem.dias[i]?.prato_id || null;
export const pulado = (sem, i) => !!sem.dias[i]?.pulado;

/** próximo dia ainda sem decisão (nem prato, nem pulado) a partir de `de` */
export const proximoAberto = (sem, de = 0) => SEMANA.find((i) => i >= de && !sem.dias[i]) ?? -1;
/** próximo dia com prato a partir de `de` */
export const proximoComPrato = (sem, de = 0) => SEMANA.find((i) => i >= de && pratoDoDia(sem, i)) ?? -1;
/** dias que têm prato escolhido */
export const escolhidos = (sem) => SEMANA.filter((i) => pratoDoDia(sem, i));
