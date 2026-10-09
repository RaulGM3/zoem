import {
  CATALOGO, COMPLEMENTOS, FUNCIONES, LIMITES,
  type Derechos, type FechaFlexible, type Funcion, type Limite, type Suscripcion,
} from './catalogo';

/**
 * COPIA de src/app/core/planes/derechos.ts SIN los helpers de UI (módulo/ruta). Las Functions no
 * importan del cliente; `planes/sincronia.spec.ts` comprueba que ambas dan los mismos resultados.
 *
 * Lógica PURA de derechos — sin Angular ni DI. Recibe `ahora` explícito
 * (nada de `new Date()` escondido) para que los specs sean deterministas.
 */

const MS_DIA = 86_400_000;

export type EstadoCupo = 'ok' | 'aviso' | 'agotado';

export function aFecha(valor: FechaFlexible | undefined): Date | null {
  if (!valor) return null;
  if (valor instanceof Date) return valor;
  if (typeof valor === 'string') {
    const d = new Date(valor);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  return typeof valor.toDate === 'function' ? valor.toDate() : null;
}

/**
 * Empresas SIN `suscripcion` (anteriores a este sistema).
 * El campo `plan` legado nunca se aplicó y el alta de superuser lo dejaba en 'free'
 * por defecto, así que NO es fiable para restringir: quien ya pagaba no debe perder
 * funciones. Regla: todo es 'pro', salvo 'enterprise' que se conserva. Para bajar a
 * una empresa a Free hay que escribir `suscripcion` explícitamente.
 */
export function suscripcionLegada(planLegado?: string | null): Suscripcion {
  return {
    plan: planLegado === 'enterprise' ? 'enterprise' : 'pro',
    complementos: [],
    estado: 'activa',
    origen: 'manual',
  };
}

export function diasRestantes(periodoFin: FechaFlexible | undefined, ahora: Date): number {
  const fin = aFecha(periodoFin);
  if (!fin) return 0;
  return Math.max(0, Math.ceil((fin.getTime() - ahora.getTime()) / MS_DIA));
}

/** ¿Está en prueba inversa vigente? (estado 'prueba' y periodoFin futuro) */
export function enPruebaVigente(s: Suscripcion | null | undefined, ahora: Date): boolean {
  if (!s || s.estado !== 'prueba') return false;
  const fin = aFecha(s.periodoFin);
  return !!fin && fin.getTime() > ahora.getTime();
}

/** Demo con `periodoFin` alcanzado. Sin fecha (demos anteriores a la fase 3) no caduca. */
export function demoVencida(s: Suscripcion | null | undefined, ahora: Date): boolean {
  if (s?.plan !== 'demo') return false;
  const fin = aFecha(s.periodoFin);
  return !!fin && fin.getTime() <= ahora.getTime();
}

/** Solo lectura: los datos se conservan pero no se escribe (hoy, solo demo vencida). */
export function soloLectura(s: Suscripcion | null | undefined, ahora: Date): boolean {
  return demoVencida(s, ahora);
}

function clonar(d: Derechos): Derechos {
  return { funciones: { ...d.funciones }, limites: { ...d.limites } };
}

/** Derechos efectivos = plan ∪ complementos ∪ ajustes manuales (los ajustes mandan). */
export function derechosEfectivos(s: Suscripcion | null | undefined, ahora: Date): Derechos {
  const sus = s ?? suscripcionLegada();

  const caducada = sus.plan !== 'demo' && (sus.estado === 'vencida' || sus.estado === 'cancelada');
  const planBase = enPruebaVigente(sus, ahora) ? 'pro' : caducada || demoVencida(sus, ahora) ? 'free' : sus.plan;
  const base = clonar(CATALOGO[planBase] ?? CATALOGO.free);

  if (!caducada) {
    for (const id of sus.complementos ?? []) {
      const c = COMPLEMENTOS[id];
      if (!c) continue;
      for (const f of FUNCIONES) if (c.funciones?.[f]) base.funciones[f] = true;
      for (const l of LIMITES) {
        const extra = c.limitesExtra?.[l];
        if (extra) base.limites[l] += extra; // Infinity + n = Infinity
      }
    }
  }

  const aj = sus.ajustes;
  if (aj?.funciones) {
    for (const f of FUNCIONES) if (aj.funciones[f] !== undefined) base.funciones[f] = aj.funciones[f]!;
  }
  if (aj?.limites) {
    for (const l of LIMITES) {
      const v = aj.limites[l];
      if (v === null) base.limites[l] = Infinity;
      else if (v !== undefined) base.limites[l] = v;
    }
  }
  return base;
}

export function tieneFuncion(d: Derechos, f: Funcion): boolean {
  return d.funciones[f] === true;
}

export function limiteDe(d: Derechos, l: Limite): number {
  return d.limites[l];
}

/** ok < 80 % ≤ aviso < 100 % ≤ agotado. Ilimitado siempre ok; cupo 0 siempre agotado. */
export function estadoCupo(usado: number, limite: number): EstadoCupo {
  if (limite === Infinity) return 'ok';
  if (limite <= 0 || usado >= limite) return 'agotado';
  return usado / limite >= 0.8 ? 'aviso' : 'ok';
}
