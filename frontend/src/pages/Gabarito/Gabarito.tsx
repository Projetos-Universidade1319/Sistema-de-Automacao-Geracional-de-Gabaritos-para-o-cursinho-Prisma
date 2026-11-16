import { useEffect, useState } from 'react';
import { api, type LinhaGabarito, type Questao } from '../../services/api';

export default function Gabarito() {
  const [disponiveis, setDisponiveis] = useState<Questao[]>([]);
  const [sel, setSel] = useState<Questao[]>([]);
  const [previa, setPrevia] = useState<LinhaGabarito[] | null>(null);
  const [historico, setHistorico] = useState<{ id: number; dataHora: string; questoes: number }[]>([]);
  const [msg, setMsg] = useState<{ texto: string; erro?: boolean } | null>(null);

  const carregarHistorico = () => api.historico().then(setHistorico).catch(() => {});
  useEffect(() => {
    api.questoes(new URLSearchParams({ validado: 'true' })).then(setDisponiveis)
      .catch((e) => setMsg({ texto: e.message, erro: true }));
    carregarHistorico();
  }, []);

  const livres = disponiveis.filter((q) => !sel.some((s) => s.id === q.id));
  const ids = sel.map((q) => q.id);

  function mover(i: number, d: -1 | 1) {
    const j = i + d;
    if (j < 0 || j >= sel.length) return;
    const n = [...sel]; [n[i], n[j]] = [n[j], n[i]];
    setSel(n); setPrevia(null);
  }
  const alterar = (n: Questao[]) => { setSel(n); setPrevia(null); };

  async function verPrevia() {
    try { setPrevia(await api.previa(ids)); setMsg(null); }
    catch (e) { setMsg({ texto: (e as Error).message, erro: true }); }
  }

  async function exportar() {
    try {
      const g = await api.gerar(ids);
      setMsg({ texto: `Gabarito #${g.id} gerado.` });
      carregarHistorico();
      window.location.href = `/api/gabaritos/${g.id}/csv`;
    } catch (e) { setMsg({ texto: (e as Error).message, erro: true }); }
  }

  return (
    <>
      <h2>Montar gabarito</h2>
      {msg && <p className={msg.erro ? 'erro' : 'sucesso'} role="status">{msg.texto}</p>}
      <div className="duas">
        <section>
          <h3>Questões validadas</h3>
          {livres.length === 0 && <p>Nenhuma questão validada disponível.</p>}
          {livres.map((q) => (
            <div className="cartao" key={q.id}>
              <strong>Q-{q.id}</strong> {q.enunciado.slice(0, 90)}…{' '}
              <button onClick={() => alterar([...sel, q])}>Adicionar</button>
            </div>
          ))}
        </section>
        <section>
          <h3>Gabarito atual</h3>
          {sel.map((q, i) => (
            <div className="cartao" key={q.id}>
              {i + 1}. Q-{q.id}{' '}
              <button className="sec" onClick={() => mover(i, -1)} aria-label="Subir">↑</button>
              <button className="sec" onClick={() => mover(i, 1)} aria-label="Descer">↓</button>
              <button className="sec" onClick={() => alterar(sel.filter((s) => s.id !== q.id))}>Remover</button>
            </div>
          ))}
          <div className="barra">
            <button className="sec" disabled={!sel.length} onClick={verPrevia}>Prévia</button>
            <button disabled={!sel.length} onClick={exportar}>Gerar e exportar CSV</button>
          </div>
          {previa && (
            <table>
              <thead><tr><th>Ordem</th><th>Questão</th><th>Letra</th></tr></thead>
              <tbody>{previa.map((l) => <tr key={l.ordem}><td>{l.ordem}</td><td>Q-{l.idQuestao}</td><td>{l.letra}</td></tr>)}</tbody>
            </table>
          )}
        </section>
      </div>
      <h3>Histórico</h3>
      {historico.length === 0 && <p>Nenhum gabarito gerado.</p>}
      <ul>
        {historico.map((h) => (
          <li key={h.id}>
            #{h.id} — {new Date(h.dataHora).toLocaleString('pt-BR')} — {h.questoes} questões{' '}
            <a href={`/api/gabaritos/${h.id}/csv`}>Baixar CSV</a>
          </li>
        ))}
      </ul>
    </>
  );
}
