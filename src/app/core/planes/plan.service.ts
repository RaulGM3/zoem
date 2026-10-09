import { computed, inject, Injectable, signal } from '@angular/core';
import { CompanyService } from '../services/company.service';
import type { Funcion, Limite, PlanId } from './catalogo';
import {
  demoVencida, derechosEfectivos, diasRestantes, enPruebaVigente, limiteDe, soloLectura, suscripcionLegada, tieneFuncion,
} from './derechos';

/**
 * Envoltorio con signals de la lógica pura de `derechos.ts`.
 * Lee la suscripción de la empresa activa; sin ella aplica la regla legada (pro).
 * Mientras no hay empresa activa (cargando) no bloquea nada para evitar parpadeos de candado.
 */
@Injectable({ providedIn: 'root' })
export class PlanService {
  private readonly company = inject(CompanyService);

  /** Reloj inyectable (los tests lo fijan). Se lee una vez; la prueba cambia por días, no por segundos. */
  readonly ahora = signal(new Date());

  readonly suscripcion = computed(() => {
    const c = this.company.activeCompany();
    return c ? (c.suscripcion ?? suscripcionLegada(c.plan)) : null;
  });

  readonly derechos = computed(() => derechosEfectivos(this.suscripcion(), this.ahora()));

  readonly plan = computed<PlanId>(() => this.suscripcion()?.plan ?? 'pro');

  readonly enPrueba = computed(() => enPruebaVigente(this.suscripcion(), this.ahora()));

  readonly diasPruebaRestantes = computed(() =>
    this.enPrueba() ? diasRestantes(this.suscripcion()?.periodoFin, this.ahora()) : 0,
  );

  /** Despacho de ejemplo cuyos 14 días terminaron: datos conservados, solo lectura (también en rules). */
  readonly demoVencida = computed(() => demoVencida(this.suscripcion(), this.ahora()));

  readonly soloLectura = computed(() => soloLectura(this.suscripcion(), this.ahora()));

  readonly diasDemoRestantes = computed(() => {
    const s = this.suscripcion();
    return s?.plan === 'demo' && !this.demoVencida() ? diasRestantes(s.periodoFin, this.ahora()) : 0;
  });

  /** Chip del toolbar: solo Free o prueba; oculto en pro, enterprise, demo y legadas. */
  readonly mostrarMejora = computed(() => this.enPrueba() || this.plan() === 'free');

  tiene(f: Funcion): boolean {
    return tieneFuncion(this.derechos(), f);
  }

  limite(l: Limite): number {
    return limiteDe(this.derechos(), l);
  }
}
