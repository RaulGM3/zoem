import { Component, ChangeDetectionStrategy, input, output, signal, computed, effect } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { LucideAngularModule, X } from 'lucide-angular';
import type { CuentaBancaria, GestoriaSlot, MovimientoTipo, TipoIva } from '../../../../interfaces';
import { desglosarIva } from '../../../../interfaces';

export interface MovimientoFormData {
  tipo: MovimientoTipo;
  concepto: string;
  importe: number;
  esEntrada: boolean;
  fecha: string;
  notas?: string;
  cuentaId: string;
  tipoIva: TipoIva;
  ivaExento: boolean;
  baseImponible: number;
  cuotaIva: number;
}

/** Valor del selector de IVA: porcentajes o 'exento' (operación exenta/no sujeta). */
type IvaSel = '21' | '10' | '4' | '0' | 'exento';

@Component({
  selector: 'app-movimiento-form-drawer',
  imports: [LucideAngularModule, DecimalPipe],
  templateUrl: './movimiento-form-drawer.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MovimientoFormDrawerComponent {
  readonly visible = input.required<boolean>();
  readonly saving = input.required<boolean>();
  readonly prefillSlot = input.required<GestoriaSlot | null>();
  readonly cuentas = input<CuentaBancaria[]>([]);

  readonly saved = output<MovimientoFormData>();
  readonly closed = output<void>();

  readonly XIcon = X;

  readonly formConcepto = signal('');
  readonly formTipo = signal<MovimientoTipo>('ingreso');
  readonly formImporte = signal('');
  readonly formEsEntrada = signal(true);
  readonly formFecha = signal('');
  readonly formNotas = signal('');
  readonly formCuentaId = signal('');
  readonly formIva = signal<IvaSel>('21');

  readonly tipos: readonly MovimientoTipo[] = ['ingreso', 'suplido', 'honorario', 'gasto', 'otro'];
  readonly ivaOpciones: readonly IvaSel[] = ['21', '10', '4', '0', 'exento'];

  /** Tipo de IVA y exención derivados del selector. */
  private readonly ivaResuelto = computed<{ tipoIva: TipoIva; exento: boolean }>(() => {
    const sel = this.formIva();
    if (sel === 'exento') return { tipoIva: 0, exento: true };
    return { tipoIva: Number(sel) as TipoIva, exento: false };
  });

  /** Desglose base/cuota en vivo según el importe total tecleado. */
  readonly desglose = computed(() => {
    const total = parseFloat(this.formImporte());
    const { tipoIva, exento } = this.ivaResuelto();
    if (!total || total <= 0) return { baseImponible: 0, cuotaIva: 0 };
    return desglosarIva(total, tipoIva, exento);
  });

  /** Dirección por defecto según tipo, aplicada solo al prefill. */
  private static readonly DIRECCION_POR_TIPO: Record<MovimientoTipo, boolean> = {
    ingreso: true,
    suplido: false,
    honorario: false,
    gasto: false,
    otro: true,
  };

  /** IVA por defecto según tipo: los suplidos van exentos, el resto al general. */
  private static readonly IVA_POR_TIPO: Record<MovimientoTipo, IvaSel> = {
    ingreso: '21',
    suplido: 'exento',
    honorario: '21',
    gasto: '21',
    otro: '21',
  };

  onTipoChange(tipo: MovimientoTipo): void {
    this.applyTipo(tipo, this.formEsEntrada());
  }

  private applyTipo(tipo: MovimientoTipo, fallback: boolean): void {
    this.formTipo.set(tipo);
    this.formEsEntrada.set(MovimientoFormDrawerComponent.DIRECCION_POR_TIPO[tipo] ?? fallback);
    this.formIva.set(MovimientoFormDrawerComponent.IVA_POR_TIPO[tipo]);
  }

  constructor() {
    effect(() => {
      if (this.visible()) this.prefill();
    });
  }

  private prefill(): void {
    const slot = this.prefillSlot();
    const today = new Date().toISOString().slice(0, 10);
    if (slot) {
      this.formConcepto.set(slot.nombre);
      this.formImporte.set(slot.importeEstimado != null ? String(slot.importeEstimado) : '');
      this.applyTipo(this.tipoCostoToMovTipo(slot.tipoCosto), false);
    } else {
      this.formConcepto.set('');
      this.formImporte.set('');
      this.applyTipo('ingreso', true);
    }
    this.formFecha.set(today);
    this.formNotas.set('');
    this.formCuentaId.set('');
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
    if (!concepto || !this.formImporte() || !this.formCuentaId()) return;
    const { tipoIva, exento } = this.ivaResuelto();
    const { baseImponible, cuotaIva } = this.desglose();
    this.saved.emit({
      tipo: this.formTipo(),
      concepto,
      importe: parseFloat(this.formImporte()),
      esEntrada: this.formEsEntrada(),
      fecha: this.formFecha(),
      notas: this.formNotas().trim() || undefined,
      cuentaId: this.formCuentaId(),
      tipoIva,
      ivaExento: exento,
      baseImponible,
      cuotaIva,
    });
  }
}
