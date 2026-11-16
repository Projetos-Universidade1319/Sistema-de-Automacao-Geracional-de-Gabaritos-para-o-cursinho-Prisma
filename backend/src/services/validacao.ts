import type { QuestaoInput } from '../models/questao.js';

/** Regras de integridade do RF04. Retorna a lista de pendências (vazia = válida). */
export function verificarPendencias(q: QuestaoInput): string[] {
  const p: string[] = [];
  if (!q.enunciado?.trim()) p.push('Enunciado vazio');
  if (!q.idTema) p.push('Tema não informado');
  if (!q.idDificuldade) p.push('Dificuldade não informada');
  const alts = q.alternativas ?? [];
  if (alts.length < 2) p.push('São necessárias pelo menos duas alternativas');
  if (alts.some((a) => !a.texto.trim())) p.push('Há alternativa com texto vazio');
  if (new Set(alts.map((a) => a.letra)).size !== alts.length) p.push('Letras de alternativas repetidas');
  const corretas = alts.filter((a) => a.correta).length;
  if (corretas !== 1) p.push('Deve haver exatamente uma alternativa correta');
  return p;
}
