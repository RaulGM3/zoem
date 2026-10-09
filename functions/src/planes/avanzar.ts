import { aFecha } from './derechos';
import { periodoMensual, zonaDeEmpresa, type PeriodoMensual } from '../uso/periodo';
import type { DerechosDoc } from './derechosDoc';

interface EmpresaConPeriodo {
  zonaHoraria?: unknown;
  derechos?: Partial<DerechosDoc>;
}

/**
 * Nuevo `derechos.periodoUso` si el guardado hay que cambiarlo (venció, falta o no coincide con la
 * zona de la empresa); `null` si ya es el correcto o la empresa es legada (sin `derechos`).
 * Lo usa el scheduler `avanzarPeriodosUso`; `sincronizarDerechos` hace lo mismo al escribir la empresa.
 */
export function periodoAvanzado(empresa: EmpresaConPeriodo, ahora: Date): PeriodoMensual | null {
  if (!empresa.derechos) return null;
  const guardado = empresa.derechos.periodoUso;
  const fin = aFecha(guardado?.fin);
  const correcto = periodoMensual(ahora, zonaDeEmpresa(empresa));
  if (guardado && fin && fin.getTime() > ahora.getTime() && guardado.clave === correcto.clave && fin.getTime() === correcto.fin.getTime()) {
    return null;
  }
  return correcto;
}
