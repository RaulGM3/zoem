import { inject, Injectable } from '@angular/core';
import { evaluarEspacio, mensajeSinEspacio } from './espacio';
import { MejoraPlanService } from './mejora-plan.service';
import { PlanService } from './plan.service';
import { UsoService } from './uso.service';

/**
 * No queda espacio de almacenamiento en el plan. `code` hace que `translateFirebaseError` muestre este
 * mensaje tal cual (ya es de cara al usuario) y no ofrezca "Reintentar".
 */
export class CupoAlmacenamientoError extends Error {
  readonly code = 'cupo-almacenamiento';
  constructor(quedanMB: number) {
    super(mensajeSinEspacio(quedanMB));
    this.name = 'CupoAlmacenamientoError';
  }
}

/**
 * Pre-check ANTES de subir a Storage: si el archivo no cabe, ni se sube (sin huérfanos) y se abre el modal
 * de mejora. Es una comodidad de UX basada en el contador (eventualmente consistente); la barrera real
 * son las Storage rules (cuota) y, de red de seguridad, el trigger `limitarCuotaArchivos`.
 */
@Injectable({ providedIn: 'root' })
export class AlmacenamientoCupoService {
  private readonly plan = inject(PlanService);
  private readonly uso = inject(UsoService);
  private readonly mejora = inject(MejoraPlanService);

  /** Lanza `CupoAlmacenamientoError` si `bytes` no caben. */
  asegurar(bytes: number): void {
    const r = evaluarEspacio({ usadoBytes: this.uso.usadoBytes(), limiteMB: this.plan.limite('documentosMB'), bytes });
    if (r.cabe) return;
    this.mejora.abrir('documentos');
    throw new CupoAlmacenamientoError(r.quedanMB);
  }
}
