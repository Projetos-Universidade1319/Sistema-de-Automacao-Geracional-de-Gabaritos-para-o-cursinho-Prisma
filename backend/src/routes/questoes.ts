import { Router } from 'express';
import { z } from 'zod';
import { questaoInputSchema } from '../models/questao.js';
import * as svc from '../services/questoes.js';

export const questoesRouter = Router();
const idParam = z.coerce.number().int().positive();

questoesRouter.get('/', async (req, res) => {
  const { disciplina, tema, validado, busca } = req.query as Record<string, string | undefined>;
  res.json(await svc.listar({
    disciplina: disciplina ? Number(disciplina) : undefined,
    tema: tema ? Number(tema) : undefined,
    validado: validado === undefined ? undefined : validado === 'true',
    busca,
  }));
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
