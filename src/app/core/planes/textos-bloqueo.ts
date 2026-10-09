import type { PlanId } from './catalogo';
import type { MotivoBloqueo } from './bloqueo';
import { periodoMensual } from './periodo';
import { textosMejora } from './textos-mejora';

export interface TextoBloqueo {
  titulo: string;
  descripcion: string;
  cta: string;
  ctaSecundaria: string;
}

export interface ContextoTextoBloqueo {
  plan: PlanId;
  ahora: Date;
  /** Zona horaria IANA de la empresa (para decir cuándo se renuevan los cupos mensuales). */
  zona: string;
}

const NOMBRE_PLAN: Record<PlanId, string> = { free: 'Free', pro: 'Pro', enterprise: 'Enterprise', demo: 'Demo' };

/** "1 de noviembre": primer día del mes siguiente en la zona de la empresa. */
function renovacion(ahora: Date, zona: string): string {
  const fin = periodoMensual(ahora, zona).fin;
  return new Intl.DateTimeFormat('es', { timeZone: zona, day: 'numeric', month: 'long' }).format(fin);
}

function almacenamiento(mb: number): string {
  return mb >= 1000 && mb % 1000 === 0 ? `${mb / 1000} GB` : `${mb} MB`;
}

const CTA = 'Hazte PRO';
const CTA_SECUNDARIA = 'Ahora no';

/** Copy del modal de mejora según la causa del bloqueo. */
export function textosBloqueo(m: MotivoBloqueo, c: ContextoTextoBloqueo): TextoBloqueo {
  const plan = NOMBRE_PLAN[c.plan];
  const n = m.limite ?? 0;
  const mensual = (cosa: string) =>
    `Se acabaron tus ${n} ${cosa} de este mes (se renuevan el ${renovacion(c.ahora, c.zona)} según tu zona horaria)`;
  const usado = (cosa: string) => `Has usado tus ${n} ${cosa} del plan ${plan}`;
  const base = { cta: CTA, ctaSecundaria: CTA_SECUNDARIA };

  if (m.tipo === 'demoTerminada') {
    return {
      ...base,
      titulo: 'Tu despacho de ejemplo terminó',
      descripcion: 'Tus datos de ejemplo se conservan en solo lectura. Crea o mejora tu despacho para seguir trabajando.',
    };
  }
  if (m.tipo === 'funcion') {
    return {
      ...base,
      titulo: 'Esta función está en el plan Pro',
      descripcion: textosMejora(m.recurso as Parameters<typeof textosMejora>[0]).descripcion,
    };
  }

  const descripcionCupo = 'Mejora tu plan para seguir sin límites. Tus datos se conservan.';
  switch (m.recurso) {
    case 'casosActivos': return { ...base, titulo: usado('casos'), descripcion: descripcionCupo };
    case 'contactos': return { ...base, titulo: usado('contactos'), descripcion: descripcionCupo };
    case 'plantillas': return { ...base, titulo: usado('plantillas'), descripcion: descripcionCupo };
    case 'usuarios':
      return { ...base, titulo: n === 1 ? `Tu plan ${plan} incluye 1 usuario` : usado('usuarios'), descripcion: 'Mejora tu plan para invitar a tu equipo.' };
    case 'accionesMes': return { ...base, titulo: mensual('acciones'), descripcion: 'Mejora tu plan para tener más acciones cada mes.' };
    case 'iaMensajesMes': return { ...base, titulo: mensual('mensajes de IA'), descripcion: 'Mejora tu plan para tener más IA cada mes.' };
    case 'documentosMB':
      return m.detalle
        ? { ...base, titulo: `Este archivo no cabe en tus ${almacenamiento(n)} del plan ${plan}`, descripcion: `${m.detalle} Tus documentos actuales se conservan. Mejora tu plan para subir más.` }
        : { ...base, titulo: `Has llenado tus ${almacenamiento(n)} de documentos del plan ${plan}`, descripcion: 'Tus documentos actuales se conservan y siguen accesibles. Mejora tu plan para subir más.' };
    default: return { ...base, titulo: usado(String(m.recurso)), descripcion: descripcionCupo };
  }
}
