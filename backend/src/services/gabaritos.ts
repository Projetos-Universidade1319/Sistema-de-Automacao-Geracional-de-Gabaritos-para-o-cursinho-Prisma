import { pool } from '../database/db.js';
import { transacao } from './questoes.js';

export class ErroNegocio extends Error {}

/** Linhas do gabarito (ordem, id da questão, letra correta). */
export async function previa(ids: number[]) {
  if (new Set(ids).size !== ids.length) throw new ErroNegocio('Questão repetida no gabarito');
  if (!ids.length) throw new ErroNegocio('Selecione ao menos uma questão');
  const r = await pool.query(
    `SELECT q.id_questao AS id, q.validado, a.letra
     FROM questao q LEFT JOIN alternativa a ON a.id_questao = q.id_questao AND a.correta
     WHERE q.id_questao = ANY($1::bigint[])`, [ids]);
  const porId = new Map(r.rows.map((x) => [Number(x.id), x]));
  return ids.map((id, i) => {
    const q = porId.get(id);
    if (!q) throw new ErroNegocio(`Questão ${id} não encontrada`);
    if (!q.validado) throw new ErroNegocio(`Questão ${id} não está validada`);
    return { ordem: i + 1, idQuestao: id, letra: q.letra as string };
  });
}

export async function gerar(ids: number[]) {
  const linhas = await previa(ids);
  const id = await transacao(async (c) => {
    const g = await c.query('INSERT INTO gabarito DEFAULT VALUES RETURNING id_gabarito');
    for (const l of linhas) {
      await c.query('INSERT INTO gabarito_questao (id_gabarito, id_questao, ordem) VALUES ($1,$2,$3)',
        [g.rows[0].id_gabarito, l.idQuestao, l.ordem]);
    }
    return Number(g.rows[0].id_gabarito);
  });
  return { id, linhas };
}

export async function linhas(idGabarito: number) {
  return (await pool.query(
    `SELECT gq.ordem, gq.id_questao AS "idQuestao", a.letra
     FROM gabarito_questao gq JOIN alternativa a ON a.id_questao = gq.id_questao AND a.correta
     WHERE gq.id_gabarito = $1 ORDER BY gq.ordem`, [idGabarito])).rows;
}

export async function historico() {
  return (await pool.query(
    `SELECT g.id_gabarito AS id, g.data_hora AS "dataHora", count(gq.id_questao)::int AS questoes
     FROM gabarito g LEFT JOIN gabarito_questao gq USING (id_gabarito)
     GROUP BY g.id_gabarito ORDER BY g.id_gabarito DESC`)).rows;
}

/** CSV UTF-8 com cabeçalho fixo e linhas ordenadas por posição (RNF07). */
export function paraCsv(l: { ordem: number; idQuestao: number | string; letra: string }[]) {
  return ['ordem,id_questao,letra_correta', ...l.map((x) => `${x.ordem},${x.idQuestao},${x.letra}`)].join('\r\n') + '\r\n';
}
