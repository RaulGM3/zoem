import { computed, signal } from '@angular/core';
import type { Provider } from '@angular/core';
import { formatearImporte } from './formatear-importe';
import { formatoDeEmpresa, simboloDeFormato, stepImporte } from './formato-empresa';
import { MonedaEmpresaService } from './moneda-empresa.service';

/**
 * Para specs de componentes con importes: sustituye a `MonedaEmpresaService` (que arrastra
 * `CompanyService` → Firestore). Por defecto EUR/es-ES; pasa una empresa para probar otra moneda.
 */
export function provideMonedaTest(empresa: { pais?: string; moneda?: string } | null = null): Provider {
  const formato = computed(() => formatoDeEmpresa(signal(empresa)()));
  const decimales = computed(() => formato().decimales);
  return {
    provide: MonedaEmpresaService,
    useValue: {
      formato,
      moneda: computed(() => formato().moneda),
      locale: computed(() => formato().locale),
      decimales,
      simbolo: computed(() => simboloDeFormato(formato())),
      step: computed(() => stepImporte(decimales())),
      formatear: (v: number | null | undefined) => formatearImporte(v, formato()),
    },
  };
}
