import { Router } from 'express';
import { z } from 'zod';
import { pool } from '../database/db.js';

export const catalogoRouter = Router();

catalogoRouter.get('/disciplinas', async (_req, res) =>
  res.json((await pool.query('SELECT id_disciplina AS id, nome FROM disciplina ORDER BY nome')).rows));

catalogoRouter.get('/dificuldades', async (_req, res) =>
  res.json((await pool.query('SELECT id_dificuldade AS id, descricao AS nome FROM dificuldade ORDER BY 1')).rows));

catalogoRouter.get('/temas', async (req, res) => {
  const d = req.query.disciplina === undefined ? null : z.coerce.number().int().positive().parse(req.query.disciplina);
  res.json((await pool.query(
    'SELECT id_tema AS id, id_disciplina AS "idDisciplina", nome FROM tema WHERE $1::int IS NULL OR id_disciplina = $1 ORDER BY nome', [d])).rows);
});

catalogoRouter.post('/temas', async (req, res) => {
  const b = z.object({ idDisciplina: z.number().int().positive(), nome: z.string().trim().min(1).max(120) }).parse(req.body);
  const r = await pool.query(
    `INSERT INTO tema (id_disciplina, nome) VALUES ($1,$2)
     ON CONFLICT (id_disciplina, nome) DO UPDATE SET nome = EXCLUDED.nome
     RETURNING id_tema AS id, id_disciplina AS "idDisciplina", nome`, [b.idDisciplina, b.nome]);
  res.status(201).json(r.rows[0]);
});
