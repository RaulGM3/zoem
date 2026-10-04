import { Component, ChangeDetectionStrategy, inject, input, output } from '@angular/core';
import { BreakpointService } from '../../../../core/services/breakpoint.service';
import { LucideAngularModule, ArrowLeft, Edit2 } from 'lucide-angular';
import { RouterLink } from '@angular/router';

export type CasoTab = 'info' | 'hitos' | 'gestoria' | 'documentos';

@Component({
  selector: 'app-caso-detail-header',
  host: { style: 'display: block' },
  imports: [LucideAngularModule, RouterLink],
  templateUrl: './caso-detail-header.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CasoDetailHeaderComponent {
  readonly titulo = input.required<string>();
  readonly estado = input.required<string>();
  readonly tipo = input.required<string>();
  readonly editing = input.required<boolean>();
  readonly activeTab = input.required<CasoTab>();
  readonly hitosCount = input.required<number>();
  readonly movimientosCount = input.required<number>();
  readonly gestoriaPending = input.required<number>();
  readonly docsPending = input.required<number>();
  /** Oculta el botón "Editar" si el usuario no tiene permiso `Casos.editar`. */
  readonly canEdit = input(true);

  readonly edit = output<void>();
  readonly tabChange = output<CasoTab>();

  protected readonly bp = inject(BreakpointService);

  readonly ArrowLeftIcon = ArrowLeft;
  readonly Edit2Icon = Edit2;

  readonly tabs: readonly [CasoTab, string][] = [
    ['info', 'Información'],
    ['hitos', 'Hitos'],
    ['gestoria', 'Gestoría'],
    ['documentos', 'Documentos'],
  ];

  /** Selector móvil: solo propaga valores que son pestañas válidas. */
  seleccionarTab(valor: string): void {
    const tab = this.tabs.find((t) => t[0] === valor);
    if (tab) this.tabChange.emit(tab[0]);
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
}
