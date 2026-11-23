import { Router } from 'express';
import { z } from 'zod';
import { questaoInputSchema } from '../models/questao.js';
import * as svc from '../services/questoes.js';

export const questoesRouter = Router();
const idParam = z.coerce.number().int().positive();

questoesRouter.get('/', async (req, res) => {
  const f = z.object({ disciplina: idParam.optional(), tema: idParam.optional(),
    validado: z.enum(['true', 'false']).transform(v => v === 'true').optional(),
    busca: z.string().max(2000).optional(), antes: idParam.optional(),
    limite: z.coerce.number().int().min(1).max(200).default(200),
  }).parse(req.query);
  const rows = await svc.listar(f);
  if (rows.length === f.limite) res.setHeader('X-Proxima-Pagina', String(rows.at(-1).id));
  res.json(rows);
});

questoesRouter.get('/duplicadas', async (_req, res) => res.json(await svc.duplicadas()));

questoesRouter.get('/:id', async (req, res) => {
  const q = await svc.obter(idParam.parse(req.params.id));
  q ? res.json(q) : res.status(404).json({ erro: 'Questão não encontrada' });
});

questoesRouter.post('/', async (req, res) => {
  res.status(201).json(await svc.criarManual(questaoInputSchema.parse(req.body)));
});

questoesRouter.put('/:id', async (req, res) => {
  const q = await svc.atualizar(idParam.parse(req.params.id), questaoInputSchema.parse(req.body));
  q ? res.json(q) : res.status(404).json({ erro: 'Questão não encontrada' });
});

questoesRouter.post('/:id/validar', async (req, res) => {
  const r = await svc.validar(idParam.parse(req.params.id));
  r ? res.json(r) : res.status(404).json({ erro: 'Questão não encontrada' });
});
