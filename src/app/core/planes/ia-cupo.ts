import { inject, Injectable } from '@angular/core';
import { Functions, httpsCallable } from '@angular/fire/functions';
import { CupoIaAgotadoError } from '../agent/errores-ia';
import { CompanyService } from '../services/company.service';
import { BloqueoPlanService } from './bloqueo-plan.service';

export type ResultadoReserva = 'agotado' | 'transitorio' | 'bloqueado';

/**
 * Traduce el fallo de `reservarIA`. Una caída de la propia Function (o de la red) NO debe dejar sin
 * IA a todo el mundo: se deja pasar (fail-open) y se registra. Todo lo demás (cupo, plan sin IA,
 * sesión, App Check) sí se respeta.
 */
export function clasificarErrorReserva(e: unknown): ResultadoReserva {
  const code = (e as { code?: string } | null)?.code;
  if (code === 'functions/resource-exhausted') return 'agotado';
  if (code === undefined || ['functions/unavailable', 'functions/deadline-exceeded', 'functions/internal'].includes(code)) {
    return 'transitorio';
  }
  return 'bloqueado';
}

/**
 * Reserva cupo de IA en el servidor ANTES de cada petición a Gemini (que sigue yendo directa con
 * Firebase AI Logic). Ver functions/src/ia/reservarIA.ts para lo que garantiza y lo que no.
 */
@Injectable({ providedIn: 'root' })
export class IaCupoService {
  private readonly functions = inject(Functions);
  private readonly company = inject(CompanyService);
  private readonly bloqueo = inject(BloqueoPlanService);

  async reservar(n = 1): Promise<void> {
    const companyId = this.company.activeCompany()?.id;
    if (!companyId) return;
    try {
      await httpsCallable<{ companyId: string; n: number }, { usado: number; limite: number | null }>(
        this.functions,
        'reservarIA',
      )({ companyId, n });
    } catch (e) {
      const tipo = clasificarErrorReserva(e);
      if (tipo === 'agotado') {
        this.bloqueo.abrirCupo('iaMensajesMes');
        throw new CupoIaAgotadoError();
      }
      if (tipo === 'transitorio') {
        console.warn('[ia] reservarIA no disponible, se deja pasar:', e);
        return;
      }
      throw e;
    }
  }
}
