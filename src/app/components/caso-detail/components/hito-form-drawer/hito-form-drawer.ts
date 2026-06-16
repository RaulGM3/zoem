import { Component, ChangeDetectionStrategy, input, output, signal, effect } from '@angular/core';
import { LucideAngularModule, X } from 'lucide-angular';
import type { CompanyMember, Hito, HitoEstado } from '../../../../interfaces';
import { HITO_ESTADOS, HITO_ESTADO_LABEL } from '../../../../core/hitos/hito-estado';

export interface HitoFormData {
  titulo: string;
  descripcion?: string;
  fechaEstimada?: string;
  asignadoA?: string;       // compat: primer asignado
  asignadosA?: string[];    // multi-asignación
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
  readonly formAsignadosA = signal<string[]>([]);
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
        // Compat: si el hito sólo tiene asignadoA (legacy), lo sembramos como primer asignado.
        this.formAsignadosA.set(h?.asignadosA ?? (h?.asignadoA ? [h.asignadoA] : []));
        this.formEstado.set(h?.estado ?? 'pendiente');
      }
    });
  }

  isAsignado(userId: string): boolean {
    return this.formAsignadosA().includes(userId);
  }

  toggleAsignado(userId: string): void {
    this.formAsignadosA.update(list =>
      list.includes(userId) ? list.filter(id => id !== userId) : [...list, userId]
    );
  }

  submit(): void {
    const titulo = this.formTitulo().trim();
    if (!titulo) return;
    const asignados = this.formAsignadosA();
    this.saved.emit({
      titulo,
      descripcion: this.formDescripcion().trim() || undefined,
      fechaEstimada: this.formFechaEstimada() || undefined,
      asignadoA: asignados[0] ?? undefined,
      asignadosA: asignados.length > 0 ? asignados : undefined,
      estado: this.formEstado(),
    });
  }
}
