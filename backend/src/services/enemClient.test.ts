import { describe, expect, it } from 'vitest';
import { questoesDaProva, type EnemQuestao } from './enemClient.js';
import { idExterno, montarEnunciado } from './importacao.js';

const q = (index: number): EnemQuestao => ({
  title: `Questão ${index}`, index, discipline: 'matematica', language: null, year: 2020,
  context: 'Contexto', files: [], correctAlternative: 'A', alternativesIntroduction: 'Assinale:',
  alternatives: [],
});

describe('enem.dev', () => {
  it('pagina até hasMore = false', async () => {
    const paginas = [
      { metadata: { limit: 50, offset: 0, total: 3, hasMore: true }, questions: [q(1), q(2)] },
      { metadata: { limit: 50, offset: 50, total: 3, hasMore: false }, questions: [q(3)] },
    ];
    let i = 0;
    const fake = (async () => new Response(JSON.stringify(paginas[i++]))) as unknown as typeof fetch;
    const out: number[] = [];
    for await (const x of questoesDaProva(2020, fake, 0)) out.push(x.index);
    expect(out).toEqual([1, 2, 3]);
  });

  it('gera id externo e enunciado', () => {
    expect(idExterno({ year: 2020, index: 5, language: 'ingles' })).toBe('2020-5-ingles');
    expect(montarEnunciado(q(1))).toBe('Contexto\n\nAssinale:');
  });
});
