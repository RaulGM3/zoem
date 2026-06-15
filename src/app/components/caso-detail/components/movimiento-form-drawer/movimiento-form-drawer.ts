import { Component, ChangeDetectionStrategy, input, output, signal, effect } from '@angular/core';
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
      this.formTipo.set(this.tipoCostoToMovTipo(slot.tipoCosto));
      this.formImporte.set(slot.importeEstimado != null ? String(slot.importeEstimado) : '');
      this.formEsEntrada.set(false);
    } else {
      this.formConcepto.set('');
      this.formTipo.set('ingreso');
      this.formImporte.set('');
      this.formEsEntrada.set(true);
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
