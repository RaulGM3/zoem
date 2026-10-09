/** Días restantes a partir de los cuales se avisa del fin de la prueba. */
export const DIAS_AVISO_PRUEBA = 3;

/** Clave del día en hora local (yyyy-mm-dd): el descarte del aviso vale solo para ese día. */
export function claveDia(fecha: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${fecha.getFullYear()}-${p(fecha.getMonth() + 1)}-${p(fecha.getDate())}`;
}

export function debeMostrarAvisoPrueba(e: {
  enPrueba: boolean;
  dias: number;
  descartadoEl: string | null;
  hoy: string;
}): boolean {
  return e.enPrueba && e.dias <= DIAS_AVISO_PRUEBA && e.descartadoEl !== e.hoy;
}
