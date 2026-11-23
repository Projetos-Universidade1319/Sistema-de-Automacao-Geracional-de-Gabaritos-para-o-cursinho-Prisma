/** Cliente da API pública https://docs.enem.dev (1 req/s sem cache; sem autenticação). */
export const ENEM_BASE_URL = process.env.ENEM_API_URL ?? 'https://api.enem.dev/v1';

export interface EnemAlternativa { letter: string; text: string | null; file: string | null; isCorrect: boolean }
export interface EnemQuestao {
  title: string;
  index: number;
  discipline: string | null;
  language: string | null;
  year: number;
  context: string | null;
  files: string[];
  correctAlternative: string;
  alternativesIntroduction: string | null;
  alternatives: EnemAlternativa[];
}
export interface EnemPagina {
  metadata: { limit: number; offset: number; total: number; hasMore: boolean };
  questions: EnemQuestao[];
}

type Fetcher = typeof fetch;
const dormir = (ms: number) => new Promise((r) => setTimeout(r, ms));
const limites = new WeakMap<Fetcher, { fila: Promise<void>; ultima: number }>();
async function limitar(fetcher: Fetcher, intervalo: number) {
  if (!intervalo) return;
  let estado = limites.get(fetcher);
  if (!estado) { estado = { fila: Promise.resolve(), ultima: 0 }; limites.set(fetcher, estado); }
  const e = estado;
  const espera = e.fila.then(async () => {
    await dormir(Math.max(0, e.ultima + intervalo - Date.now()));
    e.ultima = Date.now();
  });
  e.fila = espera.catch(() => {});
  await espera;
}
export class ErroFonte extends Error {
  constructor(message: string, public progresso?: { ano: number; importadas: number; ignoradas: number }) { super(message); }
}

export async function buscarPagina(
  ano: number, limit: number, offset: number, fetcher: Fetcher = fetch, pausaMs = 1100,
): Promise<EnemPagina> {
  const url = `${ENEM_BASE_URL}/exams/${ano}/questions?limit=${limit}&offset=${offset}`;
  for (let tentativa = 0; tentativa < 4; tentativa++) {
    await limitar(fetcher, pausaMs);
    let r: Response;
    try { r = await fetcher(url, { signal: AbortSignal.timeout(15000) }); }
    catch (e) { throw new ErroFonte(`Falha de conexão com a fonte ENEM: ${(e as Error).message}`); }
    if (r.status === 429) {
      const header = r.headers.get('retry-after');
      const espera = header === null ? pausaMs : /^\d+(\.\d+)?$/.test(header)
        ? Number(header) * 1000 : Math.max(0, Date.parse(header) - Date.now()) || pausaMs;
      if (espera > 60000) throw new ErroFonte('Fonte solicitou espera superior a um minuto. Tente novamente mais tarde.');
      await dormir(Math.max(espera, pausaMs));
      continue;
    }
    if (!r.ok) throw new ErroFonte(`API ENEM respondeu ${r.status} para o ano ${ano}`);
    return (await r.json()) as EnemPagina;
  }
  throw new ErroFonte('API ENEM: limite de requisições excedido');
}

/** Percorre todas as páginas da prova respeitando 1 req/s. */
export async function* questoesDaProva(ano: number, fetcher: Fetcher = fetch, pausaMs = 1100, observar?: (p: EnemPagina) => void) {
  const limit = 50;
  for (let offset = 0; ; offset += limit) {
    const pagina = await buscarPagina(ano, limit, offset, fetcher, pausaMs);
    if (!Array.isArray(pagina.questions) || typeof pagina.metadata?.hasMore !== 'boolean')
      throw new ErroFonte('Resposta inválida da fonte ENEM');
    observar?.(pagina);
    yield* pagina.questions;
    if (!pagina.metadata.hasMore) return;
    if (!pagina.questions.length || offset >= 10000) throw new ErroFonte('Paginação inconsistente da fonte ENEM');
    await dormir(pausaMs);
  }
}
