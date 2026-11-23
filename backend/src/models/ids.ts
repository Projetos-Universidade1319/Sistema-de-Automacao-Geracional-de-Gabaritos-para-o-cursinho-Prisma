export function numeroId(value: string | number): number {
  const id = Number(value);
  if (!Number.isSafeInteger(id) || id <= 0) throw new Error('ID fora do intervalo suportado');
  return id;
}
