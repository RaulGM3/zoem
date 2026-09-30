import { Component, ChangeDetectionStrategy, input, model, output, signal } from '@angular/core';
import { LucideAngularModule, Save, GripVertical, X, Trash2, Pencil, Check } from 'lucide-angular';
import type { PartidaCosto, TipoCosto } from '../../../../interfaces';

const TIPOS_COSTO: { value: TipoCosto; label: string }[] = [
  { value: 'gastos_repercutibles', label: 'Gastos repercutibles' },
  { value: 'suplido', label: 'Suplido' },
  { value: 'intereses_demora', label: 'Intereses de demora' },
  { value: 'saldos_clientes', label: 'Saldos de clientes' },
  { value: 'provisiones_fondos', label: 'Provisiones de fondos' },
  { value: 'cuota_litis', label: 'Cuota litis' },
  { value: 'costas_judiciales', label: 'Costas judiciales' },
];

/**
 * Pestaña "Estructura de costos" de una plantilla de caso: honorarios base y
 * partidas reordenables. Ambos son `model` para que el padre conserve los
 * cambios sin guardar.
 */
@Component({
  selector: 'app-plantilla-costos-tab',
  imports: [LucideAngularModule],
  templateUrl: './plantilla-costos-tab.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
})
export class PlantillaCostosTabComponent {
  readonly honorarios = model.required<string>();
  readonly suplidos = model.required<PartidaCosto[]>();
  readonly saving = input(false);

  readonly save = output<void>();

  readonly SaveIcon = Save;
  readonly GripIcon = GripVertical;
  readonly XIcon = X;
  readonly Trash2Icon = Trash2;
  readonly PencilIcon = Pencil;
  readonly CheckIcon = Check;

  readonly tiposCosto = TIPOS_COSTO;

  suplidoNombre = signal('');
  suplidoTipo = signal<TipoCosto | ''>('');
  suplidoImporte = signal('');

  suplidosDragFrom = signal<number | null>(null);
  suplidosDragOver = signal<number | null>(null);

  editingSuplidoIndex = signal<number | null>(null);
  editSuplidoNombre = signal('');
  editSuplidoTipo = signal<TipoCosto | ''>('');
  editSuplidoImporte = signal('');

  addSuplido(): void {
    if (!this.suplidoNombre().trim() || !this.suplidoTipo()) return;
    const importe = this.suplidoImporte() ? parseFloat(this.suplidoImporte()) : undefined;
    this.suplidos.update(list => [
      ...list,
      {
        nombre: this.suplidoNombre().trim(),
        tipo: this.suplidoTipo() as TipoCosto,
        ...(importe != null ? { importeEstimado: importe } : {}),
      },
    ]);
    this.clearSuplidoForm();
  }

  removeSuplido(index: number): void {
    this.suplidos.update(list => list.filter((_, i) => i !== index));
  }

  clearSuplidoForm(): void {
    this.suplidoNombre.set('');
    this.suplidoTipo.set('');
    this.suplidoImporte.set('');
  }

  getTipoCostoLabel(tipo: TipoCosto): string {
    return this.tiposCosto.find(t => t.value === tipo)?.label ?? tipo;
  }

  onSuplidoDragStart(event: DragEvent, index: number): void {
    this.suplidosDragFrom.set(index);
    if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move';
  }

  onSuplidoDragOver(event: DragEvent, index: number): void {
    event.preventDefault();
    if (event.dataTransfer) event.dataTransfer.dropEffect = 'move';
    this.suplidosDragOver.set(index);
  }

  onSuplidoDrop(event: DragEvent): void {
    event.preventDefault();
    const from = this.suplidosDragFrom();
    const to = this.suplidosDragOver();
    this.suplidosDragFrom.set(null);
    this.suplidosDragOver.set(null);
    if (from === null || to === null || from === to) return;
    const list = [...this.suplidos()];
    const [item] = list.splice(from, 1);
    list.splice(to, 0, item);
    this.suplidos.set(list);
  }

  onSuplidoDragEnd(): void {
    this.suplidosDragFrom.set(null);
    this.suplidosDragOver.set(null);
  }

  openEditSuplido(index: number): void {
    const s = this.suplidos()[index];
    this.editSuplidoNombre.set(s.nombre);
    this.editSuplidoTipo.set(s.tipo);
    this.editSuplidoImporte.set(s.importeEstimado?.toString() ?? '');
    this.editingSuplidoIndex.set(index);
  }

  confirmEditSuplido(): void {
    const index = this.editingSuplidoIndex();
    if (index === null || !this.editSuplidoNombre().trim() || !this.editSuplidoTipo()) return;
    const importe = this.editSuplidoImporte() ? parseFloat(this.editSuplidoImporte()) : undefined;
    this.suplidos.update(list => {
      const updated = [...list];
      updated[index] = {
        ...updated[index],
        nombre: this.editSuplidoNombre().trim(),
        tipo: this.editSuplidoTipo() as TipoCosto,
        importeEstimado: importe,
      };
      return updated;
    });
    this.editingSuplidoIndex.set(null);
  }

  cancelEditSuplido(): void {
    this.editingSuplidoIndex.set(null);
  }
}
