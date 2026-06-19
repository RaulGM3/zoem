import { Component, ChangeDetectionStrategy, output, input } from '@angular/core';
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
  /** Si false, oculta el botón de crear caso (permiso de rol). */
  readonly canCreate = input<boolean>(true);
  readonly newCasoClick = output<void>();

  readonly BriefcaseIcon = Briefcase;
  readonly PlusIcon = Plus;
  readonly LayersIcon = Layers;
}
