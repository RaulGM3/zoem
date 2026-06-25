import { Component, ChangeDetectionStrategy, input, computed } from '@angular/core';
import { DecimalPipe } from '@angular/common';

export interface DonutItem {
  label: string;
  value: number;
  /** Color CSS (hex) del segmento. */
  color: string;
}

interface Segment extends DonutItem {
  dash: number;
  gap: number;
  offset: number;
  /** Porcentaje redondeado con Largest Remainder Method — siempre suma 100%. */
  pct: number;
}

/** Gráfico de dona presentacional en SVG puro (stroke-dasharray). */
@Component({
  selector: 'app-donut-chart',
  imports: [DecimalPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (total() === 0) {
      <div class="flex h-44 items-center justify-center text-sm text-slate-400">Sin datos</div>
    } @else {
      <div class="flex flex-wrap items-center gap-5">
        <svg viewBox="0 0 120 120" class="h-36 w-36 -rotate-90">
          @for (seg of segments(); track seg.label) {
            <circle
              cx="60"
              cy="60"
              [attr.r]="radius"
              fill="none"
              [attr.stroke]="seg.color"
              stroke-width="16"
              [attr.stroke-dasharray]="seg.dash + ' ' + seg.gap"
              [attr.stroke-dashoffset]="-seg.offset"
            >
              <title>{{ seg.label }}: {{ seg.value | number: '1.0-0' }} € ({{ seg.pct | number: '1.0-0' }}%)</title>
            </circle>
          }
        </svg>
        <ul class="flex-1 space-y-1.5">
          @for (seg of segments(); track seg.label) {
            <li class="flex items-center gap-2 text-xs">
              <span class="h-2.5 w-2.5 shrink-0 rounded-full" [style.background]="seg.color"></span>
              <span class="flex-1 text-slate-600">{{ seg.label }}</span>
              <span class="font-medium text-slate-900">{{ seg.value | number: '1.0-0' }} €</span>
              <span class="w-9 text-right text-slate-400">{{ seg.pct | number: '1.0-0' }}%</span>
            </li>
          }
        </ul>
      </div>
    }
  `,
})
export class DonutChartComponent {
  readonly data = input.required<DonutItem[]>();

  readonly radius = 52;
  private readonly circumference = 2 * Math.PI * 52;

  readonly total = computed(() =>
    this.data().reduce((acc, d) => acc + Math.max(0, d.value), 0)
  );

  readonly segments = computed<Segment[]>(() => {
    const total = this.total();
    if (total === 0) return [];
    const c = this.circumference;
    const filtered = this.data().filter(d => d.value > 0);

    // Largest Remainder Method — integer percentages that always sum to 100.
    const rawPcts = filtered.map(d => (d.value / total) * 100);
    const floors = rawPcts.map(p => Math.floor(p));
    const remainder = 100 - floors.reduce((a, b) => a + b, 0);
    const bonusIndices = new Set(
      rawPcts
        .map((p, i) => ({ i, frac: p - Math.floor(p) }))
        .sort((a, b) => b.frac - a.frac)
        .slice(0, remainder)
        .map(x => x.i),
    );

    let cursor = 0;
    return filtered.map((d, idx) => {
      const dash = (d.value / total) * c;
      const pct = floors[idx] + (bonusIndices.has(idx) ? 1 : 0);
      const seg: Segment = { ...d, dash, gap: c - dash, offset: cursor, pct };
      cursor += dash;
      return seg;
    });
  });
}
