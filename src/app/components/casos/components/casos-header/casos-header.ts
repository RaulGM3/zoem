import { Component, ChangeDetectionStrategy, output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LucideAngularModule, Briefcase, Plus, Layers } from 'lucide-angular';

@Component({
  selector: 'app-casos-header',
  host: { style: 'display: block' },
  imports: [LucideAngularModule, RouterLink],
  templateUrl: './casos-header.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CasosHeaderComponent {
  readonly newCasoClick = output<void>();

  readonly BriefcaseIcon = Briefcase;
  readonly PlusIcon = Plus;
  readonly LayersIcon = Layers;
}
