import { getContactDisplayName, type Contact } from '../../interfaces/contact.interface';
import type { Caso, Hito } from '../../interfaces/caso.interface';

export interface ContextoAccionInput {
  contactos: readonly Contact[];
  caso?: Pick<Caso, 'titulo' | 'tipo' | 'descripcion' | 'vencimiento'> | null;
  hito?: Pick<Hito, 'titulo' | 'descripcion'> | null;
  empresa: string;
  /** Fecha "de hoy" inyectada: esta función es pura y no lee el reloj. */
  hoy: Date;
}

const dos = (n: number) => String(n).padStart(2, '0');

/** dd/mm/aaaa (es-ES) sin depender de ICU ni de la zona horaria. */
export function formatearFechaEs(fecha: Date): string {
  return `${dos(fecha.getDate())}/${dos(fecha.getMonth() + 1)}/${fecha.getFullYear()}`;
}

/** 'YYYY-MM-DD' (o ISO datetime) -> dd/mm/aaaa; cualquier otra cosa se devuelve igual. */
function isoAEs(iso: string | undefined): string {
  const m = iso?.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : (iso ?? '');
}

/**
 * Variables disponibles en asunto/cuerpo de una acción y al pre-rellenar la
 * plantilla de documento. Todas las claves existen siempre (vacías si no
 * aplican) para que `clavesFaltantes` pueda señalar lo que falta.
 */
export function construirContextoAccion(input: ContextoAccionInput): Record<string, string> {
  const { contactos, caso, hito, empresa, hoy } = input;
  const unir = (xs: string[]) => xs.filter(Boolean).join(', ');
  const cliente = unir(contactos.map(getContactDisplayName));
  const primero = contactos[0];
  const fecha = formatearFechaEs(hoy);

  return {
    cliente,
    nombre: cliente,
    contacto: cliente,
    email: unir(contactos.map((c) => c.email?.trim() ?? '')),
    telefono: unir(contactos.map((c) => c.mobile?.trim() || c.phone?.trim() || '')),
    caso: caso?.titulo ?? '',
    asunto: caso?.titulo ?? primero?.asunto ?? '',
    tipo: caso?.tipo ?? '',
    descripcion: caso?.descripcion ?? '',
    vencimiento: isoAEs(caso?.vencimiento),
    hito: hito?.titulo ?? '',
    hito_descripcion: hito?.descripcion ?? '',
    empresa,
    fecha,
    hoy: fecha,
  };
}
