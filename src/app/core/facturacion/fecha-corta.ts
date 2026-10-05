const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

/** `2026-09-01` → `1 sep 2026`. Puro (sin `Date` ni locale registrado); si no es ISO, devuelve el texto tal cual. */
export function fechaCorta(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  const mes = m ? MESES[Number(m[2]) - 1] : undefined;
  return m && mes ? `${Number(m[3])} ${mes} ${m[1]}` : iso;
}
