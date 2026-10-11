import { Component, ChangeDetectionStrategy, inject, input, output, signal, computed, effect } from '@angular/core';
import { OverlayShellComponent } from '../../../../shared/components/overlay-shell/overlay-shell';
import type { CuentaBancaria, GestoriaSlot, MovimientoGestoria, MovimientoTipo, TipoIva } from '../../../../interfaces';
import { desglosarIva, calcularIvaDesdeBase } from '../../../../interfaces';
import { ImportePipe } from '../../../../core/moneda/importe.pipe';
import { MonedaEmpresaService } from '../../../../core/moneda/moneda-empresa.service';
import { FiscalEmpresaService } from '../../../../core/fiscal/fiscal-empresa.service';

export interface MovimientoFormData {
  tipo: MovimientoTipo;
  concepto: string;
  importe: number;
  esEntrada: boolean;
  fecha: string;
  notas?: string;
  cuentaId?: string;
  tipoIva: TipoIva;
  ivaExento: boolean;
  baseImponible: number;
  cuotaIva: number;
}

/** Valor del selector de IVA: un porcentaje del país (`'21'`, `'16'`...) o `'exento'` (operación exenta/no sujeta). */
type IvaSel = string;

@Component({
  selector: 'app-movimiento-form-drawer',
  imports: [ImportePipe, OverlayShellComponent],
  templateUrl: './movimiento-form-drawer.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MovimientoFormDrawerComponent {
  protected readonly moneda = inject(MonedaEmpresaService);
  private readonly fiscal = inject(FiscalEmpresaService);
  readonly visible = input.required<boolean>();
  readonly saving = input.required<boolean>();
  readonly prefillSlot = input.required<GestoriaSlot | null>();
  /** Movimiento en edición. `null` = alta. Tiene prioridad sobre `prefillSlot`. */
  readonly movimientoEdit = input<MovimientoGestoria | null>(null);
  readonly cuentas = input<CuentaBancaria[]>([]);

  /** true cuando el drawer edita un movimiento existente en lugar de crear uno. */
  readonly editando = computed(() => this.movimientoEdit() !== null);

  readonly saved = output<MovimientoFormData>();
  readonly closed = output<void>();

  readonly formConcepto = signal('');
  readonly formTipo = signal<MovimientoTipo>('ingreso');
  readonly formImporte = signal('');
  readonly formEsEntrada = signal(true);
  readonly formFecha = signal('');
  readonly formNotas = signal('');
  readonly formCuentaId = signal('');
  readonly formIva = signal<IvaSel>(String(this.fiscal.ivaPorDefecto()));
  readonly formIvaIncluido = signal(false);

  readonly tipos: readonly MovimientoTipo[] = ['ingreso', 'suplido', 'honorario', 'gasto', 'otro'];
  /** Tipos del país + el que traiga el movimiento en edición (puede ser de otro país: no se cambia en silencio) + exento. */
  readonly ivaOpciones = computed<readonly IvaSel[]>(() => [
    ...this.fiscal.opcionesIva([this.movimientoEdit()?.tipoIva]).map(String),
    'exento',
  ]);

  /** Tipo de IVA y exención derivados del selector. */
  private readonly ivaResuelto = computed<{ tipoIva: TipoIva; exento: boolean }>(() => {
    const sel = this.formIva();
    if (sel === 'exento') return { tipoIva: 0, exento: true };
    return { tipoIva: Number(sel) as TipoIva, exento: false };
  });

  /** Desglose base/cuota en vivo según el importe introducido. */
  readonly desglose = computed(() => {
    const raw = parseFloat(this.formImporte());
    const { tipoIva, exento } = this.ivaResuelto();
    if (!raw || raw <= 0) return { baseImponible: 0, cuotaIva: 0, total: 0 };
    if (this.formIvaIncluido()) {
      const { baseImponible, cuotaIva } = desglosarIva(raw, tipoIva, exento);
      return { baseImponible, cuotaIva, total: raw };
    }
    const { baseImponible, cuotaIva } = calcularIvaDesdeBase(raw, tipoIva, exento);
    return { baseImponible, cuotaIva, total: baseImponible + cuotaIva };
  });

  /** Dirección por defecto según tipo, aplicada solo al prefill. */
  private static readonly DIRECCION_POR_TIPO: Record<MovimientoTipo, boolean> = {
    ingreso: true,
    suplido: false,
    honorario: false,
    gasto: false,
    otro: true,
    ajuste: true,
  };

  /** Los suplidos y ajustes van exentos; el resto, al tipo general del país. */
  private static readonly EXENTO_POR_TIPO: Record<MovimientoTipo, boolean> = {
    ingreso: false,
    suplido: true,
    honorario: false,
    gasto: false,
    otro: false,
    ajuste: true,
  };

  private static readonly IVA_INCLUIDO_POR_TIPO: Record<MovimientoTipo, boolean> = {
    gasto: true, suplido: true, ajuste: true,
    ingreso: false, honorario: false, otro: true,
  };

  onTipoChange(tipo: MovimientoTipo): void {
    this.applyTipo(tipo, this.formEsEntrada());
  }

  private applyTipo(tipo: MovimientoTipo, fallback: boolean): void {
    this.formTipo.set(tipo);
    this.formEsEntrada.set(MovimientoFormDrawerComponent.DIRECCION_POR_TIPO[tipo] ?? fallback);
    this.formIva.set(MovimientoFormDrawerComponent.EXENTO_POR_TIPO[tipo] ? 'exento' : String(this.fiscal.ivaPorDefecto()));
    this.formIvaIncluido.set(MovimientoFormDrawerComponent.IVA_INCLUIDO_POR_TIPO[tipo]);
  }

  constructor() {
    effect(() => {
      if (this.visible()) this.prefill();
    });
  }

  private prefill(): void {
    const editado = this.movimientoEdit();
    if (editado) {
      this.prefillDesdeMovimiento(editado);
      return;
    }
    const slot = this.prefillSlot();
    const today = new Date().toISOString().slice(0, 10);
    if (slot) {
      this.formConcepto.set(slot.nombre);
      this.applyTipo(this.tipoCostoToMovTipo(slot.tipoCosto), false);
      if (slot.ivaIncluido !== undefined) {
        this.formIvaIncluido.set(slot.ivaIncluido);
      }
      this.formImporte.set(slot.importeEstimado != null ? String(slot.importeEstimado) : '');
    } else {
      this.formConcepto.set('');
      this.formImporte.set('');
      this.applyTipo('ingreso', true);
    }
    this.formFecha.set(today);
    this.formNotas.set('');
    this.formCuentaId.set('');
  }

  /**
   * Carga el formulario desde un movimiento guardado. `importe` es SIEMPRE el
   * total, así que el desglose entra en modo "IVA incluido" para que la base y
   * la cuota recalculadas coincidan con las almacenadas.
   */
  private prefillDesdeMovimiento(mov: MovimientoGestoria): void {
    this.formConcepto.set(mov.concepto);
    this.formTipo.set(mov.tipo);
    this.formEsEntrada.set(mov.esEntrada);
    this.formImporte.set(String(mov.importe));
    this.formFecha.set(mov.fecha);
    this.formNotas.set(mov.notas ?? '');
    this.formCuentaId.set(mov.cuentaId ?? '');
    this.formIva.set(mov.ivaExento ? 'exento' : String(mov.tipoIva ?? this.fiscal.ivaPorDefecto()));
    this.formIvaIncluido.set(true);
  }

  private tipoCostoToMovTipo(tipoCosto: string): MovimientoTipo {
    switch (tipoCosto) {
      case 'suplido':
      case 'costas_judiciales': return 'suplido';
      case 'cuota_litis':
      case 'honorarios_base': return 'honorario';
      case 'provisiones_fondos':
      case 'saldos_clientes': return 'ingreso';
      default: return 'gasto';
    }
  }

  submit(): void {
    const concepto = this.formConcepto().trim();
    if (!concepto || !this.formImporte()) return;
    if (this.cuentas().length > 0 && !this.formCuentaId()) return;
    const { tipoIva, exento } = this.ivaResuelto();
    const { baseImponible, cuotaIva, total } = this.desglose();
    this.saved.emit({
      tipo: this.formTipo(),
      concepto,
      importe: total || parseFloat(this.formImporte()),
      esEntrada: this.formEsEntrada(),
      fecha: this.formFecha(),
      notas: this.formNotas().trim() || undefined,
      cuentaId: this.formCuentaId() || undefined,
      tipoIva,
      ivaExento: exento,
      baseImponible,
      cuotaIva,
    });
  }
}
