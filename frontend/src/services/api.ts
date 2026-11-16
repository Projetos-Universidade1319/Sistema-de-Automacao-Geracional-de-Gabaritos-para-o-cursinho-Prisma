export interface Alternativa { letra: string; texto: string; correta: boolean }
export interface Questao {
  id: number; enunciado: string; validado: boolean; origem: string;
  idTema: number | null; tema: string | null; idDisciplina: number | null; disciplina: string | null;
  idDificuldade: number | null; dificuldade: string | null; alternativas: Alternativa[];
}
export interface Opcao { id: number; nome: string; idDisciplina?: number }
export interface LinhaGabarito { ordem: number; idQuestao: number; letra: string }
export interface QuestaoInput {
  enunciado: string; idTema: number | null; idDificuldade: number | null; alternativas: Alternativa[];
}

async function req<T>(url: string, init?: RequestInit): Promise<T> {
  const r = await fetch(url, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...init?.headers },
  });
  const corpo = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(corpo.erro ?? `Erro ${r.status}`);
  return corpo as T;
}
const post = <T,>(url: string, body?: unknown) =>
  req<T>(url, { method: 'POST', body: body === undefined ? undefined : JSON.stringify(body) });

export const api = {
  questoes: (qs: URLSearchParams) => req<Questao[]>(`/api/questoes?${qs}`),
  questao: (id: number) => req<Questao>(`/api/questoes/${id}`),
  criar: (q: QuestaoInput) => post<Questao>('/api/questoes', q),
  atualizar: (id: number, q: QuestaoInput) =>
    req<Questao>(`/api/questoes/${id}`, { method: 'PUT', body: JSON.stringify(q) }),
  validar: (id: number) => post<{ validado: boolean; pendencias: string[] }>(`/api/questoes/${id}/validar`),
  duplicadas: () => req<number[][]>('/api/questoes/duplicadas'),
  disciplinas: () => req<Opcao[]>('/api/disciplinas'),
  dificuldades: () => req<Opcao[]>('/api/dificuldades'),
  temas: (disciplina?: number) => req<Opcao[]>(`/api/temas${disciplina ? `?disciplina=${disciplina}` : ''}`),
  importarEnem: (ano: number) =>
    post<{ importadas: number; ignoradas: number }>('/api/importacao/enem', { ano }),
  previa: (questoes: number[]) => post<LinhaGabarito[]>('/api/gabaritos/previa', { questoes }),
  gerar: (questoes: number[]) => post<{ id: number; linhas: LinhaGabarito[] }>('/api/gabaritos', { questoes }),
  historico: () => req<{ id: number; dataHora: string; questoes: number }[]>('/api/gabaritos'),
};
