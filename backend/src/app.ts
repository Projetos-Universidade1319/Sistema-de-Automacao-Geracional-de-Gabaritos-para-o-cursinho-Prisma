import express, { type ErrorRequestHandler } from 'express';
import cors from 'cors';
import { ZodError } from 'zod';
import { questoesRouter } from './routes/questoes.js';
import { catalogoRouter } from './routes/catalogo.js';
import { gabaritosRouter, importacaoRouter } from './routes/gabaritos.js';
import { ErroNegocio } from './services/gabaritos.js';
import { ErroFonte } from './services/enemClient.js';

export function createApp() {
  const app = express();
  app.use(cors({ exposedHeaders: ['X-Proxima-Pagina'] }));
  app.use(express.json());
  app.get('/health', (_req, res) => res.json({ status: 'ok' }));
  app.use('/api/questoes', questoesRouter);
  app.use('/api/gabaritos', gabaritosRouter);
  app.use('/api/importacao', importacaoRouter);
  app.use('/api', catalogoRouter);

  const erro: ErrorRequestHandler = (e, _req, res, _next) => {
    if (e instanceof ErroFonte) return res.status(502).json({ erro: e.message, progresso: e.progresso });
    if (e instanceof ErroNegocio) return res.status(400).json({ erro: e.message });
    if (e instanceof ZodError) return res.status(400).json({ erro: 'Dados inválidos', detalhes: e.issues });
    if (e.type === 'entity.parse.failed') return res.status(400).json({ erro: 'JSON inválido' });
    if (e.type === 'entity.too.large') return res.status(413).json({ erro: 'Requisição muito grande' });
    if (['23503', '23505', '23514', '23502'].includes(e.code))
      return res.status(400).json({ erro: 'Dados inconsistentes: confira referências, textos e alternativas' });
    if (['ECONNREFUSED', 'ECONNRESET', '57P01', '57P02', '57P03'].includes(e.code))
      return res.status(503).json({ erro: 'Banco temporariamente indisponível. Tente novamente.' });
    console.error(e);
    res.status(500).json({ erro: 'Erro interno' });
  };
  app.use(erro);
  return app;
}
