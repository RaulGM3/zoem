import { Component, ChangeDetectionStrategy, input, output, signal, computed, effect } from '@angular/core';
import { LucideAngularModule, X } from 'lucide-angular';
import type { GestoriaSlot, MovimientoTipo } from '../../../../interfaces';

export interface MovimientoFormData {
  tipo: MovimientoTipo;
  concepto: string;
  importe: number;
  esEntrada: boolean;
  fecha: string;
  notas?: string;
}

@Component({
  selector: 'app-movimiento-form-drawer',
  imports: [LucideAngularModule],
  templateUrl: './movimiento-form-drawer.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MovimientoFormDrawerComponent {
  readonly visible = input.required<boolean>();
  readonly saving = input.required<boolean>();
  readonly prefillSlot = input.required<GestoriaSlot | null>();

  readonly saved = output<MovimientoFormData>();
  readonly closed = output<void>();

  readonly XIcon = X;

  readonly formConcepto = signal('');
  readonly formTipo = signal<MovimientoTipo>('ingreso');
  readonly formImporte = signal('');
  readonly formEsEntrada = signal(true);
  readonly formFecha = signal('');
  readonly formNotas = signal('');

  readonly tipos: readonly MovimientoTipo[] = ['ingreso', 'suplido', 'honorario', 'gasto', 'otro'];

  /** Dirección determinada por el tipo. `null` = el usuario la elige manualmente. */
  private static readonly DIRECCION_POR_TIPO: Record<MovimientoTipo, boolean | null> = {
    ingreso: true,
    suplido: false,
    honorario: false,
    gasto: false,
    otro: null,
  };

  /** La dirección solo es editable cuando el tipo no la determina (`otro`). */
  readonly direccionManual = computed(
    () => MovimientoFormDrawerComponent.DIRECCION_POR_TIPO[this.formTipo()] === null,
  );

  onTipoChange(tipo: MovimientoTipo): void {
    this.applyTipo(tipo, this.formEsEntrada());
  }

  /**
   * Setea el tipo y deriva la dirección de la regla.
   * `fallback` aplica solo para `otro`, donde la dirección es manual.
   */
  private applyTipo(tipo: MovimientoTipo, fallback: boolean): void {
    this.formTipo.set(tipo);
    const direccion = MovimientoFormDrawerComponent.DIRECCION_POR_TIPO[tipo];
    this.formEsEntrada.set(direccion ?? fallback);
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
    this.saved.emit({
      tipo: this.formTipo(),
      concepto,
      importe: parseFloat(this.formImporte()),
      esEntrada: this.formEsEntrada(),
      fecha: this.formFecha(),
      notas: this.formNotas().trim() || undefined,
    });
  }
}
