import { computed, inject, Injectable } from '@angular/core';
import { ivaLineaNueva, ivaPorDefecto, opcionesIva, tiposIva } from '../../interfaces/iva';
import { paisDeEmpresa, paisPorCodigo } from '../paises/catalogo-paises';
import { verifactuActivoEnEmpresa } from '../paises/geo-empresa';
import { CompanyService } from '../services/company.service';

/**
 * Reglas fiscales del despacho activo: IVA del país, etiqueta del id fiscal y qué funciones solo
 * existen en España (Verifactu, causas de exención LIVA, validación AEAT del QR, modelo 303).
 * Todo son `computed` sobre `activeCompany()`; cambiar de despacho lo actualiza solo.
 */
@Injectable({ providedIn: 'root' })
export class FiscalEmpresaService {
  private readonly company = inject(CompanyService);

  readonly pais = computed(() => paisDeEmpresa(this.company.activeCompany()));
  readonly datosPais = computed(() => paisPorCodigo(this.pais()));
  readonly esEspana = computed(() => this.pais() === 'ES');

  /** Tipos de IVA vigentes en el país del despacho. */
  readonly tiposIva = computed(() => tiposIva(this.pais()));
  /** Tipo general, en porcentaje. */
  readonly ivaPorDefecto = computed(() => ivaPorDefecto(this.pais()));
  /** Tipo (fracción) con el que nacen las líneas nuevas. */
  readonly ivaLineaNueva = computed(() => ivaLineaNueva(this.pais()));
  /** 'NIF/CIF' | 'NIT' | 'RUT' | 'RFC'. */
  readonly etiquetaIdFiscal = computed(() => this.datosPais().etiquetaIdFiscal);

  /** Verifactu existe solo en España y además el despacho debe tenerlo activado. */
  readonly verifactuDisponible = computed(() => verifactuActivoEnEmpresa(this.company.activeCompany()));

  /** Opciones de un selector de IVA: los del país más los `extra` heredados (documentos antiguos). */
  opcionesIva(extra: readonly (number | null | undefined)[]): number[] {
    return opcionesIva(this.pais(), extra);
  }
}
