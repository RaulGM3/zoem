import { Component, ChangeDetectionStrategy, input, output, signal, effect } from '@angular/core';
import { LucideAngularModule, X } from 'lucide-angular';
import type { CompanyMember, Hito, HitoEstado } from '../../../../interfaces';
import { HITO_ESTADOS, HITO_ESTADO_LABEL } from '../../../../core/hitos/hito-estado';

export interface HitoFormData {
  titulo: string;
  descripcion?: string;
  fechaEstimada?: string;
  asignadoA?: string;
  estado: HitoEstado;
}

@Component({
  selector: 'app-hito-form-drawer',
  imports: [LucideAngularModule],
  templateUrl: './hito-form-drawer.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HitoFormDrawerComponent {
  readonly visible = input.required<boolean>();
  readonly saving = input.required<boolean>();
  readonly editingHito = input.required<Hito | null>();
  readonly members = input.required<CompanyMember[]>();

  readonly saved = output<HitoFormData>();
  readonly closed = output<void>();

  readonly XIcon = X;

  readonly formTitulo = signal('');
  readonly formDescripcion = signal('');
  readonly formFechaEstimada = signal('');
  readonly formAsignadoA = signal('');
  readonly formEstado = signal<HitoEstado>('pendiente');

  readonly estados = HITO_ESTADOS;
  readonly estadoLabel = HITO_ESTADO_LABEL;

  constructor() {
    effect(() => {
      if (this.visible()) {
        const h = this.editingHito();
        this.formTitulo.set(h?.titulo ?? '');
        this.formDescripcion.set(h?.descripcion ?? '');
        this.formFechaEstimada.set(h?.fechaEstimada ?? '');
        this.formAsignadoA.set(h?.asignadoA ?? '');
        this.formEstado.set(h?.estado ?? 'pendiente');
      }
    });
  }

  submit(): void {
    const titulo = this.formTitulo().trim();
    if (!titulo) return;
    this.saved.emit({
      titulo,
      descripcion: this.formDescripcion().trim() || undefined,
      fechaEstimada: this.formFechaEstimada() || undefined,
      asignadoA: this.formAsignadoA() || undefined,
      estado: this.formEstado(),
    });
  }
}
