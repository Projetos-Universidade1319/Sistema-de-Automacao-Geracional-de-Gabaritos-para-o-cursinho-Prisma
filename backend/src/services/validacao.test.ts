import { describe, expect, it } from 'vitest';
import { verificarPendencias } from './validacao.js';

const base = {
  enunciado: 'Qual a capital do Brasil?',
  idTema: 1,
  idDificuldade: 1,
  alternativas: [
    { letra: 'A', texto: 'Brasília', correta: true },
    { letra: 'B', texto: 'Rio', correta: false },
  ],
};

describe('verificarPendencias (RF04)', () => {
  it('aceita questão completa', () => expect(verificarPendencias(base)).toEqual([]));
  it('exige enunciado', () => expect(verificarPendencias({ ...base, enunciado: '  ' })).toContain('Enunciado vazio'));
  it('exige tema e dificuldade', () => {
    const p = verificarPendencias({ ...base, idTema: null, idDificuldade: null });
    expect(p).toHaveLength(2);
  });
  it('exige exatamente uma correta', () => {
    const alts = base.alternativas.map((a) => ({ ...a, correta: true }));
    expect(verificarPendencias({ ...base, alternativas: alts })).toContain('Deve haver exatamente uma alternativa correta');
  });
  it('exige ao menos duas alternativas', () =>
    expect(verificarPendencias({ ...base, alternativas: [base.alternativas[0]] })).toContain(
      'São necessárias pelo menos duas alternativas'));
});
