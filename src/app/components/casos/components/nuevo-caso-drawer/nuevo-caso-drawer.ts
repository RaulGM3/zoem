import { Component, ChangeDetectionStrategy, input, output, signal, effect } from '@angular/core';
import { LucideAngularModule, X } from 'lucide-angular';
import type { CasoEstado, CasoPrioridad, CasoTipo, CreateCasoData } from '../../../../interfaces';
import type { CasoPlantilla } from '../../../../interfaces';

@Component({
  selector: 'app-nuevo-caso-drawer',
  imports: [LucideAngularModule],
  templateUrl: './nuevo-caso-drawer.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NuevoCasoDrawerComponent {
  readonly visible = input.required<boolean>();
  readonly plantillas = input.required<CasoPlantilla[]>();
  readonly saving = input.required<boolean>();

  readonly saved = output<CreateCasoData>();
  readonly closed = output<void>();

  readonly XIcon = X;

  readonly estados: readonly CasoEstado[] = ['pendiente', 'en_proceso', 'cerrado', 'urgente', 'archivado'];
  readonly tipos: readonly CasoTipo[] = ['Legal', 'Fiscal', 'Laboral', 'Mercantil', 'Civil'];
  readonly prioridades: readonly CasoPrioridad[] = ['alta', 'media', 'baja'];

  readonly formTitulo = signal('');
  readonly formDescripcion = signal('');
  readonly formTipo = signal<CasoTipo>('Legal');
  readonly formEstado = signal<CasoEstado>('pendiente');
  readonly formPrioridad = signal<CasoPrioridad>('media');
  readonly formVencimiento = signal('');
  readonly formSinVencimiento = signal(false);
  readonly formPlantillaId = signal('');

  constructor() {
    effect(() => {
      if (this.visible()) this.resetForm();
    });
  }

  private resetForm(): void {
    this.formTitulo.set('');
    this.formDescripcion.set('');
    this.formTipo.set('Legal');
    this.formEstado.set('pendiente');
    this.formPrioridad.set('media');
    this.formVencimiento.set('');
    this.formSinVencimiento.set(false);
    this.formPlantillaId.set('');
  }

  onPlantillaChange(id: string): void {
    this.formPlantillaId.set(id);
    const plantilla = this.plantillas().find(p => p.id === id);
    if (plantilla?.tipo) this.formTipo.set(plantilla.tipo);
  }

  submit(): void {
    const titulo = this.formTitulo().trim();
    if (!titulo) return;
    this.saved.emit({
      titulo,
      descripcion: this.formDescripcion().trim() || undefined,
      tipo: this.formTipo(),
      estado: this.formEstado(),
      prioridad: this.formPrioridad(),
      vencimiento: this.formSinVencimiento() ? undefined : (this.formVencimiento() || undefined),
      contactoIds: [],
      plantillaId: this.formPlantillaId() || undefined,
    });
  }
}
