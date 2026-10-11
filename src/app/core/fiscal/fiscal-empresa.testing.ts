import { computed, signal } from '@angular/core';
import type { Provider } from '@angular/core';
import { ivaLineaNueva, ivaPorDefecto, opcionesIva, tiposIva } from '../../interfaces/iva';
import { paisDeEmpresa, paisPorCodigo } from '../paises/catalogo-paises';
import { verifactuActivoEnEmpresa } from '../paises/geo-empresa';
import { FiscalEmpresaService } from './fiscal-empresa.service';

/**
 * Para specs de componentes: sustituye a `FiscalEmpresaService` (que arrastra `CompanyService` → Firestore).
 * Por defecto España sin Verifactu; pasa una empresa para probar otro país o Verifactu activado.
 */
export function provideFiscalTest(
  empresa: { pais?: string; verifactu?: { enabled?: boolean } } | null = null,
): Provider {
  const company = signal(empresa);
  const pais = computed(() => paisDeEmpresa(company()));
  const datosPais = computed(() => paisPorCodigo(pais()));
  return {
    provide: FiscalEmpresaService,
    useValue: {
      pais,
      datosPais,
      esEspana: computed(() => pais() === 'ES'),
      tiposIva: computed(() => tiposIva(pais())),
      ivaPorDefecto: computed(() => ivaPorDefecto(pais())),
      ivaLineaNueva: computed(() => ivaLineaNueva(pais())),
      etiquetaIdFiscal: computed(() => datosPais().etiquetaIdFiscal),
      verifactuDisponible: computed(() => verifactuActivoEnEmpresa(company())),
      opcionesIva: (extra: readonly (number | null | undefined)[]) => opcionesIva(pais(), extra),
    },
  };
}
