import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, type Opcao, type Questao } from '../../services/api';

export default function Biblioteca() {
  const [questoes, setQuestoes] = useState<Questao[]>([]);
  const [disciplinas, setDisciplinas] = useState<Opcao[]>([]);
  const [temas, setTemas] = useState<Opcao[]>([]);
  const [duplicadas, setDuplicadas] = useState<Set<number>>(new Set());
  const [f, setF] = useState({ busca: '', disciplina: '', tema: '', validado: '' });
  const [ano, setAno] = useState('2023');
  const [msg, setMsg] = useState<{ texto: string; erro?: boolean } | null>(null);
  const [importando, setImportando] = useState(false);

  const carregar = useCallback(async () => {
    const qs = new URLSearchParams();
    Object.entries(f).forEach(([k, v]) => v && qs.set(k, v));
    try {
      setQuestoes(await api.questoes(qs));
      setDuplicadas(new Set((await api.duplicadas()).flat()));
    } catch (e) { setMsg({ texto: (e as Error).message, erro: true }); }
  }, [f]);

  useEffect(() => { carregar(); }, [carregar]);
  useEffect(() => { api.disciplinas().then(setDisciplinas).catch(() => {}); }, []);
  useEffect(() => {
    api.temas(f.disciplina ? Number(f.disciplina) : undefined).then(setTemas).catch(() => {});
  }, [f.disciplina]);

  async function importar() {
    setImportando(true); setMsg({ texto: 'Importando… (a API limita 1 requisição/s; pode demorar)' });
    try {
      const r = await api.importarEnem(Number(ano));
      setMsg({ texto: `Importadas: ${r.importadas}; já existentes: ${r.ignoradas}` });
      carregar();
    } catch (e) { setMsg({ texto: `Falha na importação: ${(e as Error).message}. Use o cadastro manual.`, erro: true }); }
    finally { setImportando(false); }
  }

  return (
    <>
      <h2>Biblioteca de questões</h2>
      <div className="barra">
        <input placeholder="Buscar no enunciado" value={f.busca} onChange={(e) => setF({ ...f, busca: e.target.value })} />
        <select value={f.disciplina} onChange={(e) => setF({ ...f, disciplina: e.target.value, tema: '' })}>
          <option value="">Todas as disciplinas</option>
          {disciplinas.map((d) => <option key={d.id} value={d.id}>{d.nome}</option>)}
        </select>
        <select value={f.tema} onChange={(e) => setF({ ...f, tema: e.target.value })}>
          <option value="">Todos os temas</option>
          {temas.map((t) => <option key={t.id} value={t.id}>{t.nome}</option>)}
        </select>
        <select value={f.validado} onChange={(e) => setF({ ...f, validado: e.target.value })}>
          <option value="">Qualquer estado</option>
          <option value="true">Validadas</option>
          <option value="false">Pendentes</option>
        </select>
      </div>
      <div className="barra">
        <input type="number" value={ano} onChange={(e) => setAno(e.target.value)} style={{ width: 90 }} aria-label="Ano da prova" />
        <button onClick={importar} disabled={importando}>Importar ENEM (enem.dev)</button>
        <Link to="/revisao"><button className="sec">Cadastrar manualmente</button></Link>
      </div>
      {msg && <p className={msg.erro ? 'erro' : 'sucesso'} role="status">{msg.texto}</p>}
      {questoes.length === 0 && <p>Nenhuma questão encontrada.</p>}
      {questoes.map((q) => (
        <div className="cartao" key={q.id}>
          <strong>Q-{q.id}</strong>{' '}
          <span className={`selo ${q.validado ? 'ok' : ''}`}>{q.validado ? 'Validada' : 'Pendente'}</span>{' '}
          {duplicadas.has(q.id) && <span className="selo">Possível duplicada</span>}
          {q.alternativas.length < 2 && <span className="selo"> Incompleta</span>}
          <p>{q.enunciado.slice(0, 200)}{q.enunciado.length > 200 && '…'}</p>
          <small>{q.disciplina ?? 'Sem disciplina'} · {q.tema ?? 'Sem tema'} · {q.dificuldade ?? '—'} · {q.origem}</small>{' '}
          <Link to={`/revisao/${q.id}`}>Revisar</Link>
        </div>
      ))}
    </>
  );
}
