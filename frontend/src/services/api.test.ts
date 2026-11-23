import { afterEach, expect, it, vi } from 'vitest';
import { api } from './api';

afterEach(() => vi.unstubAllGlobals());
it('carrega páginas seguintes sem perder filtros', async () => {
  const fake = vi.fn().mockResolvedValueOnce(new Response('[{"id":3}]', { headers: { 'X-Proxima-Pagina': '3' } }))
    .mockResolvedValueOnce(new Response('[{"id":1}]'));
  vi.stubGlobal('fetch', fake);
  expect(await api.questoes(new URLSearchParams({ validado: 'true' }))).toEqual([{ id: 3 }, { id: 1 }]);
  expect(fake.mock.calls[1][0]).toBe('/api/questoes?validado=true&antes=3');
});
it('todos os métodos usam URL, verbo e corpo esperados', async () => {
  const fake = vi.fn(async () => new Response('[]', { headers: { 'Content-Type': 'application/json' } }));
  vi.stubGlobal('fetch', fake);
  const q = { enunciado: 'Q', idTema: null, idDificuldade: null, alternativas: [] };
  const casos: [() => Promise<unknown>, string, string, unknown?][] = [
    [() => api.questoes(new URLSearchParams({ busca: 'a b' })), '/api/questoes?busca=a+b', 'GET'],
    [() => api.questao(1), '/api/questoes/1', 'GET'],
    [() => api.criar(q), '/api/questoes', 'POST', q],
    [() => api.atualizar(1, q), '/api/questoes/1', 'PUT', q],
    [() => api.validar(1), '/api/questoes/1/validar', 'POST'],
    [() => api.duplicadas(), '/api/questoes/duplicadas', 'GET'],
    [() => api.disciplinas(), '/api/disciplinas', 'GET'],
    [() => api.dificuldades(), '/api/dificuldades', 'GET'],
    [() => api.temas(), '/api/temas', 'GET'],
    [() => api.temas(1), '/api/temas?disciplina=1', 'GET'],
    [() => api.importarEnem(2023), '/api/importacao/enem', 'POST', { ano: 2023 }],
    [() => api.previa([1]), '/api/gabaritos/previa', 'POST', { questoes: [1] }],
    [() => api.gerar([1]), '/api/gabaritos', 'POST', { questoes: [1] }],
    [() => api.historico(), '/api/gabaritos', 'GET'],
  ];
  for (const [call, url, method, body] of casos) {
    await call();
    const args = fake.mock.lastCall as unknown as [string, RequestInit];
    expect(args[0]).toBe(url); expect(args[1].method ?? 'GET').toBe(method);
    expect(args[1].body).toBe(body === undefined ? undefined : JSON.stringify(body));
  }
});
it('propaga mensagem de erro da API', async () => {
  vi.stubGlobal('fetch', vi.fn(async () => new Response('{"erro":"Inválido"}', { status: 400 })));
  await expect(api.questao(1)).rejects.toThrow('Inválido');
});
it('erro não JSON usa status HTTP', async () => {
  vi.stubGlobal('fetch', vi.fn(async () => new Response('indisponível', { status: 503 })));
  await expect(api.questao(1)).rejects.toThrow('Erro 503');
});
