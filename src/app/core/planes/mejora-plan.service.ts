import { Injectable, signal } from '@angular/core';
import type { Funcion } from './catalogo';
import type { MotivoBloqueo } from './bloqueo';

/**
 * Estado del modal de mejora de plan. Un único modal montado en el layout;
 * cualquier pantalla (chip, página bloqueada, cupo) lo abre con `abrir()`.
 * Si lo abre un bloqueo concreto (cupo agotado, función de pago, demo terminada) llega el `motivo`
 * y el modal explica la causa. Fase 4: aquí colgará la telemetría de avisos y clics en "Mejorar".
 */
@Injectable({ providedIn: 'root' })
export class MejoraPlanService {
  readonly abierto = signal(false);
  /** Función que motivó el aviso (null = apertura genérica). */
  readonly funcion = signal<Funcion | null>(null);
  /** Causa concreta del bloqueo (null = apertura genérica o por función desde el menú). */
  readonly motivo = signal<MotivoBloqueo | null>(null);

  abrir(funcion?: Funcion): void {
    this.motivo.set(null);
    this.funcion.set(funcion ?? null);
    this.abierto.set(true);
  }

  abrirPorBloqueo(motivo: MotivoBloqueo): void {
    this.motivo.set(motivo);
    this.funcion.set(motivo.tipo === 'funcion' ? (motivo.recurso as Funcion) : null);
    this.abierto.set(true);
  }

  cerrar(): void {
    this.abierto.set(false);
    this.motivo.set(null);
  }
}
