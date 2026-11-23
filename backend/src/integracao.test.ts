import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import type { Server } from 'node:http';
import { PGlite } from '@electric-sql/pglite';
import pg from 'pg';

// PostgreSQL embarcado: executa o SQL e os triggers reais, sem acessar DATABASE_URL.
const estado = vi.hoisted(() => ({ db: null as unknown as PGlite }));
vi.mock('./database/db.js', () => {
  const query = async (sql: string, params?: unknown[]) => {
    const r = await estado.db.query(sql, params);
    return { ...r, rowCount: r.affectedRows ?? r.rows.length };
  };
  return { pool: { query, connect: async () => ({ query, release() {} }) } };
});
import { createApp } from './app.js';
import { importarProva } from './services/importacao.js';
import { transacao } from './services/questoes.js';

let server: Server;
let url: string;
let tema: number;
let id: number;
let gabarito: number;
const corpo = (extra = {}) => ({ enunciado: 'Quanto é 2 + 2?', idTema: tema, idDificuldade: 1,
  alternativas: [{ letra: 'A', texto: '4', correta: true }, { letra: 'B', texto: '5', correta: false }], ...extra });
async function req(path: string, method = 'GET', body?: unknown) {
  const r = await fetch(url + path, { method, headers: { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body) });
  const text = await r.text();
  return { status: r.status, headers: r.headers, body: r.headers.get('content-type')?.includes('json') ? JSON.parse(text) : text };
}
beforeAll(async () => {
  // Usa os parsers reais do driver de produção: BIGINT e BIGINT[] são strings.
  estado.db = new PGlite({ parsers: { 20: pg.types.getTypeParser(20),
    1016: pg.types.getTypeParser(1016 as Parameters<typeof pg.types.getTypeParser>[0]) } });
  for (const nome of ['001_schema.sql', '002_seed.sql', '003_snapshot.sql'])
    await estado.db.exec(readFileSync(new URL(`./database/migrations/${nome}`, import.meta.url), 'utf8'));
  server = createApp().listen(0, '127.0.0.1');
  await new Promise<void>((resolve) => server.once('listening', resolve));
  url = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
}, 30000);
afterAll(async () => {
  if (server) await new Promise<void>((resolve, reject) => server.close(e => e ? reject(e) : resolve()));
  await estado.db?.close();
});

