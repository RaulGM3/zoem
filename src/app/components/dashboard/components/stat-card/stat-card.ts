import { Component, ChangeDetectionStrategy, input, computed } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LucideAngularModule, type LucideIconData } from 'lucide-angular';

export type StatTone = 'violet' | 'blue' | 'green' | 'emerald' | 'amber' | 'red' | 'slate';

interface ToneStyle { bg: string; icon: string }

/** KPI card clickable con hover-lift Vertey. Recibe valores ya formateados. */
@Component({
  selector: 'app-stat-card',
  imports: [RouterLink, LucideAngularModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <a
      [routerLink]="href()"
      class="kpi-card group flex flex-col rounded-xl p-5"
      style="background:var(--surface);border:1px solid var(--border)"
    >
      <div class="flex items-center justify-between">
        <!-- Icon chip 40×40, radio 12px, tinte de color -->
        <div
          class="flex h-10 w-10 items-center justify-center rounded-xl"
          [style.background]="toneStyle().bg"
          [style.color]="toneStyle().icon"
        >
          <lucide-icon [img]="icon()" size="20" />
        </div>
        <span
          class="material-symbols-outlined transition-opacity duration-150 opacity-30 group-hover:opacity-60"
          style="font-size:16px;color:var(--text-muted)"
        >chevron_right</span>
      </div>

      <!-- Label -->
      <p class="mt-3 text-[13px] font-medium" style="color:var(--text-muted)">{{ label() }}</p>

      <!-- Número KPI: 29px Space Grotesk 600 -->
      <p
        class="mt-1 font-semibold tabular-nums"
        style="font-size:29px;line-height:1;color:var(--text-strong);font-family:var(--font-display)"
      >{{ value() }}</p>

      @if (sublabel()) {
        <p class="mt-1.5 text-xs" style="color:var(--text-faint)">{{ sublabel() }}</p>
      }
    </a>
  `,
})
export class StatCardComponent {
  readonly icon = input.required<LucideIconData>();
  readonly label = input.required<string>();
  readonly value = input.required<string>();
  readonly sublabel = input<string>('');
  readonly href = input.required<string>();
  readonly tone = input<StatTone>('violet');

  private static readonly TONES: Record<StatTone, ToneStyle> = {
    violet:  { bg: 'color-mix(in srgb,var(--accent-ia) 12%,transparent)', icon: 'var(--accent-ia)' },
    blue:    { bg: 'color-mix(in srgb,var(--brand) 12%,transparent)',      icon: 'var(--brand)' },
    green:   { bg: 'color-mix(in srgb,var(--success) 12%,transparent)',    icon: 'var(--success)' },
    emerald: { bg: 'color-mix(in srgb,var(--success) 12%,transparent)',    icon: 'var(--success)' },
    amber:   { bg: 'color-mix(in srgb,var(--warning) 12%,transparent)',    icon: 'var(--warning)' },
    red:     { bg: 'color-mix(in srgb,var(--danger) 12%,transparent)',     icon: 'var(--danger)' },
    slate:   { bg: 'color-mix(in srgb,var(--text-muted) 12%,transparent)', icon: 'var(--text-muted)' },
  };

  readonly toneStyle = computed<ToneStyle>(() => StatCardComponent.TONES[this.tone()]);
}
