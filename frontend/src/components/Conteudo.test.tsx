// @vitest-environment jsdom
import { afterEach, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import Conteudo from './Conteudo';
afterEach(cleanup);
it('preserva texto e renderiza imagem da fonte com descrição', () => {
  render(<Conteudo texto={'Legenda\n![Gráfico](https://example.com/grafico.png)'} />);
  expect(screen.getByText('Legenda')).toBeTruthy();
  expect(screen.getByAltText('Gráfico').getAttribute('src')).toBe('https://example.com/grafico.png');
});
it('não interpreta HTML nem URLs javascript como conteúdo ativo', () => {
  const { container } = render(<Conteudo texto={'<script>alert(1)</script> ![x](javascript:alert(1))'} />);
  expect(container.querySelector('script')).toBeNull();
  expect(container.querySelector('img')).toBeNull();
});
