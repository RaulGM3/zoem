import {
  LucideIconData,
  CheckCircle2, Circle, Clock, XCircle,
} from 'lucide-angular';
import type { HitoEstado } from '../../interfaces';

/**
 * Adapter de presentación: iconos lucide por estado de hito.
 *
 * Está separado de `hito-estado.ts` porque `lucide-angular` arrastra
 * dependencias de Angular (injectables), y el módulo de dominio debe ser puro
 * y testeable sin el framework.
 */
export const HITO_ESTADO_ICON: Record<HitoEstado, LucideIconData> = {
  pendiente: Circle,
  en_progreso: Clock,
  completado: CheckCircle2,
  cancelado: XCircle,
};
