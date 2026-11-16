import { Router } from 'express';
import { z } from 'zod';
import * as svc from '../services/gabaritos.js';
import { importarProva } from '../services/importacao.js';

export const gabaritosRouter = Router();
const corpo = z.object({ questoes: z.array(z.number().int().positive()) });

gabaritosRouter.post('/previa', async (req, res) => {
  res.json(await svc.previa(corpo.parse(req.body).questoes));
});

gabaritosRouter.post('/', async (req, res) => {
  res.status(201).json(await svc.gerar(corpo.parse(req.body).questoes));
});

gabaritosRouter.get('/', async (_req, res) => res.json(await svc.historico()));

gabaritosRouter.get('/:id/csv', async (req, res) => {
  const id = z.coerce.number().int().positive().parse(req.params.id);
  const l = await svc.linhas(id);
  if (!l.length) return res.status(404).json({ erro: 'Gabarito não encontrado' });
  res.type('text/csv; charset=utf-8')
    .attachment(`gabarito-${id}.csv`)
    .send('﻿' + svc.paraCsv(l));
});

export const importacaoRouter = Router();
importacaoRouter.post('/enem', async (req, res) => {
  const { ano } = z.object({ ano: z.number().int().min(1998).max(2100) }).parse(req.body);
  res.json(await importarProva(ano));
});
