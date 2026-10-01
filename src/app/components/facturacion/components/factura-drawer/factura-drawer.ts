import {
  Component,
  ChangeDetectionStrategy,
  input,
  output,
  effect,
  inject,
  signal,
  computed,
  ElementRef,
} from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormArray, FormGroup, Validators } from '@angular/forms';
import {
  LucideAngularModule,
  X,
  ShieldCheck,
  Plus,
  Trash2,
  ChevronUp,
  ChevronDown,
} from 'lucide-angular';
import type { Invoice, InvoiceLinea } from '../../../../core/services/invoice.service';
import { normalizeLinea } from '../../../../core/services/invoice.service';
import { Caso } from '../../../../interfaces';
import {
  CAUSAS_EXENCION,
  CAUSA_EXENCION_LABELS,
  esLineaExenta,
  opcionesIva,
} from '../../../../interfaces/iva';
import type { CausaExencion } from '../../../../interfaces/verifactu.interface';
import { motivoBloqueoVerifactu } from '../../../../core/verifactu/verifactu-ui';

export interface InvoiceFormPayload {
  lineas: InvoiceLinea[];
  ivaRate: number;
  issueDate: string;
  dueDate: string;
  notes: string;
}

interface IvaGroup {
  rate: number;
  base: number;
  cuota: number;
}

@Component({
  selector: 'app-factura-drawer',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LucideAngularModule, DecimalPipe, ReactiveFormsModule],
  templateUrl: './factura-drawer.html',
})
export class FacturaDrawerComponent {
  private readonly fb = inject(FormBuilder);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  /** Opciones del selector de causa de exención (E1..E6, N1, N2). */
  readonly causasExencion = CAUSAS_EXENCION.map((valor) => ({ valor, etiqueta: CAUSA_EXENCION_LABELS[valor] }));

  /** Se pone a `true` al intentar confirmar con el formulario inválido: entonces se muestran los errores. */
  readonly submitted = signal(false);

  // --- Inputs ---
  readonly caso = input<Caso | null>(null);
  readonly initialLineas = input<InvoiceLinea[]>([]);
  readonly defaultIvaRate = input(21);
  readonly issueDate = input('');
  readonly dueDate = input('');
  readonly initialNotes = input('');
  readonly saving = input(false);
  readonly verifactuEnabled = input(false);
  readonly editMode = input(false);
  readonly editingInvoice = input<Invoice | null>(null);

  /** Motivo del bloqueo: registro vivo en Verifactu (en cola, pendiente o enviado). */
  readonly verifactuBloqueo = computed(() => {
    const inv = this.editingInvoice();
    return inv ? motivoBloqueoVerifactu(inv) : null;
  });
  readonly verifactuLocked = computed(() => this.verifactuBloqueo() !== null);

  /** Tipos de IVA seleccionables; incluye los tipos libres que ya traiga la factura. */
  readonly tiposIva = computed(() =>
    opcionesIva([
      this.defaultIvaRate(),
      ...this.initialLineas().map((l) => (l.ivaRate != null ? l.ivaRate * 100 : null)),
    ]),
  );

  readonly headerTitle = computed(() => this.editMode() ? 'Editar factura' : 'Generar factura');
  readonly confirmLabel = computed(() => {
    if (this.saving()) return this.editMode() ? 'Guardando…' : 'Generando…';
    return this.editMode() ? 'Guardar cambios' : 'Generar factura';
  });

  // --- Outputs ---
  readonly closed = output<void>();
  readonly confirmed = output<InvoiceFormPayload>();

  // --- Icons ---
  readonly XIcon = X;
  readonly ShieldCheckIcon = ShieldCheck;
  readonly PlusIcon = Plus;
  readonly Trash2Icon = Trash2;
  readonly ChevronUpIcon = ChevronUp;
  readonly ChevronDownIcon = ChevronDown;

  // --- Form ---
  readonly form = this.fb.group({
    ivaRate: [21],
    issueDate: [''],
    dueDate: [''],
    notes: [''],
    lineas: this.fb.array<FormGroup>([]),
  });

  get lineasArray(): FormArray<FormGroup> {
    return this.form.controls.lineas;
  }

  // --- Preview (driven by form value changes → signal) ---
  private readonly formValue = signal(this.form.getRawValue());

  /** Por línea: ¿su tipo efectivo es exento/no sujeto (y por tanto exige causa)? */
  readonly lineaExenta = computed(() => {
    const val = this.formValue();
    const globalRate = (val.ivaRate ?? 21) / 100;
    return val.lineas.map((l) =>
      esLineaExenta(
        { aplicaIva: !!l['aplicaIva'], ivaRate: l['ivaRate'] != null ? l['ivaRate'] / 100 : null },
        globalRate,
      ),
    );
  });

  readonly preview = computed(() => {
    const val = this.formValue();
    const globalRate = (val.ivaRate ?? 21) / 100;
    let base = 0;
    let iva = 0;
    for (const l of val.lineas) {
      const lineBase = (l['cantidad'] ?? 1) * (l['precioUnitario'] ?? 0);
      base += lineBase;
      if (l['aplicaIva']) {
        const rate = l['ivaRate'] != null ? l['ivaRate'] / 100 : globalRate;
        iva += lineBase * rate;
      }
    }
    return { base, iva, total: base + iva };
  });

  readonly ivaBreakdown = computed((): IvaGroup[] => {
    const val = this.formValue();
    const globalRate = (val.ivaRate ?? 21) / 100;
    const groups = new Map<number, { base: number; cuota: number }>();

    for (const l of val.lineas) {
      if (!l['aplicaIva']) continue;
      const rate = l['ivaRate'] != null ? l['ivaRate'] / 100 : globalRate;
      const pct = Math.round(rate * 100);
      const lineBase = (l['cantidad'] ?? 1) * (l['precioUnitario'] ?? 0);
      const existing = groups.get(pct) ?? { base: 0, cuota: 0 };
      existing.base += lineBase;
      existing.cuota += lineBase * rate;
      groups.set(pct, existing);
    }

    return Array.from(groups.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([rate, { base, cuota }]) => ({ rate, base, cuota }));
  });

