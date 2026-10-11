import { inject, Pipe, PipeTransform } from '@angular/core';
import { formatearImporte } from './formatear-importe';
import { MonedaEmpresaService } from './moneda-empresa.service';

/**
 * `{{ x | importe }}` → «1.234,50 €» · `{{ x | importe:'entero' }}` → «1.235 €» (KPIs y gráficos).
 *
 * Es IMPURA a propósito: lee la moneda del despacho activo (un signal) dentro de `transform`.
 * Una pipe pura solo se reevalúa cuando cambia el valor, así que al cambiar de despacho (EUR → COP)
 * seguiría mostrando el formato anterior hasta que cambiara el importe. La impura se reejecuta en cada
 * detección de cambios; sale barato porque `formatearImporte` reutiliza el `Intl.NumberFormat`.
 */
@Pipe({ name: 'importe', pure: false })
export class ImportePipe implements PipeTransform {
  private readonly moneda = inject(MonedaEmpresaService);

  transform(valor: number | null | undefined, modo: 'completo' | 'entero' = 'completo'): string {
    const formato = this.moneda.formato();
    return formatearImporte(valor, modo === 'entero' ? { ...formato, decimales: 0 } : formato);
  }
}
