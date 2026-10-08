import type { Modulo } from '../../permissions/permissions';
import type { Guia } from '../guia';
import { GUIA_ACCIONES } from './acciones.guia';
import { GUIA_AGENTE_IA } from './agente-ia.guia';
import { GUIA_CALENDARIO } from './calendario.guia';
import { GUIA_CASOS } from './casos.guia';
import { GUIA_CONFIGURACION } from './configuracion.guia';
import { GUIA_CONTACTOS } from './contactos.guia';
import { GUIA_DASHBOARD } from './dashboard.guia';
import { GUIA_DOCUMENTOS } from './documentos.guia';
import { GUIA_FACTURACION } from './facturacion.guia';
import { GUIA_GENERAL } from './general.guia';
import { GUIA_PERFIL } from './perfil.guia';
import { GUIA_RECEPCION_IA } from './recepcion-ia.guia';
import { GUIA_TESORERIA } from './tesoreria.guia';

/**
 * Catálogo de guías, en el orden en que se muestran en la página de ayuda.
 *
 * NO importes este archivo de forma estática fuera de `cargar-guias.ts`: es
 * contenido, y tiene que quedarse en un chunk diferido.
 */
export const GUIAS: readonly Guia[] = [
  GUIA_GENERAL,
  GUIA_DASHBOARD,
  GUIA_CONTACTOS,
  GUIA_CASOS,
  GUIA_CALENDARIO,
  GUIA_DOCUMENTOS,
  GUIA_FACTURACION,
  GUIA_TESORERIA,
  GUIA_RECEPCION_IA,
  GUIA_AGENTE_IA,
  GUIA_CONFIGURACION,
  GUIA_ACCIONES,
  GUIA_PERFIL,
];

/**
 * Módulos que deliberadamente no tienen guía. Cada uno lleva su porqué: si
 * aparece un módulo nuevo sin guía y sin entrada aquí, `guias.spec.ts` falla.
 */
export const SIN_GUIA: readonly Modulo[] = [
  // Informes no está publicado: su entrada del menú está comentada en demo-layout.ts.
  'Informes',
];
