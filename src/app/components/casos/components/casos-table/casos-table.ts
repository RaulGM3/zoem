import { Component, ChangeDetectionStrategy, input, output, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { LucideAngularModule, MoreHorizontal, Trash2 } from 'lucide-angular';
import type { Caso } from '../../../../interfaces';

@Component({
  selector: 'app-casos-table',
  host: {
    style: 'display: block',
    // Si la tabla se desplaza mientras el dropdown está abierto, el menú se
    // queda anclado a una posición fija en pantalla y visualmente se separa de
    // su trigger, aunque siga siendo clicable. Lo cerramos en cualquier scroll.
    '(window:scroll)': 'closeDropdownOnScroll()',
  },
  imports: [LucideAngularModule, DecimalPipe],
  templateUrl: './casos-table.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CasosTableComponent {
  readonly casos = input.required<Caso[]>();
  readonly loading = input.required<boolean>();
  /** Subtítulo por caso (casoId → texto): nombre del cliente o, en su defecto, descripción. */
  readonly subtitulos = input.required<Record<string, string>>();
  /** Gating de permisos (`Casos.eliminar`): oculta la acción "Eliminar" del dropdown. */
  readonly canDelete = input(true);
  readonly casoClick = output<Caso>();
  readonly deleteCaso = output<Caso>();

  readonly MoreHorizontalIcon = MoreHorizontal;
  readonly TrashIcon = Trash2;

  /** Longitud máxima del subtítulo antes de truncar. La lista completa queda en el `title`. */
  private readonly MAX_SUBTITULO = 60;

  readonly activeDropdown = signal<string | null>(null);
  readonly activeCaso = signal<Caso | null>(null);
  readonly dropdownPos = signal<{ top: number; right: number } | null>(null);
  readonly casoToDelete = signal<Caso | null>(null);

  /** Cierra el dropdown contextual si la página se desplaza mientras está abierto (ver `host` listener). */
  closeDropdownOnScroll(): void {
    if (this.activeDropdown() === null) return;
    this.activeDropdown.set(null);
    this.activeCaso.set(null);
    this.dropdownPos.set(null);
  }

  toggleDropdown(caso: Caso, event: MouseEvent): void {
    event.stopPropagation();
    if (this.activeDropdown() === caso.id) {
      this.activeDropdown.set(null);
      this.activeCaso.set(null);
      this.dropdownPos.set(null);
    } else {
      const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
      this.dropdownPos.set({ top: rect.bottom + 4, right: window.innerWidth - rect.right });
      this.activeDropdown.set(caso.id);
      this.activeCaso.set(caso);
    }
  }

  openDeleteDialog(event: MouseEvent): void {
    event.stopPropagation();
    this.casoToDelete.set(this.activeCaso());
    this.activeDropdown.set(null);
    this.activeCaso.set(null);
    this.dropdownPos.set(null);
  }

  confirmDelete(): void {
    const caso = this.casoToDelete();
    if (caso) this.deleteCaso.emit(caso);
    this.casoToDelete.set(null);
  }

  cancelDelete(): void {
    this.casoToDelete.set(null);
  }

  truncarSubtitulo(texto: string): string {
    return texto.length > this.MAX_SUBTITULO
      ? texto.slice(0, this.MAX_SUBTITULO).trimEnd() + '…'
      : texto;
  }

  getDiasVencimiento(vencimiento?: string): number {
    if (!vencimiento) return -1;
    const diff = new Date(vencimiento).getTime() - new Date().getTime();
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
  }

  getHitosProgress(caso: Caso): string {
    // `loadCasos()` no trae la subcolección de hitos: el progreso se lee del
    // resumen denormalizado (`hitosResumen`), actualizado en cada mutación de hito.
    const total = caso.hitosResumen?.total ?? 0;
    if (total === 0) return '—';
    return `${caso.hitosResumen?.completados ?? 0}/${total}`;
  }

  getPriorityColor(prioridad: string): string {
    if (prioridad === 'alta') return 'var(--danger)';
    if (prioridad === 'media') return 'var(--warning)';
    return 'var(--success)';
  }

  getEstadoStyle(estado: string): { background: string; color: string } {
    const mix = (v: string) => `color-mix(in srgb,${v} 12%,transparent)`;
    const map: Record<string, { background: string; color: string }> = {
      pendiente:  { background: mix('var(--warning)'), color: 'var(--warning)' },
      en_proceso: { background: mix('var(--brand)'),   color: 'var(--brand)' },
      cerrado:    { background: 'var(--surface-2)',     color: 'var(--text-muted)' },
      urgente:    { background: mix('var(--danger)'),   color: 'var(--danger)' },
      archivado:  { background: 'var(--surface-2)',     color: 'var(--text-faint)' },
    };
    return map[estado] ?? { background: 'var(--surface-2)', color: 'var(--text-muted)' };
  }

  getTipoStyle(tipo: string): { background: string; color: string } {
    const mix = (v: string) => `color-mix(in srgb,${v} 12%,transparent)`;
    const map: Record<string, { background: string; color: string }> = {
      Legal:     { background: mix('var(--accent-ia)'), color: 'var(--accent-ia)' },
      Fiscal:    { background: mix('var(--brand)'),     color: 'var(--brand)' },
      Laboral:   { background: mix('var(--warning)'),   color: 'var(--warning)' },
      Mercantil: { background: mix('var(--success)'),   color: 'var(--success)' },
      Civil:     { background: 'var(--surface-2)',       color: 'var(--text-muted)' },
    };
    return map[tipo] ?? { background: 'var(--surface-2)', color: 'var(--text-muted)' };
  }

  getVencimientoStyle(dias: number): { color: string; fontWeight?: string } {
    if (dias < 0)    return { color: 'var(--text-faint)' };
    if (dias <= 14)  return { color: 'var(--danger)', fontWeight: '600' };
    if (dias <= 30)  return { color: 'var(--warning)' };
    return { color: 'var(--text-muted)' };
  }
}
