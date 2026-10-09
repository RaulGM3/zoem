import { Injectable, signal } from '@angular/core';
import type { Funcion } from './catalogo';

/**
 * Estado del modal de mejora de plan. Un único modal montado en el layout;
 * cualquier pantalla (chip, página bloqueada, cupo) lo abre con `abrir()`.
 * Fase 4: aquí colgará la telemetría de avisos y clics en "Mejorar".
 */
@Injectable({ providedIn: 'root' })
export class MejoraPlanService {
  readonly abierto = signal(false);
  /** Función que motivó el aviso (null = apertura genérica). */
  readonly funcion = signal<Funcion | null>(null);

  abrir(funcion?: Funcion): void {
    this.funcion.set(funcion ?? null);
    this.abierto.set(true);
  }

  cerrar(): void {
    this.abierto.set(false);
  }
}
