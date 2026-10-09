// Lógica PURA de suscripción para las Functions. Espeja los tipos de
// src/app/core/planes/catalogo.ts (las Functions no importan del cliente).

import type { ComplementoId } from '../planes/catalogo';

export const DIAS_PRUEBA = 14;
/** El despacho de ejemplo dura 14 días desde su creación; después queda en solo lectura. */
export const DIAS_DEMO = 14;
const MS_DIA = 86_400_000;

export type FechaDoc = Date | { toDate(): Date } | null | undefined;

export interface SuscripcionDoc {
  plan: string;
  estado: string;
  periodoFin?: FechaDoc;
  complementos?: string[];
  origen?: string;
}

export interface EmpresaConSuscripcion {
  esDemo?: boolean;
  suscripcion?: Partial<SuscripcionDoc>;
}

/** Reverse trial del autoservicio: Pro durante 14 días (derechos lo resuelve el cliente) y luego Free. */
export function suscripcionInicial(ahora: Date) {
  return {
    plan: 'free' as const,
    estado: 'prueba' as const,
    periodoFin: new Date(ahora.getTime() + DIAS_PRUEBA * MS_DIA),
    complementos: [] as ComplementoId[],
    origen: 'free' as const,
  };
}

export function suscripcionDemo(ahora: Date) {
  return {
    plan: 'demo' as const,
    estado: 'activa' as const,
    periodoFin: new Date(ahora.getTime() + DIAS_DEMO * MS_DIA),
    complementos: [] as ComplementoId[],
    origen: 'manual' as const,
  };
}

/** Despacho de ejemplo: no debe producir efectos externos (AEAT, push, envíos). */
export function esEmpresaDemo(empresa: EmpresaConSuscripcion | null | undefined): boolean {
  return empresa?.esDemo === true || empresa?.suscripcion?.plan === 'demo';
}

function aFecha(v: FechaDoc): Date | null {
  if (!v) return null;
  if (v instanceof Date) return v;
  return typeof v.toDate === 'function' ? v.toDate() : null;
}

/** ¿La prueba ya terminó (periodoFin <= ahora)? Las demos nunca expiran. */
export function debeExpirar(empresa: EmpresaConSuscripcion, ahora: Date): boolean {
  if (esEmpresaDemo(empresa)) return false;
  const s = empresa.suscripcion;
  if (!s || s.estado !== 'prueba') return false;
  const fin = aFecha(s.periodoFin);
  return !!fin && fin.getTime() <= ahora.getTime();
}

/**
 * Parche (dot-paths) que cierra la prueba: queda 'activa' con el plan declarado
 * (free en autoservicio), así los derechos pasan a ser los de ese plan.
 */
export function expirar(_s: SuscripcionDoc): Record<string, unknown> {
  return { 'suscripcion.estado': 'activa', 'suscripcion.periodoFin': null };
}

/** Demo cuyo `periodoFin` ya llegó: se conservan los datos pero solo en lectura. */
export function demoExpirada(empresa: EmpresaConSuscripcion | null | undefined, ahora: Date): boolean {
  if (!esEmpresaDemo(empresa)) return false;
  const fin = aFecha(empresa?.suscripcion?.periodoFin);
  return !!fin && fin.getTime() <= ahora.getTime();
}
