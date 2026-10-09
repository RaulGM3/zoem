// Llamadas de ejemplo de Recepción IA para el despacho demo. Solo el BACKEND puede escribir
// `llamadas` y `agentMappings` (las rules los reservan al superusuario), así que las siembra una
// Function. Port de la parte de llamadas de src/app/core/demo/seed-demo-civil.ts; la sincronía
// la vigila llamadasDemo.spec.ts. Puro: recibe `ahora`.
import { LLAMADAS } from './datosLlamadasDemo';

export interface DocDemo {
  path: string;
  data: Record<string, unknown>;
}

export const agenteDemoId = (companyId: string) => `demo-agente-${companyId}`;
const prefijo = (companyId: string) => `demo-${companyId}-`;
const pad = (n: number) => String(n).padStart(2, '0');

const ZONA = 'Europe/Madrid';

/** Diferencia (minutos) entre la hora de pared de Madrid y UTC en ese instante. */
function desfaseMadrid(ms: number): number {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', {
      timeZone: ZONA, hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric',
    }).formatToParts(new Date(ms)).map((x) => [x.type, Number(x.value)]),
  ) as Record<string, number>;
  return Math.round((Date.UTC(p['year'], p['month'] - 1, p['day'], p['hour'], p['minute']) - ms) / 60000);
}

/** Instante en que en Madrid son las `hh:mm` de (hoy de Madrid + `offsetDias`). */
export function fechaMadrid(base: Date, offsetDias: number, hh: number, mm: number): Date {
  const [y, m, d] = new Intl.DateTimeFormat('en-CA', { timeZone: ZONA, year: 'numeric', month: '2-digit', day: '2-digit' })
    .format(base).split('-').map(Number);
  const pared = Date.UTC(y, m - 1, d + offsetDias, hh, mm);
  const primera = pared - desfaseMadrid(pared) * 60000;
  return new Date(pared - desfaseMadrid(primera) * 60000);
}

export function construirLlamadasDemo(companyId: string, ahora: Date): DocDemo[] {
  const agentId = agenteDemoId(companyId);
  const docs: DocDemo[] = [
    {
      path: `agentMappings/${agentId}`,
      data: {
        agentId, companyId, label: 'Recepción IA (demo)',
        createdAt: fechaMadrid(ahora, -90, 12, 0), updatedAt: fechaMadrid(ahora, -90, 12, 0),
      },
    },
  ];
  for (const ll of LLAMADAS) {
    const [hh, mm] = ll.hora.split(':').map(Number);
    const id = `${prefijo(companyId)}llamada-${ll.key}`;
    const data: Record<string, unknown> = {
      conversationId: id,
      agentId,
      estado: ll.estado,
      duracionSegundos: ll.turnos.length * 23 + 11,
      resumen: ll.resumen,
      tituloResumen: ll.titulo,
      transcripcion: ll.turnos.map(([rol, mensaje], i) => ({ rol: rol === 'a' ? 'agente' : 'usuario', mensaje, segundosEnLlamada: i * 23 })),
      exitosa: ll.estado === 'completada',
      datosCapturados: {
        ...(ll.nombre !== undefined ? { nombreCliente: ll.nombre } : {}),
        telefono: ll.telefono,
        ...(ll.especialidad !== undefined ? { especialidadJuridica: ll.especialidad } : {}),
        ...(ll.urgencia !== undefined ? { nivelUrgencia: ll.urgencia } : {}),
        ...(ll.descripcion !== undefined ? { descripcionCaso: ll.descripcion } : {}),
      },
      creadoEn: fechaMadrid(ahora, -ll.hace, hh, mm),
      ...(ll.contacto !== undefined ? { contactId: `demo-contacto-${pad(ll.contacto + 1)}` } : {}),
    };
    docs.push({ path: `llamadas/${id}`, data });
  }
  return docs;
}
