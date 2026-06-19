import { Component, ChangeDetectionStrategy, input, computed } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LucideAngularModule, ChevronRight, type LucideIconData } from 'lucide-angular';

export type StatTone = 'violet' | 'blue' | 'green' | 'emerald' | 'amber' | 'red' | 'slate';

/** KPI card clickable, presentacional. Recibe valores ya formateados. */
@Component({
  selector: 'app-stat-card',
  imports: [RouterLink, LucideAngularModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <a
      [routerLink]="href()"
      class="group flex flex-col rounded-xl border border-slate-200 bg-white p-5 transition-shadow hover:shadow-md"
    >
      <div class="flex items-center justify-between">
        <div class="flex h-10 w-10 items-center justify-center rounded-lg" [class]="bgClass()">
          <lucide-icon [img]="icon()" size="20" [class]="iconClass()" />
        </div>
        <lucide-icon
          [img]="ChevronRightIcon"
          size="16"
          class="text-slate-300 group-hover:text-slate-500"
        />
      </div>
      <p class="mt-3 text-sm font-medium text-slate-500">{{ label() }}</p>
      <p class="mt-1 text-2xl font-bold text-slate-900">{{ value() }}</p>
      @if (sublabel()) {
        <p class="mt-1 text-xs text-slate-400">{{ sublabel() }}</p>
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

  readonly ChevronRightIcon = ChevronRight;

  private static readonly TONES: Record<StatTone, { bg: string; icon: string }> = {
    violet: { bg: 'bg-violet-50', icon: 'text-violet-600' },
    blue: { bg: 'bg-blue-50', icon: 'text-blue-600' },
    green: { bg: 'bg-green-50', icon: 'text-green-600' },
    emerald: { bg: 'bg-emerald-50', icon: 'text-emerald-600' },
    amber: { bg: 'bg-amber-50', icon: 'text-amber-600' },
    red: { bg: 'bg-red-50', icon: 'text-red-600' },
    slate: { bg: 'bg-slate-100', icon: 'text-slate-600' },
  };

  readonly bgClass = computed(() => StatCardComponent.TONES[this.tone()].bg);
  readonly iconClass = computed(() => StatCardComponent.TONES[this.tone()].icon);
}
