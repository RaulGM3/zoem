import { Component, ChangeDetectionStrategy, input, computed } from '@angular/core';
import { DecimalPipe } from '@angular/common';

export interface BarItem {
  value: number;
  /** Color CSS (hex) de la barra. */
  color: string;
  /** Nombre de la serie, para tooltip/leyenda. */
  name?: string;
}

export interface BarGroup {
  label: string;
  bars: BarItem[];
}

/**
 * Gráfico de barras presentacional, CSS puro (sin librerías).
 * Soporta una o varias barras por grupo (p. ej. ingresos vs egresos por mes).
 */
@Component({
  selector: 'app-bar-chart',
  imports: [DecimalPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (max() === 0) {
      <div class="flex h-40 items-center justify-center text-sm text-slate-400">Sin datos</div>
    } @else {
      <div class="flex h-40 items-end justify-between gap-2">
        @for (group of data(); track group.label) {
          <div class="flex h-full flex-1 flex-col items-center justify-end gap-1">
            <div class="flex w-full flex-1 items-end justify-center gap-0.5">
              @for (bar of group.bars; track $index) {
                <div
                  class="w-full max-w-7 rounded-t transition-all"
                  [style.height.%]="heightPct(bar.value)"
                  [style.background]="bar.color"
                  [title]="(bar.name ? bar.name + ': ' : '') + (bar.value | number: '1.0-0') + ' €'"
                ></div>
              }
            </div>
            <span class="truncate text-[10px] text-slate-400">{{ group.label }}</span>
          </div>
        }
      </div>
    }
  `,
})
export class BarChartComponent {
  readonly data = input.required<BarGroup[]>();

  readonly max = computed(() => {
    let m = 0;
    for (const g of this.data()) {
      for (const b of g.bars) m = Math.max(m, b.value);
    }
    return m;
  });

  heightPct(value: number): number {
    const m = this.max();
    if (m === 0) return 0;
    // Mínimo visible del 2% para barras con valor > 0.
    return value > 0 ? Math.max(2, (value / m) * 100) : 0;
  }
}
