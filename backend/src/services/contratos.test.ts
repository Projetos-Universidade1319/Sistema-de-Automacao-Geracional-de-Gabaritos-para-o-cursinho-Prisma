import { afterEach, describe, expect, it, vi } from 'vitest';
import { buscarPagina, questoesDaProva } from './enemClient.js';
import { montarEnunciado, idExterno } from './importacao.js';
import { verificarPendencias } from './validacao.js';
import { questaoInputSchema } from '../models/questao.js';
import { paraCsv } from './gabaritos.js';

afterEach(() => vi.useRealTimers());
describe('Contratos e caminhos de erro', () => {
  it('REGRESSÃO: importações concorrentes deveriam compartilhar limite de uma requisição por segundo', async () => {
    const instantes: number[] = [];
    const fake = vi.fn(async () => {
      instantes.push(performance.now());
      return new Response(JSON.stringify({ metadata: { hasMore: false }, questions: [] }));
    });
    await Promise.all([questoesDaProva(2022, fake).next(), questoesDaProva(2023, fake).next()]);
    expect(instantes[1] - instantes[0]).toBeGreaterThanOrEqual(1000);
  });
  it('REGRESSÃO: chamada de rede deveria ter sinal de cancelamento com timeout', async () => {
    const fake = vi.fn(async (_url: unknown, _init?: RequestInit) => new Response('{}'));
    await buscarPagina(2023, 50, 0, fake as typeof fetch, 0);
    expect(fake.mock.calls[0][1]?.signal).toBeInstanceOf(AbortSignal);
  });
  it('rejeita erro HTTP da fonte', async () => {
    await expect(buscarPagina(2023, 50, 0, vi.fn(async () => new Response('', { status: 503 })), 0)).rejects.toThrow('503');
  });
  it('encerra após quatro respostas 429', async () => {
    const fake = vi.fn(async () => new Response('', { status: 429 }));
    await expect(buscarPagina(2023, 50, 0, fake, 0)).rejects.toThrow('limite');
    expect(fake).toHaveBeenCalledTimes(4);
  });
  it('retenta após 429 e recupera resultado', async () => {
    const fake = vi.fn().mockResolvedValueOnce(new Response('', { status: 429 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ questions: [] })));
    expect(await buscarPagina(2023, 50, 0, fake, 0)).toEqual({ questions: [] });
  });
  it('REGRESSÃO: Retry-After numérico deveria ser interpretado em segundos', async () => {
    vi.useFakeTimers();
    const fake = vi.fn().mockResolvedValueOnce(new Response('', { status: 429, headers: { 'Retry-After': '5' } }))
      .mockResolvedValueOnce(new Response('{}'));
    const promise = buscarPagina(2023, 50, 0, fake, 0);
    await vi.advanceTimersByTimeAsync(100);
    const chamadasAntesDeCincoSegundos = fake.mock.calls.length;
    await vi.runAllTimersAsync(); await promise;
    expect(chamadasAntesDeCincoSegundos).toBe(1);
  });
  it('fallback do enunciado e identidade sem idioma', () => {
    expect(montarEnunciado({ context: ' ', alternativesIntroduction: null, title: 'Título' } as any)).toBe('Título');
    expect(idExterno({ year: 2023, index: 1, language: null })).toBe('2023-1');
  });
  it('aponta alternativas vazias, repetidas e ausência de resposta', () => {
    const pendencias = verificarPendencias({ enunciado: 'Q', idTema: 1, idDificuldade: 1,
      alternativas: [{ letra: 'A', texto: ' ', correta: false }, { letra: 'A', texto: 'B', correta: false }] });
    expect(pendencias).toEqual(['Há alternativa com texto vazio', 'Letras de alternativas repetidas', 'Deve haver exatamente uma alternativa correta']);
  });
  it.each(['Z', 'a', 'AA', ''])('rejeita letra inválida %s', letra => {
    expect(questaoInputSchema.safeParse({ enunciado: 'Q', alternativas: [{ letra, texto: 'T' }] }).success).toBe(false);
  });
  it('aplica defaults e rejeita dificuldade fora do catálogo', () => {
    expect(questaoInputSchema.parse({ enunciado: 'Q' }).alternativas).toEqual([]);
    expect(questaoInputSchema.safeParse({ enunciado: 'Q', idDificuldade: 4 }).success).toBe(false);
  });
  it('CSV vazio mantém cabeçalho e CRLF', () => expect(paraCsv([])).toBe('ordem,id_questao,letra_correta\r\n'));
});
