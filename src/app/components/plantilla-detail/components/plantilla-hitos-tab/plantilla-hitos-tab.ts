import { Component, ChangeDetectionStrategy, OnInit, input, model, output, signal } from '@angular/core';
import { LucideAngularModule, Save, GripVertical, X, Trash2, Pencil, Check } from 'lucide-angular';
import type { CompanyMember, HitoPlantilla } from '../../../../interfaces';

/**
 * Pestaña "Hitos" de una plantilla de caso: lista reordenable, alta y edición.
 * La lista es un `model` para que el padre conserve los cambios sin guardar.
 */
@Component({
  selector: 'app-plantilla-hitos-tab',
  imports: [LucideAngularModule],
  templateUrl: './plantilla-hitos-tab.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
})
export class PlantillaHitosTabComponent implements OnInit {
  readonly hitos = model.required<HitoPlantilla[]>();
  readonly members = input<CompanyMember[]>([]);
  readonly saving = input(false);

  readonly save = output<void>();

  readonly SaveIcon = Save;
  readonly GripIcon = GripVertical;
  readonly XIcon = X;
  readonly Trash2Icon = Trash2;
  readonly PencilIcon = Pencil;
  readonly CheckIcon = Check;

  hitoTitulo = signal('');
  hitoDescripcion = signal('');
  hitoDias = signal('0');
  hitoAsignado = signal('');

  hitosDragFrom = signal<number | null>(null);
  hitosDragOver = signal<number | null>(null);

  editingHitoIndex = signal<number | null>(null);
  editHitoTitulo = signal('');
  editHitoDescripcion = signal('');
  editHitoDias = signal('0');
  editHitoAsignado = signal('');

  ngOnInit(): void {
    this.hitoAsignado.set(this.asignadoPorDefecto());
  }

  /** Con un único miembro no hay nada que elegir: se le asigna directamente. */
  private asignadoPorDefecto(): string {
    const m = this.members();
    return m.length === 1 ? m[0].userId : '';
  }

  addHito(): void {
    if (!this.hitoTitulo().trim()) return;
    const current = this.hitos();
    this.hitos.set([
      ...current,
      {
        id: crypto.randomUUID(),
        titulo: this.hitoTitulo().trim(),
        descripcion: this.hitoDescripcion().trim() || undefined,
        diasDesdeInicio: parseInt(this.hitoDias(), 10) || 0,
        asignadoA: this.hitoAsignado() || undefined,
        orden: current.length,
      },
    ]);
    this.clearHitoForm();
  }

  removeHito(id: string): void {
    this.hitos.update(list => {
      const filtered = list.filter(h => h.id !== id);
      filtered.forEach((h, i) => (h.orden = i));
      return filtered;
    });
  }

  clearHitoForm(): void {
    this.hitoTitulo.set('');
    this.hitoDescripcion.set('');
    this.hitoDias.set('0');
    this.hitoAsignado.set(this.asignadoPorDefecto());
  }

  onHitoDragStart(event: DragEvent, index: number): void {
    this.hitosDragFrom.set(index);
    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = 'move';
    }
  }

  onHitoDragOver(event: DragEvent, index: number): void {
    event.preventDefault();
    if (event.dataTransfer) event.dataTransfer.dropEffect = 'move';
    this.hitosDragOver.set(index);
  }

  onHitoDrop(event: DragEvent): void {
    event.preventDefault();
    const from = this.hitosDragFrom();
    const to = this.hitosDragOver();
    this.hitosDragFrom.set(null);
    this.hitosDragOver.set(null);
    if (from === null || to === null || from === to) return;
    const list = [...this.hitos()];
    const [item] = list.splice(from, 1);
    list.splice(to, 0, item);
    list.forEach((h, i) => (h.orden = i));
    this.hitos.set(list);
  }

  onHitoDragEnd(): void {
    this.hitosDragFrom.set(null);
    this.hitosDragOver.set(null);
  }

  openEditHito(index: number): void {
    const h = this.hitos()[index];
    this.editHitoTitulo.set(h.titulo);
    this.editHitoDescripcion.set(h.descripcion ?? '');
    this.editHitoDias.set(h.diasDesdeInicio.toString());
    this.editHitoAsignado.set(h.asignadoA ?? '');
    this.editingHitoIndex.set(index);
  }

  confirmEditHito(): void {
    const index = this.editingHitoIndex();
    if (index === null || !this.editHitoTitulo().trim()) return;
    this.hitos.update(list => {
      const updated = [...list];
      updated[index] = {
        ...updated[index],
        titulo: this.editHitoTitulo().trim(),
        descripcion: this.editHitoDescripcion().trim() || undefined,
        diasDesdeInicio: parseInt(this.editHitoDias(), 10) || 0,
        asignadoA: this.editHitoAsignado() || undefined,
      };
      return updated;
    });
    this.editingHitoIndex.set(null);
  }

  cancelEditHito(): void {
    this.editingHitoIndex.set(null);
  }

  getMemberName(userId?: string): string {
    if (!userId) return '—';
    const m = this.members().find(x => x.userId === userId);
    return m ? `${m.nombre}${m.apellido ? ' ' + m.apellido : ''}` : userId;
  }
}
