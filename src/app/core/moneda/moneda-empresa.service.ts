import { computed, inject, Injectable } from '@angular/core';
import { CompanyService } from '../services/company.service';
import { formatearImporte } from './formatear-importe';
import { formatoDeEmpresa, simboloDeFormato, stepImporte } from './formato-empresa';

/**
 * Moneda del despacho activo para las vistas: formato, símbolo y `step` de los inputs de importe.
 * Todo son `computed` sobre `activeCompany()`, así que cambiar de despacho lo actualiza solo.
 */
@Injectable({ providedIn: 'root' })
export class MonedaEmpresaService {
  private readonly company = inject(CompanyService);

  readonly formato = computed(() => formatoDeEmpresa(this.company.activeCompany()));
  readonly moneda = computed(() => this.formato().moneda);
  readonly locale = computed(() => this.formato().locale);
  readonly decimales = computed(() => this.formato().decimales);
  /** Para etiquetas: «Importe (€)». */
  readonly simbolo = computed(() => simboloDeFormato(this.formato()));
  /** `'0.01'` o `'1'` según los decimales de la moneda. */
  readonly step = computed(() => stepImporte(this.decimales()));

  /** Para textos construidos en TypeScript (actividad, conceptos). */
  formatear(valor: number | null | undefined): string {
    return formatearImporte(valor, this.formato());
  }
}
