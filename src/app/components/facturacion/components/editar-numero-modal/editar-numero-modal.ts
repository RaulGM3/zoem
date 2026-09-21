import {
  Component,
  ChangeDetectionStrategy,
  input,
  output,
  inject,
  effect,
  signal,
  computed,
} from '@angular/core';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { LucideAngularModule, X, TriangleAlert } from 'lucide-angular';
import type { Invoice } from '../../../../core/services/invoice.service';

/** Serie automática del sistema: `F-YYYY-NNNN` (ordinaria) o `R-YYYY-NNNN` (rectificativa). */
const SERIE_AUTOMATICA = /^[FR]-\d{4}-\d{4}$/;

@Component({
  selector: 'app-editar-numero-modal',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LucideAngularModule, ReactiveFormsModule],
  templateUrl: './editar-numero-modal.html',
  host: {
    '(document:keydown.escape)': 'closed.emit()',
  },
})
export class EditarNumeroModalComponent {
  private readonly fb = inject(FormBuilder);

  readonly invoice = input.required<Invoice>();
  readonly saving = input(false);
  /** Números ya usados por otras facturas de la empresa, para avisar antes de enviar. */
  readonly existingNumbers = input<string[]>([]);

  readonly closed = output<void>();
  readonly confirmed = output<string>();

  readonly XIcon = X;
  readonly TriangleAlertIcon = TriangleAlert;

  readonly form = this.fb.nonNullable.group({
    numero: ['', Validators.required],
    acepto: [false, Validators.requiredTrue],
  });

  private readonly formValue = signal(this.form.getRawValue());

  constructor() {
    this.form.valueChanges.subscribe(() => this.formValue.set(this.form.getRawValue()));

    // Prellena el campo con el número actual cuando llega la factura.
    effect(() => {
      this.form.reset({ numero: this.invoice().invoiceNumber, acepto: false }, { emitEvent: false });
      this.formValue.set(this.form.getRawValue());
    });
  }

  private readonly numero = computed(() => this.formValue().numero.trim());

  readonly sinCambios = computed(() => this.numero() === this.invoice().invoiceNumber);

  readonly duplicado = computed(() => {
    const n = this.numero();
    return n.length > 0 && this.existingNumbers().includes(n);
  });

  readonly fueraDeSerie = computed(() => {
    const n = this.numero();
    return n.length > 0 && !SERIE_AUTOMATICA.test(n);
  });

  readonly error = computed(() => {
    if (this.numero().length === 0) return 'El número de factura no puede estar vacío.';
    if (this.duplicado()) return 'Ese número ya está en uso por otra factura.';
    return null;
  });

  readonly puedeConfirmar = computed(() =>
    !this.saving() &&
    this.error() === null &&
    !this.sinCambios() &&
    this.formValue().acepto,
  );

  onConfirm(): void {
    if (!this.puedeConfirmar()) return;
    this.confirmed.emit(this.numero());
  }
}
