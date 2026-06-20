import {
  Component, ChangeDetectionStrategy, input, output, signal, inject,
} from '@angular/core';
import { LucideAngularModule, X } from 'lucide-angular';
import { FormsModule } from '@angular/forms';
import { GestoriaService } from '../../../../core/services/gestoria.service';
import { ToastService } from '../../../../core/services/toast.service';
import { CuentaBancaria } from '../../../../interfaces';

interface RetiroForm {
  concepto: string;
  importe: string;
  fecha: string;
  cuentaId: string;
  notas: string;
}

@Component({
  selector: 'app-retiro-drawer',
  imports: [LucideAngularModule, FormsModule],
  templateUrl: './retiro-drawer.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RetiroDrawerComponent {
  private readonly gestoriaService = inject(GestoriaService);
  private readonly toast = inject(ToastService);

  readonly cuentas = input<CuentaBancaria[]>([]);
  readonly closed = output<void>();

  readonly XIcon = X;
  readonly saving = signal(false);

  readonly form = signal<RetiroForm>({
    concepto: '',
    importe: '',
    fecha: new Date().toISOString().slice(0, 10),
    cuentaId: '',
    notas: '',
  });

  async save(): Promise<void> {
    const f = this.form();
    const importe = parseFloat(f.importe);
    if (!f.concepto.trim() || isNaN(importe) || importe <= 0) return;
    this.saving.set(true);
    try {
      await this.toast.run(
        () => this.gestoriaService.addRetiro({
          concepto: f.concepto.trim(),
          importe,
          fecha: f.fecha,
          cuentaId: f.cuentaId || undefined,
          notas: f.notas.trim() || undefined,
        }),
        {
          successMessage: 'Retiro registrado',
          errorTitle: 'No se pudo registrar el retiro',
          onSuccess: () => this.closed.emit(),
        }
      );
    } finally {
      this.saving.set(false);
    }
  }
}
