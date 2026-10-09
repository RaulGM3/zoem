import { inject, Injectable } from '@angular/core';
import { PermissionService } from '../services/permission.service';
import { evaluarEspacio, mensajeSinEspacio } from './espacio';
import { MejoraPlanService } from './mejora-plan.service';
import { PlanService } from './plan.service';
import { UsoService } from './uso.service';

const MB = 1_048_576;

/**
 * No queda espacio de almacenamiento en el plan. `code` hace que `translateFirebaseError` muestre este
 * mensaje tal cual (ya es de cara al usuario) y no ofrezca "Reintentar".
 */
export class CupoAlmacenamientoError extends Error {
  readonly code = 'cupo-almacenamiento';
  constructor(quedanMB: number, archivoBytes: number) {
    super(mensajeSinEspacio(quedanMB, archivoBytes));
    this.name = 'CupoAlmacenamientoError';
  }
}

/**
 * Pre-checks de UX de la cuota de almacenamiento. NUNCA borran ni ocultan nada: estar por encima del cupo
 * (p. ej. tras bajar de plan) solo impide subir archivos NUEVOS; lo ya subido sigue intacto y accesible.
 *
 *  1. `puedeSubir()`: antes de abrir el selector de archivos / aceptar un drop. Cupo agotado => modal "Hazte PRO".
 *  2. `admitir(archivos)`: al elegir los archivos; los que no caben no se suben y el modal dice cuánto queda.
 *  3. `asegurar(bytes)`: último recurso dentro de los servicios de subida (lanza).
 *
 * Son comodidades basadas en el contador (eventualmente consistente); la barrera real son las Storage rules.
 * El superusuario no está sujeto al cupo (igual que en las rules), así que se salta estos checks.
 */
@Injectable({ providedIn: 'root' })
export class AlmacenamientoCupoService {
  private readonly plan = inject(PlanService);
  private readonly uso = inject(UsoService);
  private readonly mejora = inject(MejoraPlanService);
  private readonly permisos = inject(PermissionService);

  private get limiteFinito(): boolean {
    return Number.isFinite(this.plan.limite('documentosMB'));
  }

  private mbUsados(): number {
    return Math.ceil(this.uso.usadoBytes() / MB);
  }

  /** `false` (y modal) si no se puede subir NADA: demo terminada o cupo ya agotado. Llamar antes de abrir el selector. */
  puedeSubir(): boolean {
    if (this.permisos.isSuperUser()) return true;
    if (this.plan.soloLectura()) {
      this.mejora.abrirPorBloqueo({ tipo: 'demoTerminada', recurso: 'demo' });
      return false;
    }
    if (!this.limiteFinito) return true;
    const limite = this.plan.limite('documentosMB');
    if (this.uso.usadoBytes() < limite * MB) return true;
    this.mejora.abrirPorBloqueo({ tipo: 'cupo', recurso: 'documentosMB', usado: this.mbUsados(), limite });
    return false;
  }

  /**
   * De los archivos elegidos devuelve los que caben (acumulando tamaños); en el primero que no cabe abre el modal
   * (una sola vez) y descarta ese y los siguientes.
   */
  admitir(archivos: readonly File[]): File[] {
    if (this.permisos.isSuperUser() || !this.limiteFinito) return [...archivos];
    const admitidos: File[] = [];
    let acumulado = 0;
    for (const archivo of archivos) {
      const r = evaluarEspacio({ usadoBytes: this.uso.usadoBytes() + acumulado, limiteMB: this.plan.limite('documentosMB'), bytes: archivo.size });
      if (!r.cabe) {
        this.avisarNoCabe(r.quedanMB, archivo.size);
        break;
      }
      admitidos.push(archivo);
      acumulado += archivo.size;
    }
    return admitidos;
  }

  /** Lanza `CupoAlmacenamientoError` (tras abrir el modal) si `bytes` no caben. */
  asegurar(bytes: number): void {
    if (this.permisos.isSuperUser()) return;
    const r = evaluarEspacio({ usadoBytes: this.uso.usadoBytes(), limiteMB: this.plan.limite('documentosMB'), bytes });
    if (r.cabe) return;
    const error = new CupoAlmacenamientoError(r.quedanMB, bytes);
    this.avisarNoCabe(r.quedanMB, bytes, error.message);
    throw error;
  }

  private avisarNoCabe(quedanMB: number, bytes: number, detalle = mensajeSinEspacio(quedanMB, bytes)): void {
    this.mejora.abrirPorBloqueo({
      tipo: 'cupo', recurso: 'documentosMB', usado: this.mbUsados(), limite: this.plan.limite('documentosMB'), detalle,
    });
  }
}
