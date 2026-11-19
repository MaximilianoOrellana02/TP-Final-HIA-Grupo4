export function paginasVisibles(actual: number, total: number): (number | null)[] {
  const cantidad = Math.min(5, total);
  const inicio = Math.max(1, Math.min(actual - 2, total - cantidad + 1));
  const fin = inicio + cantidad - 1;
  const paginas: (number | null)[] = [];
  if (inicio > 1) {
    paginas.push(1);
    if (inicio > 2) paginas.push(null);
  }
  for (let pagina = inicio; pagina <= fin; pagina++) paginas.push(pagina);
  if (fin < total) {
    if (fin < total - 1) paginas.push(null);
    paginas.push(total);
  }
  return paginas;
}
