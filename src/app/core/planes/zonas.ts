import { esZonaValida, ZONA_POR_DEFECTO } from './periodo';

export interface OpcionZona {
  valor: string;
  etiqueta: string;
}

/** Zonas habituales (España y Latinoamérica). Cualquier otra IANA válida se admite añadiéndola como opción. */
export const ZONAS_COMUNES: readonly OpcionZona[] = [
  { valor: 'Europe/Madrid', etiqueta: 'España peninsular y Baleares (Madrid)' },
  { valor: 'Atlantic/Canary', etiqueta: 'Canarias' },
  { valor: 'America/Mexico_City', etiqueta: 'México (Ciudad de México)' },
  { valor: 'America/Bogota', etiqueta: 'Colombia (Bogotá)' },
  { valor: 'America/Lima', etiqueta: 'Perú (Lima)' },
  { valor: 'America/Santiago', etiqueta: 'Chile (Santiago)' },
  { valor: 'America/Argentina/Buenos_Aires', etiqueta: 'Argentina (Buenos Aires)' },
  { valor: 'America/Montevideo', etiqueta: 'Uruguay (Montevideo)' },
  { valor: 'America/Caracas', etiqueta: 'Venezuela (Caracas)' },
  { valor: 'America/Guayaquil', etiqueta: 'Ecuador (Guayaquil)' },
  { valor: 'America/La_Paz', etiqueta: 'Bolivia (La Paz)' },
  { valor: 'America/Asuncion', etiqueta: 'Paraguay (Asunción)' },
  { valor: 'America/Panama', etiqueta: 'Panamá' },
  { valor: 'America/Costa_Rica', etiqueta: 'Costa Rica' },
  { valor: 'America/Guatemala', etiqueta: 'Guatemala' },
  { valor: 'America/El_Salvador', etiqueta: 'El Salvador' },
  { valor: 'America/Tegucigalpa', etiqueta: 'Honduras (Tegucigalpa)' },
  { valor: 'America/Managua', etiqueta: 'Nicaragua (Managua)' },
  { valor: 'America/Santo_Domingo', etiqueta: 'República Dominicana (Santo Domingo)' },
  { valor: 'America/Puerto_Rico', etiqueta: 'Puerto Rico' },
  { valor: 'America/Havana', etiqueta: 'Cuba (La Habana)' },
  { valor: 'America/Sao_Paulo', etiqueta: 'Brasil (São Paulo)' },
];

/** Zona del navegador si es válida; si no, Europe/Madrid. `leer` es inyectable para los tests. */
export function zonaDelNavegador(
  leer: () => string | undefined = () => Intl.DateTimeFormat().resolvedOptions().timeZone,
): string {
  try {
    const z = leer();
    return esZonaValida(z) ? z : ZONA_POR_DEFECTO;
  } catch {
    return ZONA_POR_DEFECTO;
  }
}

/** Lista para el `<select>`: las comunes y, si hace falta, la zona actual (p. ej. America/Cancun). */
export function opcionesZona(actual: string): readonly OpcionZona[] {
  return ZONAS_COMUNES.some((z) => z.valor === actual) || !esZonaValida(actual)
    ? ZONAS_COMUNES
    : [...ZONAS_COMUNES, { valor: actual, etiqueta: actual.replace(/_/g, ' ') }];
}
