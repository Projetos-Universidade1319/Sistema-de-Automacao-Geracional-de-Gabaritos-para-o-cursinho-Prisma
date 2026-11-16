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

export async function buscarPagina(
  ano: number, limit: number, offset: number, fetcher: Fetcher = fetch, pausaMs = 1100,
): Promise<EnemPagina> {
  const url = `${ENEM_BASE_URL}/exams/${ano}/questions?limit=${limit}&offset=${offset}`;
  for (let tentativa = 0; tentativa < 4; tentativa++) {
    const r = await fetcher(url);
    if (r.status === 429) {
      const espera = Number(r.headers.get('retry-after') ?? pausaMs);
      await dormir(Math.max(espera, pausaMs));
      continue;
    }
    if (!r.ok) throw new Error(`API ENEM respondeu ${r.status} para o ano ${ano}`);
    return (await r.json()) as EnemPagina;
  }
  throw new Error('API ENEM: limite de requisições excedido');
}

/** Percorre todas as páginas da prova respeitando 1 req/s. */
export async function* questoesDaProva(ano: number, fetcher: Fetcher = fetch, pausaMs = 1100) {
  const limit = 50;
  for (let offset = 0; ; offset += limit) {
    const pagina = await buscarPagina(ano, limit, offset, fetcher, pausaMs);
    yield* pagina.questions;
    if (!pagina.metadata.hasMore) return;
    await dormir(pausaMs);
  }
}
