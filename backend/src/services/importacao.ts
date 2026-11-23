import type { PoolClient } from 'pg';
import { ErroFonte, questoesDaProva, type EnemQuestao } from './enemClient.js';
import { transacao } from './questoes.js';

export const TEMA_PENDENTE = 'A classificar';

const DISCIPLINAS: Record<string, string> = {
  linguagens: 'Linguagens',
  matematica: 'Matemática',
  'ciencias-humanas': 'Ciências Humanas',
  'ciencias-natureza': 'Ciências da Natureza',
};

export function idExterno(q: Pick<EnemQuestao, 'year' | 'index' | 'language'>) {
  return `${q.year}-${q.index}${q.language ? '-' + q.language : ''}`;
}

export function montarEnunciado(q: EnemQuestao) {
  const texto = [q.context, q.alternativesIntroduction].filter((t) => t?.trim()).join('\n\n') || q.title;
  return [texto, ...(q.files ?? []).filter(url => !texto.includes(url)).map(url => `![Imagem da questão](${url})`)].join('\n\n');
}

async function importarUma(c: PoolClient, q: EnemQuestao): Promise<boolean> {
  const ins = await c.query(
    `INSERT INTO questao (enunciado, id_origem, id_externo)
     VALUES ($1, (SELECT id_origem FROM origem WHERE nome = 'enem.dev'), $2)
     ON CONFLICT (id_origem, id_externo) DO NOTHING RETURNING id_questao`,
    [montarEnunciado(q), idExterno(q)]);
  if (!ins.rowCount) return false; // já importada
  const id = ins.rows[0].id_questao;

  for (const a of q.alternatives) {
    const texto = [a.text?.trim(), a.file && !a.text?.includes(a.file) ? `![alternativa ${a.letter}](${a.file})` : '']
      .filter(Boolean).join('\n\n') || '(sem texto)';
    await c.query('INSERT INTO alternativa (id_questao, letra, texto, correta) VALUES ($1,$2,$3,$4)',
      [id, a.letter, texto, a.isCorrect]);
  }

  // Metadados provisórios: tema "A classificar" na disciplina de origem; dificuldade a revisar.
  const nomeDisc = q.discipline ? DISCIPLINAS[q.discipline] : undefined;
  if (nomeDisc) {
    await c.query(
      `INSERT INTO tema (id_disciplina, nome)
       SELECT id_disciplina, $2 FROM disciplina WHERE nome = $1 ON CONFLICT DO NOTHING`, [nomeDisc, TEMA_PENDENTE]);
    await c.query(
      `INSERT INTO metadados (id_questao, id_tema, id_dificuldade)
       SELECT $1, t.id_tema, 2 FROM tema t JOIN disciplina d USING (id_disciplina)
       WHERE d.nome = $2 AND t.nome = $3`, [id, nomeDisc, TEMA_PENDENTE]);
  }
  return true;
}

export async function importarProva(ano: number, fetcher?: typeof fetch, pausaMs?: number) {
  let importadas = 0, ignoradas = 0;
  let totalInformado: number | null = null, recebidas = 0;
  const unicas = new Set<string>();
  try {
  for await (const q of questoesDaProva(ano, fetcher, pausaMs, p => { totalInformado = p.metadata.total ?? null; })) {
    recebidas++; unicas.add(idExterno(q));
    (await transacao((c) => importarUma(c, q))) ? importadas++ : ignoradas++;
  }
  } catch (e) {
    if (e instanceof ErroFonte) e.progresso = { ano, importadas, ignoradas };
    throw e;
  }
  const avisos: string[] = [];
  if (totalInformado !== null && unicas.size !== totalInformado)
    avisos.push(`A fonte informou ${totalInformado} questões, mas entregou ${unicas.size} IDs únicos. A importação pode estar incompleta.`);
  if (recebidas !== unicas.size) avisos.push(`A fonte repetiu ${recebidas - unicas.size} registros entre as páginas.`);
  return { ano, importadas, ignoradas, recebidas, unicas: unicas.size, totalInformado, avisos };
}
