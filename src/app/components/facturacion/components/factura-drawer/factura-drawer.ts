import {
  Component,
  ChangeDetectionStrategy,
  input,
  output,
  effect,
  inject,
  signal,
  computed,
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

  readonly verifactuLocked = computed(() => {
    const inv = this.editingInvoice();
    return inv?.verifactu?.estado === 'enviado';
  });

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
      this.formValue.set(this.form.getRawValue());
    });

    // Initialize form when inputs arrive
    effect(() => {
      const lineas = this.initialLineas();
      const rate = this.defaultIvaRate();
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

  onConfirm(): void {
    if (this.form.invalid) return;
    const val = this.form.getRawValue();
    const globalRate = (val.ivaRate ?? 21) / 100;

    const lineas: InvoiceLinea[] = val.lineas.map((l) => {
      const cantidad = l['cantidad'] ?? 1;
      const precioUnitario = l['precioUnitario'] ?? 0;
      return {
        concepto: l['concepto'] ?? '',
        descripcion: l['descripcion'] || undefined,
        cantidad,
        precioUnitario,
        base: cantidad * precioUnitario,
        aplicaIva: l['aplicaIva'] ?? false,
        ivaRate: l['ivaRate'] != null ? l['ivaRate'] / 100 : undefined,
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
    });
  }
}