describe('Auditoria: API + migrações + SQL PostgreSQL', { concurrent: false }, () => {
  it('health e rota inexistente', async () => {
    expect((await req('/health')).body).toEqual({ status: 'ok' });
    expect((await req('/nao-existe')).status).toBe(404);
  });
  it('catálogos iniciais e criação idempotente de tema', async () => {
    const ds = await req('/api/disciplinas');
    expect(ds.body).toHaveLength(4);
    expect((await req('/api/dificuldades')).body).toHaveLength(3);
    const data = { idDisciplina: ds.body.find((d: {nome: string}) => d.nome === 'Matemática').id, nome: ' Aritmética ' };
    const a = await req('/api/temas', 'POST', data);
    expect(a.status).toBe(201); tema = a.body.id;
    expect((await req('/api/temas', 'POST', data)).body.id).toBe(tema);
    expect((await req(`/api/temas?disciplina=${data.idDisciplina}`)).body[0].nome).toBe('Aritmética');
    expect((await req('/api/temas', 'POST', { ...data, nome: ' ' })).status).toBe(400);
  });
  it('cadastro, leitura e filtros', async () => {
    const r = await req('/api/questoes', 'POST', corpo());
    expect(r.status).toBe(201); id = Number(r.body.id);
    expect(r.body.validado).toBe(false);
    expect(r.body.alternativas).toHaveLength(2);
    expect((await req(`/api/questoes/${id}`)).body.enunciado).toBe(corpo().enunciado);
    expect((await req(`/api/questoes?tema=${tema}&validado=false&busca=2`)).body).toHaveLength(1);
    expect((await req('/api/questoes?validado=true')).body).toHaveLength(0);
  });
  it('rejeita filtros inválidos e referências inexistentes como erro de entrada', async () => {
    for (const path of ['/api/questoes?validado=talvez', '/api/questoes?tema=abc', '/api/questoes?limite=0', '/api/questoes?antes=-1'])
      expect((await req(path)).status).toBe(400);
    expect((await req('/api/questoes', 'POST', corpo({ idTema: 999999 }))).status).toBe(400);
    expect((await req('/api/questoes', 'POST', corpo({ alternativas: [
      { letra: 'A', texto: 'a', correta: false }, { letra: 'A', texto: 'b', correta: false },
    ] }))).status).toBe(400);
  });
  it('paginação com cursor mantém ordem e não repete registros', async () => {
    await req('/api/questoes', 'POST', corpo({ enunciado: 'Página extra' }));
    const primeira = await req('/api/questoes?limite=1');
    const cursor = primeira.headers.get('X-Proxima-Pagina');
    expect(cursor).toBeTruthy();
    const segunda = await req(`/api/questoes?limite=1&antes=${cursor}`);
    expect(segunda.body[0].id).toBeLessThan(primeira.body[0].id);
  });
  it('bloqueia gabarito vazio, repetido, inexistente ou não validado', async () => {
    for (const questoes of [[], [id, id], [999999], [id]])
      expect((await req('/api/gabaritos/previa', 'POST', { questoes })).status).toBe(400);
  });
  it('valida, gera prévia, salva histórico e exporta CSV', async () => {
    expect((await req(`/api/questoes/${id}/validar`, 'POST')).body).toEqual({ validado: true, pendencias: [] });
    expect((await req('/api/gabaritos/previa', 'POST', { questoes: [id] })).body).toEqual([{ ordem: 1, idQuestao: id, letra: 'A' }]);
    const g = await req('/api/gabaritos', 'POST', { questoes: [id] });
    expect(g.status).toBe(201); gabarito = g.body.id;
    const csv = await req(`/api/gabaritos/${gabarito}/csv`);
    expect(csv.status).toBe(200);
    expect(csv.headers.get('content-disposition')).toContain(`gabarito-${gabarito}.csv`);
    expect(csv.body).toContain(`1,${id},A\r\n`);
    expect((await req('/api/gabaritos')).body[0].questoes).toBe(1);
    expect((await req('/api/gabaritos/999999/csv')).status).toBe(404);
  });
  it('edição invalida questão e validação aponta pendências', async () => {
    expect((await req(`/api/questoes/${id}`, 'PUT', corpo({ idTema: null }))).body.validado).toBe(false);
    expect((await req(`/api/questoes/${id}/validar`, 'POST')).body.pendencias).toContain('Tema não informado');
    await req(`/api/questoes/${id}`, 'PUT', corpo());
    await req(`/api/questoes/${id}/validar`, 'POST');
  });
  it('detecta duplicatas ignorando caixa e espaços', async () => {
    const dup = await req('/api/questoes', 'POST', corpo({ enunciado: '  QUANTO  É 2 + 2?  ' }));
    expect((await req('/api/questoes/duplicadas')).body.flat().map(Number)).toEqual([id, Number(dup.body.id)]);
  });
  it('rejeita IDs e formatos inválidos; devolve 404 para ausentes', async () => {
    for (const path of ['/api/questoes/abc', '/api/questoes/-1', '/api/gabaritos/abc/csv']) expect((await req(path)).status).toBe(400);
    expect((await req('/api/questoes/999999')).status).toBe(404);
    expect((await req('/api/questoes/999999', 'PUT', corpo())).status).toBe(404);
    expect((await req('/api/questoes/999999/validar', 'POST')).status).toBe(404);
    expect((await req('/api/questoes', 'POST', { enunciado: 1 })).status).toBe(400);
    expect((await req('/api/importacao/enem', 'POST', { ano: 1900 })).status).toBe(400);
  });
  it('rollback desfaz escrita quando operação falha', async () => {
    await expect(transacao(async c => {
      await c.query("INSERT INTO tema (id_disciplina,nome) VALUES (1,'Rollback')");
      throw new Error('teste');
    })).rejects.toThrow('teste');
    expect((await estado.db.query("SELECT * FROM tema WHERE nome='Rollback'")).rows).toHaveLength(0);
  });
  it('trigger invalida alterações diretas nas alternativas e impede gabarito pendente', async () => {
    await estado.db.query('UPDATE alternativa SET texto=$1 WHERE id_questao=$2 AND letra=$3', ['Quatro', id, 'A']);
    expect((await req(`/api/questoes/${id}`)).body.validado).toBe(false);
    await expect(estado.db.query("INSERT INTO gabarito_questao (id_gabarito,id_questao,ordem,letra_correta) VALUES ($1,$2,2,'A')", [gabarito, id])).rejects.toThrow('não está validada');
  });
  it('importa prova com API simulada, ignora repetidas e exige classificação', async () => {
    const fetcher = vi.fn(async () => new Response(JSON.stringify({ metadata: { hasMore: false }, questions: [{
      year: 2023, index: 1, language: null, discipline: 'matematica', title: 'Teste ENEM', context: 'Contexto',
      alternativesIntroduction: 'Escolha', files: [], correctAlternative: 'A',
      alternatives: [{ letter: 'A', text: 'Certa', file: null, isCorrect: true }, { letter: 'B', text: null, file: 'https://example.com/a.png', isCorrect: false }],
    }] }))) as typeof fetch;
    expect(await importarProva(2023, fetcher, 0)).toMatchObject({ ano: 2023, importadas: 1, ignoradas: 0 });
    expect(await importarProva(2023, fetcher, 0)).toMatchObject({ ano: 2023, importadas: 0, ignoradas: 1 });
    const q = (await req('/api/questoes?busca=Contexto')).body[0];
    expect(q.tema).toBe('A classificar');
    expect((await req(`/api/questoes/${q.id}/validar`, 'POST')).body.validado).toBe(false);
  });
  it('migrações podem ser reaplicadas sem perder registros', async () => {
    for (const nome of ['001_schema.sql', '002_seed.sql', '003_snapshot.sql'])
      await estado.db.exec(readFileSync(new URL(`./database/migrations/${nome}`, import.meta.url), 'utf8'));
    expect((await req(`/api/questoes/${id}`)).status).toBe(200);
    expect((await req('/api/disciplinas')).body).toHaveLength(4);
  });
  it('retomada após falha na segunda página não duplica a primeira', async () => {
    const item = (index: number) => ({ year: 2022, index, language: null, discipline: 'matematica',
      title: 'Retomada', context: 'Retomada de importação', files: [], alternativesIntroduction: null,
      correctAlternative: 'A', alternatives: [{ letter: 'A', text: 'Sim', file: null, isCorrect: true }] });
    let falhar = true;
    const fake = vi.fn(async (url: Parameters<typeof fetch>[0]) => {
      const primeira = new URL(String(url)).searchParams.get('offset') === '0';
      if (!primeira && falhar) throw new TypeError('Conexão interrompida');
      return new Response(JSON.stringify({ metadata: { hasMore: primeira }, questions: [item(primeira ? 1 : 2)] }));
    });
    await expect(importarProva(2022, fake as typeof fetch, 0)).rejects.toThrow('Conexão interrompida');
    expect((await req('/api/questoes?busca=Retomada')).body).toHaveLength(1);
    falhar = false;
    expect(await importarProva(2022, fake as typeof fetch, 0)).toMatchObject({ ano: 2022, importadas: 1, ignoradas: 1 });
    expect((await req('/api/questoes?busca=Retomada')).body).toHaveLength(2);
  });
  it('informa divergência no total da fonte e preserva imagens adicionais do enunciado', async () => {
    const fake = vi.fn(async () => new Response(JSON.stringify({ metadata: { hasMore: false, total: 2 }, questions: [{
      year: 2020, index: 99, language: null, discipline: 'matematica', title: 'Imagem adicional', context: 'Analise a figura',
      files: ['https://example.com/figura.png'], alternativesIntroduction: null, correctAlternative: 'A',
      alternatives: [{ letter: 'A', text: 'Resposta', file: null, isCorrect: true }],
    }] })));
    const result = await importarProva(2020, fake as typeof fetch, 0);
    expect(result.avisos[0]).toContain('incompleta');
    const q = (await req('/api/questoes?busca=Analise a figura')).body[0];
    expect(q.enunciado).toContain('https://example.com/figura.png');
  });
  it('REGRESSÃO: importação deveria preservar imagem quando alternativa também tem texto', async () => {
    const fake = vi.fn(async () => new Response(JSON.stringify({ metadata: { hasMore: false }, questions: [{
      year: 2021, index: 1, language: null, discipline: 'matematica', title: 'Imagem', context: 'Imagem com legenda',
      files: [], alternativesIntroduction: null, correctAlternative: 'A',
      alternatives: [{ letter: 'A', text: 'Gráfico A', file: 'https://example.com/grafico.png', isCorrect: true }],
    }] })));
    await importarProva(2021, fake as typeof fetch, 0);
    const q = (await req('/api/questoes?busca=Imagem com legenda')).body[0];
    expect(q.alternativas[0].texto).toContain('https://example.com/grafico.png');
  });

  // Regressões: todas devem passar após as correções.
  it('REGRESSÃO: JSON malformado deveria retornar 400', async () => {
    const r = await fetch(url + '/api/questoes', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{' });
    expect(r.status).toBe(400);
  });
  it('REGRESSÃO: enunciado vazio deveria retornar 400', async () => {
    expect((await req('/api/questoes', 'POST', corpo({ enunciado: ' ' }))).status).toBe(400);
  });
  it('REGRESSÃO: filtro numérico inválido deveria retornar 400', async () => {
    expect((await req('/api/temas?disciplina=abc')).status).toBe(400);
  });
  it('REGRESSÃO: IDs de questões deveriam ser números conforme contrato do frontend', async () => {
    expect(typeof (await req(`/api/questoes/${id}`)).body.id).toBe('number');
  });
  it('REGRESSÃO: alterar resposta não deveria modificar CSV histórico', async () => {
    const antes = (await req(`/api/gabaritos/${gabarito}/csv`)).body;
    await req(`/api/questoes/${id}`, 'PUT', corpo({ alternativas: [
      { letra: 'A', texto: '4', correta: false }, { letra: 'B', texto: '5', correta: true },
    ] }));
    expect((await req(`/api/gabaritos/${gabarito}/csv`)).body).toBe(antes);
  });
});
