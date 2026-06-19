import { Component, ChangeDetectionStrategy, input, output, signal, computed } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import {
  LucideAngularModule, Upload, Wand2, Link2, Unlink, EyeOff, CheckCircle2, AlertTriangle,
} from 'lucide-angular';
import type { CuentaBancaria, LineaExtracto } from '../../../../interfaces';

/** Movimiento enriquecido disponible para casar manualmente. */
export interface MovimientoConciliable {
  id: string;
  cuentaId?: string;
  fecha: string;
  concepto: string;
  importe: number;
  esEntrada: boolean;
  casoNombre: string;
  conciliado: boolean;
}

@Component({
  selector: 'app-conciliacion-tab',
  host: { style: 'display: block' },
  imports: [LucideAngularModule, DecimalPipe],
  templateUrl: './conciliacion-tab.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ConciliacionTabComponent {
  readonly cuentas = input.required<CuentaBancaria[]>();
  readonly lineas = input.required<LineaExtracto[]>();
  readonly movimientos = input.required<MovimientoConciliable[]>();
  readonly importando = input<boolean>(false);

  readonly importarCsv = output<{ cuentaId: string; texto: string }>();
  readonly autoConciliar = output<string>();
  readonly casar = output<{ cuentaId: string; lineaId: string; movimientoId: string }>();
  readonly desconciliar = output<{ cuentaId: string; lineaId: string }>();
  readonly ignorar = output<{ cuentaId: string; lineaId: string }>();

  readonly UploadIcon = Upload;
  readonly Wand2Icon = Wand2;
  readonly Link2Icon = Link2;
  readonly UnlinkIcon = Unlink;
  readonly EyeOffIcon = EyeOff;
  readonly CheckCircle2Icon = CheckCircle2;
  readonly AlertTriangleIcon = AlertTriangle;

  readonly cuentaSeleccionada = signal<string>('');

  readonly cuentaActual = computed(() =>
    this.cuentas().find(c => c.id === this.cuentaSeleccionada()) ?? null
  );

  readonly lineasCuenta = computed(() =>
    this.lineas()
      .filter(l => l.cuentaId === this.cuentaSeleccionada())
      .sort((a, b) => b.fecha.localeCompare(a.fecha))
  );

  /** Movimientos de la cuenta aún sin casar, candidatos para match manual. */
  readonly movimientosDisponibles = computed(() =>
    this.movimientos().filter(m => m.cuentaId === this.cuentaSeleccionada() && !m.conciliado)
  );

  /** Saldo según la última línea del extracto (la de fecha más reciente con saldo). */
  readonly saldoExtracto = computed<number | null>(() => {
    const conSaldo = this.lineasCuenta().find(l => l.saldoPosterior != null);
    return conSaldo?.saldoPosterior ?? null;
  });

  readonly pendientes = computed(() => this.lineasCuenta().filter(l => l.estado === 'pendiente').length);

  onFile(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    const cuentaId = this.cuentaSeleccionada();
    if (!file || !cuentaId) return;
    const reader = new FileReader();
    reader.onload = () => {
      this.importarCsv.emit({ cuentaId, texto: String(reader.result ?? '') });
      input.value = '';
    };
    reader.readAsText(file);
  }
}
