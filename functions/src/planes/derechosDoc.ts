import { FUNCIONES, LIMITES, type FechaFlexible, type Funcion, type Limite, type Suscripcion } from './catalogo';
import { aFecha, derechosEfectivos, enPruebaVigente, soloLectura, demoVencida } from './derechos';

/**
 * Forma DENORMALIZADA de los derechos que se guarda en `companies/{cid}.derechos`.
 * Las security rules no pueden ejecutar `derechosEfectivos`, pero sí leer este mapa:
 * así la lógica vive UNA vez (TypeScript, testeada) y las rules solo la consultan.
 *
 * - `limites`: `null` = ilimitado (Infinity no se serializa en Firestore).
 * - `hasta`: instante en que estos derechos dejan de valer (fin de prueba / de demo). Las rules
 *   comparan con `request.time`, así que NO hace falta un cron para que la prueba caduque.
 * - `despues`: derechos que rigen desde `hasta`.
 * Sin `suscripcion` (empresa legada) no hay `derechos` y las rules no restringen nada.
 */
export interface DerechosVigentes {
  funciones: Record<Funcion, boolean>;
  limites: Record<Limite, number | null>;
  soloLectura: boolean;
}

export interface DerechosDoc extends DerechosVigentes {
  hasta: FechaFlexible;
  despues: DerechosVigentes | null;
}

const MS = 1;

function vigentes(s: Suscripcion, ahora: Date): DerechosVigentes {
  const d = derechosEfectivos(s, ahora);
  return {
    funciones: Object.fromEntries(FUNCIONES.map((f) => [f, d.funciones[f]])) as Record<Funcion, boolean>,
    limites: Object.fromEntries(
      LIMITES.map((l) => [l, Number.isFinite(d.limites[l]) ? d.limites[l] : null]),
    ) as Record<Limite, number | null>,
    soloLectura: soloLectura(s, ahora),
  };
}

/** Próximo instante en que cambian los derechos (fin de prueba vigente o de demo vigente). */
function proximoCambio(s: Suscripcion, ahora: Date): Date | null {
  const vigenteConFin = enPruebaVigente(s, ahora) || (s.plan === 'demo' && !demoVencida(s, ahora));
  return vigenteConFin ? aFecha(s.periodoFin) : null;
}

export function derechosParaDoc(s: Suscripcion | null | undefined, ahora: Date): DerechosDoc | null {
  if (!s) return null;
  const hasta = proximoCambio(s, ahora);
  return {
    ...vigentes(s, ahora),
    hasta,
    despues: hasta ? vigentes(s, new Date(hasta.getTime() + MS)) : null,
  };
}

/** JSON con claves ordenadas: Firestore no conserva el orden de inserción de los mapas. */
function estable(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(estable).join(',')}]`;
  if (v && typeof v === 'object') {
    const o = v as Record<string, unknown>;
    return `{${Object.keys(o).sort().map((k) => `${JSON.stringify(k)}:${estable(o[k])}`).join(',')}}`;
  }
  return JSON.stringify(v ?? null);
}

function normalizar(d: DerechosDoc | null | undefined): string {
  return d ? estable({ ...d, hasta: aFecha(d.hasta)?.getTime() ?? null }) : 'null';
}

/** ¿Hay que reescribir `derechos`? Compara por valor (fechas por milisegundos, Timestamp incluido). */
export function igualesDerechos(a: DerechosDoc | null | undefined, b: DerechosDoc | null | undefined): boolean {
  return normalizar(a) === normalizar(b);
}

/** Derechos que rigen en `ahora` según un `derechos` guardado (misma regla que las security rules). */
export function vigentesEn(d: DerechosDoc | null | undefined, ahora: Date): DerechosVigentes | null {
  if (!d) return null;
  const hasta = aFecha(d.hasta);
  return hasta && ahora.getTime() >= hasta.getTime() && d.despues ? d.despues : d;
}
