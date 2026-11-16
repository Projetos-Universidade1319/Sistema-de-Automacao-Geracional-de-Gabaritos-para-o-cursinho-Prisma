import express, { type ErrorRequestHandler } from 'express';
import cors from 'cors';
import { ZodError } from 'zod';
import { questoesRouter } from './routes/questoes.js';
import { catalogoRouter } from './routes/catalogo.js';
import { gabaritosRouter, importacaoRouter } from './routes/gabaritos.js';
import { ErroNegocio } from './services/gabaritos.js';

export function createApp() {
  const app = express();
  app.use(cors());
  app.use(express.json());
  app.get('/health', (_req, res) => res.json({ status: 'ok' }));
  app.use('/api/questoes', questoesRouter);
  app.use('/api/gabaritos', gabaritosRouter);
  app.use('/api/importacao', importacaoRouter);
  app.use('/api', catalogoRouter);

  const erro: ErrorRequestHandler = (e, _req, res, _next) => {
    if (e instanceof ErroNegocio) return res.status(400).json({ erro: e.message });
    if (e instanceof ZodError) return res.status(400).json({ erro: 'Dados inválidos', detalhes: e.issues });
    console.error(e);
    res.status(500).json({ erro: 'Erro interno' });
  };
  app.use(erro);
  return app;
}
