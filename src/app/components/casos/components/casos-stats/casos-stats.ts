import { Component, ChangeDetectionStrategy, input } from '@angular/core';

@Component({
  selector: 'app-casos-stats',
  host: { style: 'display: block' },
  imports: [],
  templateUrl: './casos-stats.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CasosStatsComponent {
  readonly total = input.required<number>();
  readonly enProceso = input.required<number>();
  readonly pendientes = input.required<number>();
}