  constructor() {
    // Sync form changes → signal for computed preview
    this.form.valueChanges.subscribe(() => {
      this.syncCausasExencion();
      this.formValue.set(this.form.getRawValue());
    });

    // Initialize form when inputs arrive
    effect(() => {
      const lineas = this.initialLineas();
      const rate = Math.round(this.defaultIvaRate());
      const issue = this.issueDate();
      const due = this.dueDate();
      const notes = this.initialNotes();

      this.form.patchValue({ ivaRate: rate, issueDate: issue, dueDate: due, notes }, { emitEvent: false });
      this.lineasArray.clear({ emitEvent: false });
      for (const l of lineas) {
        this.lineasArray.push(this.createLineaGroup(normalizeLinea(l)), { emitEvent: false });
      }
      if (this.lineasArray.length === 0) {
        this.lineasArray.push(this.createLineaGroup(normalizeLinea({})), { emitEvent: false });
      }
      this.syncCausasExencion();
      this.formValue.set(this.form.getRawValue());
    });
  }

  // --- Line item management ---

  addLinea(): void {
    this.lineasArray.push(
      this.createLineaGroup({
        concepto: '',
        cantidad: 1,
        precioUnitario: 0,
        base: 0,
        aplicaIva: true,
      }),
    );
  }

  removeLinea(index: number): void {
    if (this.lineasArray.length <= 1) return;
    this.lineasArray.removeAt(index);
  }

  moveLinea(from: number, direction: 'up' | 'down'): void {
    const to = direction === 'up' ? from - 1 : from + 1;
    if (to < 0 || to >= this.lineasArray.length) return;
    const control = this.lineasArray.at(from);
    this.lineasArray.removeAt(from, { emitEvent: false });
    this.lineasArray.insert(to, control);
  }

  lineSubtotal(index: number): number {
    const g = this.lineasArray.at(index);
    return (g.value['cantidad'] ?? 1) * (g.value['precioUnitario'] ?? 0);
  }

  // --- Confirm ---

  /** ¿Hay que mostrar el error de la causa de la línea `i`? */
  causaInvalida(i: number): boolean {
    const control = this.lineasArray.at(i).controls['causaExencion'];
    return !!control && control.invalid && (control.touched || this.submitted());
  }

  onConfirm(): void {
    if (this.form.invalid) {
      this.submitted.set(true);
      this.form.markAllAsTouched();
      this.host.nativeElement
        .querySelector<HTMLElement>('input.ng-invalid, select.ng-invalid, textarea.ng-invalid')
        ?.focus();
      return;
    }
    const val = this.form.getRawValue();
    const globalRate = (val.ivaRate ?? 21) / 100;
    const exentas = this.lineaExenta();

    const lineas: InvoiceLinea[] = val.lineas.map((l, i) => {
      const cantidad = l['cantidad'] ?? 1;
      const precioUnitario = l['precioUnitario'] ?? 0;
      const causa = exentas[i] ? (l['causaExencion'] as CausaExencion | '') : '';
      return {
        concepto: l['concepto'] ?? '',
        descripcion: l['descripcion'] || undefined,
        cantidad,
        precioUnitario,
        base: cantidad * precioUnitario,
        aplicaIva: l['aplicaIva'] ?? false,
        ivaRate: l['ivaRate'] != null ? l['ivaRate'] / 100 : undefined,
        ...(causa ? { causaExencion: causa } : {}),
      };
    });

    this.confirmed.emit({
      lineas,
      ivaRate: globalRate,
      issueDate: val.issueDate ?? '',
      dueDate: val.dueDate ?? '',
      notes: val.notes ?? '',
    });
  }

  // --- Private helpers ---

  private createLineaGroup(l: InvoiceLinea): FormGroup {
    return this.fb.group({
      concepto: [l.concepto, Validators.required],
      descripcion: [l.descripcion ?? ''],
      cantidad: [l.cantidad, [Validators.required, Validators.min(0.01)]],
      precioUnitario: [l.precioUnitario, Validators.required],
      aplicaIva: [l.aplicaIva],
      ivaRate: [l.ivaRate != null ? Math.round(l.ivaRate * 100) : null],
      causaExencion: [l.causaExencion ?? ''],
    });
  }

  /**
   * Mantiene la causa de exención de cada línea coherente con su tipo de IVA efectivo:
   * exenta -> obligatoria; no exenta -> sin validador y valor vaciado (S10.5).
   * Solo actualiza validez/valor del control de la causa, sin emitir eventos (evita bucles).
   */
  private syncCausasExencion(): void {
    const globalRate = (this.form.controls.ivaRate.value ?? 21) / 100;
    for (const group of this.lineasArray.controls) {
      const causa = group.controls['causaExencion'];
      if (!causa) continue;
      const rate = group.controls['ivaRate'].value;
      const exenta = esLineaExenta(
        { aplicaIva: !!group.controls['aplicaIva'].value, ivaRate: rate != null ? rate / 100 : null },
        globalRate,
      );
      if (exenta && !causa.hasValidator(Validators.required)) {
        causa.addValidators(Validators.required);
        causa.updateValueAndValidity({ emitEvent: false });
      } else if (!exenta && (causa.hasValidator(Validators.required) || causa.value)) {
        causa.removeValidators(Validators.required);
        causa.reset('', { emitEvent: false });
      }
    }
  }
}
