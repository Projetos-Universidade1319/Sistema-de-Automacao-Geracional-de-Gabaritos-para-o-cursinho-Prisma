import type { PoolClient } from 'pg';
import { pool } from '../database/db.js';
import type { QuestaoInput } from '../models/questao.js';
import { verificarPendencias } from './validacao.js';
import { numeroId } from '../models/ids.js';

export interface Filtros { disciplina?: number; tema?: number; validado?: boolean; busca?: string; antes?: number; limite?: number }

const SELECT_BASE = `
  SELECT q.id_questao AS id, q.enunciado, q.validado, q.id_externo AS "idExterno",
         o.nome AS origem, q.dt_atualizacao AS "atualizadaEm",
         m.id_tema AS "idTema", t.nome AS tema, d.id_disciplina AS "idDisciplina", d.nome AS disciplina,
         m.id_dificuldade AS "idDificuldade", df.descricao AS dificuldade,
         COALESCE((SELECT json_agg(json_build_object('letra', a.letra, 'texto', a.texto, 'correta', a.correta)
                   ORDER BY a.letra) FROM alternativa a WHERE a.id_questao = q.id_questao), '[]') AS alternativas
  FROM questao q
  JOIN origem o ON o.id_origem = q.id_origem
  LEFT JOIN metadados m ON m.id_questao = q.id_questao
  LEFT JOIN tema t ON t.id_tema = m.id_tema
  LEFT JOIN disciplina d ON d.id_disciplina = t.id_disciplina
  LEFT JOIN dificuldade df ON df.id_dificuldade = m.id_dificuldade`;

export async function listar(f: Filtros) {
  const where: string[] = []; const v: unknown[] = [];
  if (f.disciplina) { v.push(f.disciplina); where.push(`d.id_disciplina = $${v.length}`); }
  if (f.tema) { v.push(f.tema); where.push(`m.id_tema = $${v.length}`); }
  if (f.validado !== undefined) { v.push(f.validado); where.push(`q.validado = $${v.length}`); }
  if (f.busca) { v.push(`%${f.busca}%`); where.push(`q.enunciado ILIKE $${v.length}`); }
  if (f.antes) { v.push(f.antes); where.push(`q.id_questao < $${v.length}`); }
  v.push(f.limite ?? 200);
  const sql = `${SELECT_BASE} ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY q.id_questao DESC LIMIT $${v.length}`;
  return (await pool.query(sql, v)).rows.map(q => ({ ...q, id: numeroId(q.id) }));
}

export async function obter(id: number, c: Pick<PoolClient, 'query'> = pool) {
  const q = (await c.query(`${SELECT_BASE} WHERE q.id_questao = $1`, [id])).rows[0];
  return q ? { ...q, id: numeroId(q.id) } : null;
}

export async function gravarFilhos(c: PoolClient, id: number, q: QuestaoInput) {
  await c.query('DELETE FROM alternativa WHERE id_questao = $1', [id]);
  for (const a of q.alternativas) {
    await c.query('INSERT INTO alternativa (id_questao, letra, texto, correta) VALUES ($1,$2,$3,$4)',
      [id, a.letra, a.texto, a.correta]);
  }
  if (q.idTema && q.idDificuldade) {
    await c.query(`INSERT INTO metadados (id_questao, id_tema, id_dificuldade) VALUES ($1,$2,$3)
      ON CONFLICT (id_questao) DO UPDATE SET id_tema = EXCLUDED.id_tema, id_dificuldade = EXCLUDED.id_dificuldade`,
      [id, q.idTema, q.idDificuldade]);
  } else {
    await c.query('DELETE FROM metadados WHERE id_questao = $1', [id]);
  }
}

export async function transacao<T>(fn: (c: PoolClient) => Promise<T>): Promise<T> {
  const c = await pool.connect();
  try { await c.query('BEGIN'); const r = await fn(c); await c.query('COMMIT'); return r; }
  catch (e) { await c.query('ROLLBACK'); throw e; }
  finally { c.release(); }
}

export async function criarManual(q: QuestaoInput) {
  const id = await transacao(async (c) => {
    const r = await c.query(
      `INSERT INTO questao (enunciado, id_origem) VALUES ($1, (SELECT id_origem FROM origem WHERE nome = 'manual'))
       RETURNING id_questao`, [q.enunciado]);
    await gravarFilhos(c, r.rows[0].id_questao, q);
    return Number(r.rows[0].id_questao);
  });
  return obter(id);
}

export async function atualizar(id: number, q: QuestaoInput) {
  const ok = await transacao(async (c) => {
    const r = await c.query('UPDATE questao SET enunciado = $2, validado = false WHERE id_questao = $1', [id, q.enunciado]);
    if (!r.rowCount) return false;
    await gravarFilhos(c, id, q);
    return true;
  });
  return ok ? obter(id) : null;
}

export async function validar(id: number) {
  return transacao(async c => {
  await c.query('SELECT id_questao FROM questao WHERE id_questao=$1 FOR UPDATE', [id]);
  const q = await obter(id, c);
  if (!q) return null;
  const pendencias = verificarPendencias({
    enunciado: q.enunciado, idTema: q.idTema, idDificuldade: q.idDificuldade, alternativas: q.alternativas,
  });
  if (q.tema === 'A classificar') pendencias.push('Tema ainda é "A classificar" (importada; revise tema e dificuldade)');
  await c.query('UPDATE questao SET validado = $2 WHERE id_questao = $1', [id, pendencias.length === 0]);
  return { validado: pendencias.length === 0, pendencias };
  });
}

/** RF09: duplicidade por enunciado idêntico (ignorando caixa e espaços). */
export async function duplicadas() {
  return (await pool.query(`
    SELECT array_agg(id_questao ORDER BY id_questao) AS ids
    FROM questao GROUP BY lower(regexp_replace(btrim(enunciado), '\\s+', ' ', 'g'))
    HAVING count(*) > 1`)).rows.map((r) => r.ids.map(numeroId));
}
