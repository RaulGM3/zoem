import {
  Component, ChangeDetectionStrategy, input, output, signal, computed, effect,
  inject,
} from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { LucideAngularModule, X, Trash2 } from 'lucide-angular';
import type { CuentaBancaria, MovimientoGestoria, MovimientoTipo } from '../../../../interfaces';
import { desglosarIva, calcularIvaDesdeBase } from '../../../../interfaces';
import type { TipoIva } from '../../../../interfaces/iva';
import { GestoriaService } from '../../../../core/services/gestoria.service';
import { CuentasService } from '../../../../core/services/cuentas.service';
import { ToastService } from '../../../../core/services/toast.service';

type IvaSel = '21' | '10' | '4' | '0' | 'exento';

const TIPOS: { value: MovimientoTipo; label: string }[] = [
  { value: 'gasto',   label: 'Gasto general' },
  { value: 'ingreso', label: 'Ingreso general' },
  { value: 'ajuste',  label: 'Ajuste de saldo' },
  { value: 'otro',    label: 'Otro' },
];

const DIRECCION_POR_TIPO: Record<MovimientoTipo, boolean> = {
  ingreso: true, suplido: true, honorario: true,
  gasto: false, otro: true, ajuste: true,
};

const IVA_POR_TIPO: Record<MovimientoTipo, IvaSel> = {
  ingreso: '21', suplido: 'exento', honorario: '21',
  gasto: '21', otro: '21', ajuste: 'exento',
};

const IVA_INCLUIDO_POR_TIPO: Record<MovimientoTipo, boolean> = {
  gasto: true, suplido: true, ajuste: true,
  ingreso: false, honorario: false, otro: true,
};

@Component({
  selector: 'app-movimiento-general-drawer',
  imports: [LucideAngularModule, DecimalPipe],
  templateUrl: './movimiento-general-drawer.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MovimientoGeneralDrawerComponent {
  private readonly gestoriaService = inject(GestoriaService);
  private readonly cuentasService = inject(CuentasService);
  private readonly toast = inject(ToastService);

  readonly visible = input.required<boolean>();
  readonly editando = input<MovimientoGestoria | null>(null);
  readonly closed = output<void>();

  readonly XIcon = X;
  readonly Trash2Icon = Trash2;

  readonly cuentas = this.cuentasService.cuentas;
  readonly tipos = TIPOS;
  readonly ivaOpciones: IvaSel[] = ['21', '10', '4', '0', 'exento'];

  readonly saving = signal(false);
  readonly deleting = signal(false);

  readonly formTipo = signal<MovimientoTipo>('gasto');
  readonly formConcepto = signal('');
  readonly formImporte = signal('');
  readonly formEsEntrada = signal(false);
  readonly formFecha = signal('');
  readonly formCuentaId = signal('');
  readonly formNotas = signal('');
  readonly formIva = signal<IvaSel>('21');
  readonly formIvaIncluido = signal(true);

  private readonly ivaResuelto = computed<{ tipoIva: TipoIva; exento: boolean }>(() => {
    const sel = this.formIva();
    if (sel === 'exento') return { tipoIva: 0, exento: true };
    return { tipoIva: Number(sel) as TipoIva, exento: false };
  });

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

  readonly canSubmit = computed(() =>
    !!this.formConcepto().trim() && !!this.formImporte() && parseFloat(this.formImporte()) > 0
  );

  readonly modoEdicion = computed(() => !!this.editando());

  constructor() {
    effect(() => {
      if (this.visible()) this.prefill();
    });
  }

  private prefill(): void {
    const mov = this.editando();
    const today = new Date().toISOString().slice(0, 10);
    if (mov) {
      this.formTipo.set(mov.tipo);
      this.formConcepto.set(mov.concepto);
      this.formEsEntrada.set(mov.esEntrada);
      this.formFecha.set(mov.fecha);
      this.formCuentaId.set(mov.cuentaId ?? '');
      this.formNotas.set(mov.notas ?? '');
      const cuota = mov.cuotaIva ?? 0;
      const base = mov.baseImponible ?? mov.importe;
      if (mov.ivaExento) {
        this.formIva.set('exento');
      } else if (cuota > 0 && base > 0) {
        const pct = Math.round((cuota / base) * 100);
        this.formIva.set((['21', '10', '4', '0'] as IvaSel[]).find(v => Number(v) === pct) ?? '21');
      } else {
        this.formIva.set('0');
      }
      const ivaIncluido = IVA_INCLUIDO_POR_TIPO[mov.tipo];
      this.formIvaIncluido.set(ivaIncluido);
      this.formImporte.set(ivaIncluido ? String(mov.importe) : String(base));
    } else {
      this.applyTipo('gasto');
      this.formConcepto.set('');
      this.formImporte.set('');
      this.formFecha.set(today);
      this.formCuentaId.set('');
      this.formNotas.set('');
    }
  }

  onTipoChange(tipo: MovimientoTipo): void {
    this.applyTipo(tipo);
  }

  private applyTipo(tipo: MovimientoTipo): void {
    this.formTipo.set(tipo);
    this.formEsEntrada.set(DIRECCION_POR_TIPO[tipo]);
    this.formIva.set(IVA_POR_TIPO[tipo]);
    this.formIvaIncluido.set(IVA_INCLUIDO_POR_TIPO[tipo]);
  }

  async submit(): Promise<void> {
    if (!this.canSubmit()) return;
    const { tipoIva, exento } = this.ivaResuelto();
    const { baseImponible, cuotaIva, total } = this.desglose();
    const data = {
      tipo: this.formTipo(),
      concepto: this.formConcepto().trim(),
      importe: total || parseFloat(this.formImporte()),
      esEntrada: this.formEsEntrada(),
      fecha: this.formFecha(),
      notas: this.formNotas().trim() || undefined,
      cuentaId: this.formCuentaId() || undefined,
      tipoIva,
      ivaExento: exento,
      baseImponible,
      cuotaIva,
    };

    this.saving.set(true);
    try {
      const mov = this.editando();
      if (mov) {
        await this.toast.run(() => this.gestoriaService.updateMovimientoGeneral(mov.id, data), {
          successMessage: 'Movimiento actualizado',
          errorTitle: 'No se pudo actualizar el movimiento',
          onSuccess: () => this.closed.emit(),
        });
      } else {
        await this.toast.run(() => this.gestoriaService.addMovimientoGeneral(data), {
          successMessage: 'Movimiento registrado',
          errorTitle: 'No se pudo registrar el movimiento',
          onSuccess: () => this.closed.emit(),
        });
      }
    } finally {
      this.saving.set(false);
    }
  }

  async eliminar(): Promise<void> {
    const mov = this.editando();
    if (!mov) return;
    this.deleting.set(true);
    try {
      await this.toast.run(() => this.gestoriaService.deleteMovimientoGeneral(mov.id), {
        successMessage: 'Movimiento eliminado',
        errorTitle: 'No se pudo eliminar el movimiento',
        onSuccess: () => this.closed.emit(),
      });
    } finally {
      this.deleting.set(false);
    }
  }
}
