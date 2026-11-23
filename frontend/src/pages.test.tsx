// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import Biblioteca from './pages/Biblioteca/Biblioteca';
import Revisao from './pages/Revisao/Revisao';
import Gabarito from './pages/Gabarito/Gabarito';
import { api } from './services/api';

vi.mock('./services/api', () => ({ api: {
  questoes: vi.fn(), duplicadas: vi.fn(), disciplinas: vi.fn(), dificuldades: vi.fn(), temas: vi.fn(),
  questao: vi.fn(), criar: vi.fn(), atualizar: vi.fn(), validar: vi.fn(), importarEnem: vi.fn(),
  historico: vi.fn(), previa: vi.fn(), gerar: vi.fn(), criarTema: vi.fn(),
} }));
const q = { id: 1, enunciado: 'Quanto é dois mais dois?', validado: true, origem: 'manual',
  idTema: 1, tema: 'Soma', idDisciplina: 1, disciplina: 'Matemática', idDificuldade: 1, dificuldade: 'Fácil',
  alternativas: [{ letra: 'A', texto: '4', correta: true }, { letra: 'B', texto: '5', correta: false }] };
beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(api.questoes).mockResolvedValue([q]);
  vi.mocked(api.duplicadas).mockResolvedValue([[1, 2]]);
  vi.mocked(api.disciplinas).mockResolvedValue([{ id: 1, nome: 'Matemática' }]);
  vi.mocked(api.dificuldades).mockResolvedValue([{ id: 1, nome: 'Fácil' }]);
  vi.mocked(api.temas).mockResolvedValue([{ id: 1, nome: 'Soma' }]);
  vi.mocked(api.questao).mockResolvedValue(q);
  vi.mocked(api.criar).mockResolvedValue(q);
  vi.mocked(api.atualizar).mockResolvedValue(q);
  vi.mocked(api.validar).mockResolvedValue({ validado: true, pendencias: [] });
  vi.mocked(api.historico).mockResolvedValue([]);
});
afterEach(cleanup);
function tela(page: React.ReactNode, path = '/') {
  return render(<MemoryRouter initialEntries={[path]}><Routes>
    <Route path="/" element={page} /><Route path="/revisao" element={<Revisao />} />
    <Route path="/revisao/:id" element={<Revisao />} />
  </Routes></MemoryRouter>);
}
describe('Telas React', () => {
  it('permite criar tema e selecioná-lo para revisão', async () => {
    vi.mocked(api.criarTema).mockResolvedValue({ id: 1, nome: 'Soma' });
    tela(<Revisao />, '/revisao/1'); await screen.findByDisplayValue(q.enunciado);
    fireEvent.change(screen.getByLabelText('Nome do novo tema'), { target: { value: 'Soma' } });
    fireEvent.click(screen.getByText('Criar tema'));
    await screen.findByText('Tema criado.');
    expect(api.criarTema).toHaveBeenCalledWith(1, 'Soma');
  });
  it('biblioteca mostra questões, duplicatas e aplica busca', async () => {
    tela(<Biblioteca />);
    await screen.findByText(q.enunciado);
    expect(screen.getByText('Possível duplicada')).toBeTruthy();
    fireEvent.change(screen.getByPlaceholderText('Buscar no enunciado'), { target: { value: 'dois' } });
    await waitFor(() => expect(vi.mocked(api.questoes).mock.lastCall?.[0].get('busca')).toBe('dois'));
  });
  it('biblioteca apresenta falha de carregamento', async () => {
    vi.mocked(api.questoes).mockRejectedValue(new Error('Sem conexão'));
    tela(<Biblioteca />); await screen.findByText('Sem conexão');
  });
  it('importação apresenta resultado e atualiza biblioteca', async () => {
    vi.mocked(api.importarEnem).mockResolvedValue({ importadas: 2, ignoradas: 1 });
    tela(<Biblioteca />);
    fireEvent.click(screen.getByText('Importar ENEM (enem.dev)'));
    await screen.findByText('Importadas: 2; já existentes: 1');
    expect(api.importarEnem).toHaveBeenCalledWith(2023);
  });
  it('importação mostra falha e reabilita botão', async () => {
    vi.mocked(api.importarEnem).mockRejectedValue(new Error('Fonte indisponível'));
    tela(<Biblioteca />); fireEvent.click(screen.getByText('Importar ENEM (enem.dev)'));
    await screen.findByText(/Falha na importação: Fonte indisponível/);
    expect((screen.getByText('Importar ENEM (enem.dev)') as HTMLButtonElement).disabled).toBe(false);
  });
  it('revisão carrega dados e salva alterações', async () => {
    tela(<Revisao />, '/revisao/1');
    await screen.findByDisplayValue(q.enunciado);
    fireEvent.change(screen.getByLabelText('Enunciado'), { target: { value: 'Novo enunciado' } });
    fireEvent.click(screen.getByText('Salvar'));
    await screen.findByText('Questão salva (validação pendente).');
    expect(api.atualizar).toHaveBeenCalledWith(1, expect.objectContaining({ enunciado: 'Novo enunciado' }));
  });
  it('revisão mostra pendências de validação', async () => {
    vi.mocked(api.validar).mockResolvedValue({ validado: false, pendencias: ['Tema não informado'] });
    tela(<Revisao />, '/revisao/1'); await screen.findByDisplayValue(q.enunciado);
    fireEvent.click(screen.getByText('Salvar e validar')); await screen.findByText('Tema não informado');
  });
  it('cadastro envia formulário e navega para questão criada', async () => {
    tela(<Revisao />, '/revisao');
    fireEvent.change(screen.getByLabelText('Enunciado'), { target: { value: 'Nova' } });
    fireEvent.click(screen.getByText('Salvar'));
    await waitFor(() => expect(api.criar).toHaveBeenCalledWith(expect.objectContaining({ enunciado: 'Nova' })));
    await screen.findByText(/Revisar questão Q-1/);
  });
  it('gabarito seleciona, reordena, exibe prévia e remove', async () => {
    vi.mocked(api.questoes).mockResolvedValue([q, { ...q, id: 2 }]);
    vi.mocked(api.previa).mockResolvedValue([{ ordem: 1, idQuestao: 2, letra: 'A' }]);
    tela(<Gabarito />);
    await screen.findAllByText('Adicionar');
    fireEvent.click(screen.getAllByText('Adicionar')[0]); fireEvent.click(screen.getByText('Adicionar'));
    fireEvent.click(screen.getAllByLabelText('Subir')[1]); fireEvent.click(screen.getByText('Prévia'));
    await waitFor(() => expect(api.previa).toHaveBeenCalledWith([2, 1]));
    await screen.findByRole('table');
    fireEvent.click(screen.getAllByText('Remover')[0]);
    expect(screen.queryByRole('table')).toBeNull();
  });
  it('gabarito vazio desabilita geração', async () => {
    tela(<Gabarito />); await screen.findByText('Adicionar');
    expect((screen.getByText('Gerar e exportar CSV') as HTMLButtonElement).disabled).toBe(true);
  });
  it('falha ao gerar gabarito é apresentada ao usuário', async () => {
    vi.mocked(api.gerar).mockRejectedValue(new Error('Questão não está validada'));
    tela(<Gabarito />); await screen.findByText('Adicionar');
    fireEvent.click(screen.getByText('Adicionar')); fireEvent.click(screen.getByText('Gerar e exportar CSV'));
    await screen.findByText('Questão não está validada');
    expect(api.gerar).toHaveBeenCalledWith([1]);
  });
  it('histórico oferece link para CSV', async () => {
    vi.mocked(api.historico).mockResolvedValue([{ id: 3, dataHora: '2026-11-23T12:00:00Z', questoes: 2 }]);
    tela(<Gabarito />);
    expect((await screen.findByText('Baixar CSV')).getAttribute('href')).toBe('/api/gabaritos/3/csv');
  });
  it('falha na prévia é apresentada', async () => {
    vi.mocked(api.previa).mockRejectedValue(new Error('Prévia indisponível'));
    tela(<Gabarito />); await screen.findByText('Adicionar');
    fireEvent.click(screen.getByText('Adicionar')); fireEvent.click(screen.getByText('Prévia'));
    await screen.findByText('Prévia indisponível');
  });
  it('falha no salvamento é apresentada', async () => {
    vi.mocked(api.atualizar).mockRejectedValue(new Error('Erro ao salvar'));
    tela(<Revisao />, '/revisao/1'); await screen.findByDisplayValue(q.enunciado);
    fireEvent.click(screen.getByText('Salvar')); await screen.findByText('Erro ao salvar');
  });
  it('revisão permite editar resposta e classificação', async () => {
    tela(<Revisao />, '/revisao/1'); await screen.findByDisplayValue(q.enunciado);
    fireEvent.click(screen.getByLabelText('Correta: B'));
    fireEvent.change(screen.getByDisplayValue('5'), { target: { value: 'Cinco' } });
    fireEvent.change(screen.getByLabelText('Disciplina'), { target: { value: '1' } });
    fireEvent.change(screen.getByLabelText('Tema'), { target: { value: '1' } });
    fireEvent.change(screen.getByLabelText('Dificuldade'), { target: { value: '1' } });
    fireEvent.click(screen.getByText('Salvar'));
    await waitFor(() => expect(api.atualizar).toHaveBeenCalledWith(1, expect.objectContaining({
      alternativas: [{ letra: 'A', texto: '4', correta: false }, { letra: 'B', texto: 'Cinco', correta: true }],
    })));
  });
  it('REGRESSÃO: adicionar alternativa deve usar uma letra ainda livre', async () => {
    vi.mocked(api.questao).mockResolvedValue({ ...q, alternativas: [q.alternativas[0], { letra: 'C', texto: '6', correta: false }] });
    tela(<Revisao />, '/revisao/1'); await screen.findByDisplayValue(q.enunciado);
    fireEvent.click(screen.getByText('+ alternativa'));
    expect(screen.getAllByLabelText('Correta: C')).toHaveLength(1);
  });
});
