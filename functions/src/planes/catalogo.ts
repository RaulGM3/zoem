/**
 * Catálogo de planes y complementos — DATOS puros, sin Angular ni DI.
 * El código nunca pregunta "¿es plan pro?": pregunta por derechos (funciones y cupos).
 * Vender por paquetes o por plugins es editar este archivo, no la app.
 *
 * Ilimitado = `Infinity` aquí (en código). En Firestore (`suscripcion.ajustes`)
 * Infinity no se serializa, por eso allí ilimitado se guarda como `null`.
 */

export type Funcion =
  | 'contactos'
  | 'casos'
  | 'calendario'
  | 'plazos'
  | 'documentos'
  | 'plantillas'
  | 'acciones'
  | 'ia'
  | 'facturacion'
  | 'tesoreria'
  | 'recepcionIA'
  | 'informes'
  | 'agenteIA'
  | 'usuariosMultiples'
  | 'rolesPersonalizados';

export const FUNCIONES: readonly Funcion[] = [
  'contactos', 'casos', 'calendario', 'plazos', 'documentos', 'plantillas', 'acciones', 'ia',
  'facturacion', 'tesoreria', 'recepcionIA', 'informes', 'agenteIA', 'usuariosMultiples', 'rolesPersonalizados',
];

/** Funciones que el plan Free NO incluye: se muestran bloqueadas con aviso de mejora. */
export const FUNCIONES_DE_PAGO: readonly Funcion[] = [
  'facturacion', 'tesoreria', 'recepcionIA', 'informes', 'agenteIA', 'usuariosMultiples', 'rolesPersonalizados',
];

export type Limite =
  | 'usuarios' | 'plantillas' | 'accionesMes' | 'iaMensajesMes' | 'documentosMB' | 'casosActivos' | 'contactos';

export const LIMITES: readonly Limite[] = [
  'usuarios', 'plantillas', 'accionesMes', 'iaMensajesMes', 'documentosMB', 'casosActivos', 'contactos',
];

export interface Derechos {
  funciones: Record<Funcion, boolean>;
  limites: Record<Limite, number>;
}

export type PlanId = 'free' | 'pro' | 'enterprise' | 'demo';
export type ComplementoId = 'tesoreria' | 'usuariosExtra5';
export type EstadoSuscripcion = 'prueba' | 'activa' | 'vencida' | 'cancelada';
export type OrigenSuscripcion = 'free' | 'stripe' | 'manual';

/** Ajustes manuales del superuser. `null` en un límite = ilimitado (serializable). */
export interface AjustesDerechos {
  funciones?: Partial<Record<Funcion, boolean>>;
  limites?: Partial<Record<Limite, number | null>>;
}

/** Fecha tal como llega de Firestore (Timestamp), de código (Date) o serializada. */
export type FechaFlexible = Date | string | { toDate(): Date } | null;

/** Lo que se guarda en `companies/{cid}.suscripcion`. Solo lo escribe superuser o una Function. */
export interface Suscripcion {
  plan: PlanId;
  complementos: ComplementoId[];
  estado: EstadoSuscripcion;
  periodoFin?: FechaFlexible;
  origen: OrigenSuscripcion;
  ajustes?: AjustesDerechos;
}

const todas = (valor: boolean): Record<Funcion, boolean> =>
  Object.fromEntries(FUNCIONES.map((f) => [f, valor])) as Record<Funcion, boolean>;

const FUNCIONES_FREE: Record<Funcion, boolean> = {
  ...todas(false),
  contactos: true, casos: true, calendario: true, plazos: true,
  documentos: true, plantillas: true, acciones: true, ia: true,
};

const ILIMITADO: Record<Limite, number> = {
  usuarios: Infinity, plantillas: Infinity, accionesMes: Infinity,
  iaMensajesMes: Infinity, documentosMB: Infinity, casosActivos: Infinity, contactos: Infinity,
};

export const CATALOGO: Record<PlanId, Derechos> = {
  free: {
    funciones: FUNCIONES_FREE,
    limites: {
      usuarios: 1, plantillas: 5, accionesMes: 15, iaMensajesMes: 30, documentosMB: 500, casosActivos: 50, contactos: Infinity,
    },
  },
  pro: {
    funciones: todas(true),
    limites: {
      usuarios: 10, plantillas: 100, accionesMes: 1000, iaMensajesMes: 1000, documentosMB: 20_000, casosActivos: Infinity, contactos: Infinity,
    },
  },
  enterprise: { funciones: todas(true), limites: ILIMITADO },
  /**
   * Despacho de ejemplo: TODAS las funciones (para probarlas) pero USO acotado, para que no
   * se use como despacho real gratis. Los cupos de casos/contactos/plantillas cuentan solo lo
   * que crea el usuario: el seed (ids `demo-…`) no cuenta. Dura 14 días (`suscripcion.periodoFin`).
   * Espejo en functions/src/planes/catalogo.ts (lo vigila un spec de sincronía).
   */
  demo: {
    funciones: todas(true),
    limites: { usuarios: 1, plantillas: 3, accionesMes: 5, iaMensajesMes: 10, documentosMB: 50, casosActivos: 10, contactos: 10 },
  },
};

export interface Complemento {
  nombre: string;
  /** Funciones que desbloquea. */
  funciones?: Partial<Record<Funcion, true>>;
  /** Cupos que suma al plan (si el plan es ilimitado, sigue ilimitado). */
  limitesExtra?: Partial<Record<Limite, number>>;
}

export const COMPLEMENTOS: Record<ComplementoId, Complemento> = {
  tesoreria: { nombre: 'Tesorería', funciones: { tesoreria: true } },
  usuariosExtra5: { nombre: '+5 usuarios', funciones: { usuariosMultiples: true }, limitesExtra: { usuarios: 5 } },
};
