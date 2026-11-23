import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api, type Alternativa, type Opcao } from '../../services/api';
import Conteudo from '../../components/Conteudo';

const LETRAS = 'ABCDEFGHIJ';
const vazia = (): Alternativa[] => ['A', 'B', 'C', 'D', 'E'].map((letra) => ({ letra, texto: '', correta: false }));

export default function Revisao() {
  const { id } = useParams();
  const nav = useNavigate();
  const [enunciado, setEnunciado] = useState('');
  const [alts, setAlts] = useState<Alternativa[]>(vazia());
  const [disc, setDisc] = useState('');
  const [tema, setTema] = useState('');
  const [dif, setDif] = useState('');
  const [disciplinas, setDisciplinas] = useState<Opcao[]>([]);
  const [temas, setTemas] = useState<Opcao[]>([]);
  const [dificuldades, setDificuldades] = useState<Opcao[]>([]);
  const [validado, setValidado] = useState(false);
  const [msg, setMsg] = useState<{ texto: string; erro?: boolean } | null>(null);
  const [pendencias, setPendencias] = useState<string[]>([]);
  const [nomeTema, setNomeTema] = useState('');
  const [salvando, setSalvando] = useState(false);
  const erro = (e: Error) => setMsg({ texto: e.message, erro: true });

  useEffect(() => {
    api.disciplinas().then(setDisciplinas).catch(erro);
    api.dificuldades().then(setDificuldades).catch(erro);
  }, []);
  useEffect(() => {
    let ativo = true;
    api.temas(disc ? Number(disc) : undefined).then(t => { if (ativo) setTemas(t); }).catch(erro);
    return () => { ativo = false; };
  }, [disc]);
  useEffect(() => {
    setMsg(null); setPendencias([]); setNomeTema('');
    if (!id) {
      setEnunciado(''); setAlts(vazia()); setDisc(''); setTema(''); setDif(''); setValidado(false);
      return;
    }
    let ativo = true;
    api.questao(Number(id)).then((q) => {
      if (!ativo) return;
      setEnunciado(q.enunciado); setValidado(q.validado);
      setAlts(q.alternativas.length ? q.alternativas : vazia());
      setDisc(q.idDisciplina ? String(q.idDisciplina) : '');
      setTema(q.idTema ? String(q.idTema) : '');
      setDif(q.idDificuldade ? String(q.idDificuldade) : '');
    }).catch((e) => setMsg({ texto: e.message, erro: true }));
    return () => { ativo = false; };
  }, [id]);

  const corpo = () => ({
    enunciado,
    idTema: tema ? Number(tema) : null,
    idDificuldade: dif ? Number(dif) : null,
    alternativas: alts.filter((a) => a.texto.trim()),
  });

  function marcar(letra: string) { setAlts(alts.map((a) => ({ ...a, correta: a.letra === letra }))); }
  function mudar(letra: string, texto: string) { setAlts(alts.map((a) => (a.letra === letra ? { ...a, texto } : a))); }

  async function salvar(depoisValidar: boolean) {
    if (salvando) return;
    setSalvando(true);
    setMsg(null); setPendencias([]);
    try {
      const q = id ? await api.atualizar(Number(id), corpo()) : await api.criar(corpo());
      setValidado(false);
      if (depoisValidar) {
        const r = await api.validar(q.id);
        setValidado(r.validado); setPendencias(r.pendencias);
        if (!r.validado) { if (!id) nav(`/revisao/${q.id}`); return; }
      }
      setMsg({ texto: depoisValidar ? 'Questão salva e validada.' : 'Questão salva (validação pendente).' });
      if (!id) nav(`/revisao/${q.id}`); else if (depoisValidar) nav('/');
    } catch (e) { setMsg({ texto: (e as Error).message, erro: true }); }
    finally { setSalvando(false); }
  }
  async function criarTema() {
    try {
      const t = await api.criarTema(Number(disc), nomeTema.trim());
      setTemas(await api.temas(Number(disc))); setTema(String(t.id)); setNomeTema('');
      setMsg({ texto: 'Tema criado.' });
    } catch (e) { erro(e as Error); }
  }

  return (
    <>
      <h1>{id ? `Revisar questão Q-${id}` : 'Nova questão'} {id && <small>({validado ? 'validada' : 'pendente'})</small>}</h1>
      <label>Enunciado<textarea rows={6} value={enunciado} onChange={(e) => setEnunciado(e.target.value)} /></label>
      <div className="barra">
        <select value={disc} onChange={(e) => { setDisc(e.target.value); setTema(''); }} aria-label="Disciplina">
          <option value="">Disciplina</option>
          {disciplinas.map((d) => <option key={d.id} value={d.id}>{d.nome}</option>)}
        </select>
        <select value={tema} onChange={(e) => setTema(e.target.value)} aria-label="Tema">
          <option value="">Tema</option>
          {temas.map((t) => <option key={t.id} value={t.id}>{t.nome}</option>)}
        </select>
        <select value={dif} onChange={(e) => setDif(e.target.value)} aria-label="Dificuldade">
          <option value="">Dificuldade</option>
          {dificuldades.map((d) => <option key={d.id} value={d.id}>{d.nome}</option>)}
        </select>
      </div>
      <div className="barra">
        <input aria-label="Nome do novo tema" value={nomeTema} maxLength={120} onChange={e => setNomeTema(e.target.value)} placeholder="Nome do novo tema" />
        <button className="sec" disabled={!disc || !nomeTema.trim()} onClick={criarTema}>Criar tema</button>
      </div>
      {enunciado.includes('![') && <Conteudo texto={enunciado} />}
      <h2>Alternativas (marque a correta)</h2>
      {alts.map((a) => (
        <div className="alt" key={a.letra}>
          <input type="radio" name="correta" checked={a.correta} onChange={() => marcar(a.letra)} aria-label={`Correta: ${a.letra}`} />
          <strong>{a.letra}</strong>
          <input type="text" aria-label={`Texto da alternativa ${a.letra}`} value={a.texto} onChange={(e) => mudar(a.letra, e.target.value)} />
        </div>
      ))}
      {alts.filter(a => a.texto.includes('![')).map(a => <Conteudo key={a.letra} texto={a.texto} />)}
      {alts.length < LETRAS.length && (
        <button className="sec" onClick={() => setAlts([...alts, { letra: [...LETRAS].find(l => !alts.some(a => a.letra === l))!, texto: '', correta: false }])}>
          + alternativa
        </button>
      )}
      {pendencias.length > 0 && (
        <ul className="erro">{pendencias.map((p) => <li key={p}>{p}</li>)}</ul>
      )}
      {msg && <p className={msg.erro ? 'erro' : 'sucesso'} role="status">{msg.texto}</p>}
      <div className="barra" style={{ marginTop: 12 }}>
        <button className="sec" disabled={salvando} onClick={() => salvar(false)}>Salvar</button>
        <button disabled={salvando} onClick={() => salvar(true)}>Salvar e validar</button>
        <button className="sec" onClick={() => nav('/')}>Voltar</button>
      </div>
    </>
  );
}
