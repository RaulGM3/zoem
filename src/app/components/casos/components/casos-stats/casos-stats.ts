import { Component, ChangeDetectionStrategy, input } from '@angular/core';
import { LucideAngularModule, AlertCircle } from 'lucide-angular';

@Component({
  selector: 'app-casos-stats',
  imports: [LucideAngularModule],
  templateUrl: './casos-stats.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CasosStatsComponent {
  readonly total = input.required<number>();
  readonly enProceso = input.required<number>();
  readonly pendientes = input.required<number>();
  readonly urgentes = input.required<number>();

  readonly AlertCircleIcon = AlertCircle;
}
