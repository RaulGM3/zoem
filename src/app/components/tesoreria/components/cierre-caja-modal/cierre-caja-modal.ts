import { Component, ChangeDetectionStrategy, input, output, signal, computed } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import {
  LucideAngularModule, X, CheckCircle2, AlertTriangle, Landmark, Wallet, Lock,
} from 'lucide-angular';
import type { CierreCuenta } from '../../../../interfaces';
import { FocusTrapDirective } from '../../../../shared/directives/focus-trap.directive';

@Component({
  selector: 'app-cierre-caja-modal',
  imports: [LucideAngularModule, DecimalPipe, FocusTrapDirective],
  templateUrl: './cierre-caja-modal.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CierreCajaModalComponent {
  readonly cuentas = input.required<CierreCuenta[]>();
  readonly saving = input<boolean>(false);

  readonly confirmed = output<string>();
  readonly closed = output<void>();

  readonly XIcon = X;
  readonly CheckCircle2Icon = CheckCircle2;
  readonly AlertTriangleIcon = AlertTriangle;
  readonly LandmarkIcon = Landmark;
  readonly WalletIcon = Wallet;
  readonly LockIcon = Lock;

  readonly notas = signal('');

  readonly fecha = computed(() =>
    new Date().toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' })
  );

  readonly totales = computed(() => {
    const cs = this.cuentas();
    return {
      ingresos: cs.reduce((a, c) => a + c.ingresos, 0),
      egresos: cs.reduce((a, c) => a + c.egresos, 0),
      sistemaTotal: cs.reduce((a, c) => a + c.sistema, 0),
    };
  });
}
