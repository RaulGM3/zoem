import { inject, Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { CompanyService } from '../services/company.service';
import { motivoBloqueoPlan, type ContextoBloqueo, type EstadoPlanBloqueo, type MotivoBloqueo } from './bloqueo';
import type { Limite } from './catalogo';
import { funcionDeRuta, soloLectura } from './derechos';
import { MejoraPlanService } from './mejora-plan.service';
import { PlanService } from './plan.service';
import { UsoService } from './uso.service';

/**
 * Punto único donde un bloqueo del plan se convierte en el modal de mejora (en vez de un error genérico
 * de permisos). Lo usan `ToastService.run` (tras un error) y los botones de crear (antes de intentarlo).
 */
@Injectable({ providedIn: 'root' })
export class BloqueoPlanService {
  private readonly plan = inject(PlanService);
  private readonly uso = inject(UsoService);
  private readonly mejora = inject(MejoraPlanService);
  private readonly router = inject(Router);
  private readonly company = inject(CompanyService);

  /** Función de pago de la página actual (`/tesoreria/...` => tesoreria). */
  private funcionDeLaPagina(): ContextoBloqueo['funcion'] {
    const segmento = this.router.url.split(/[?#]/)[0].split('/')[1];
    return segmento ? (funcionDeRuta(`/${segmento}`) ?? undefined) : undefined;
  }

  private estado(): EstadoPlanBloqueo {
    return { derechos: this.plan.derechos(), suscripcion: this.plan.suscripcion() };
  }

  /** ¿Es un bloqueo del plan? Si sí, abre el modal con la causa y devuelve true (no hay que mostrar el error). */
  manejar(error: unknown, contexto: ContextoBloqueo = {}): boolean {
    const ctx: ContextoBloqueo = { ...contexto, funcion: contexto.funcion ?? this.funcionDeLaPagina() };
    const motivo = motivoBloqueoPlan(error, ctx, this.estado(), (l) => this.uso.usado(l), this.plan.ahora());
    if (!motivo) return false;
    this.mejora.abrirPorBloqueo(motivo);
    return true;
  }

  /**
   * Pre-check barato antes de intentar crear: si el cupo ya está agotado (o la demo terminó) abre el modal
   * y devuelve true; el botón no intenta la escritura.
   */
  cupoAgotado(limite: Limite): boolean {
    const { derechos, suscripcion } = this.estado();
    let motivo: MotivoBloqueo | null = null;
    if (soloLectura(suscripcion, this.plan.ahora())) {
      motivo = { tipo: 'demoTerminada', recurso: 'demo' };
    } else {
      const tope = derechos.limites[limite];
      const usado = this.uso.usado(limite);
      if (Number.isFinite(tope) && usado >= tope) motivo = { tipo: 'cupo', recurso: limite, usado, limite: tope };
    }
    if (!motivo) return false;
    this.mejora.abrirPorBloqueo(motivo);
    return true;
  }

  /** El componente ya sabe que el cupo está agotado (con su propio recuento): abre el modal con la causa. */
  abrirCupo(limite: Limite, usado?: number): void {
    this.mejora.abrirPorBloqueo({
      tipo: 'cupo', recurso: limite, usado: usado ?? this.uso.usado(limite), limite: this.plan.derechos().limites[limite],
    });
  }

  /** Zona horaria de la empresa activa (para el texto de renovación). */
  zonaEmpresa(): string | undefined {
    return this.company.activeCompany()?.zonaHoraria;
  }
}
