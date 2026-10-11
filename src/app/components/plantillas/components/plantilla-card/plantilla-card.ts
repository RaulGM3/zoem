import { Component, ChangeDetectionStrategy, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LucideAngularModule, ExternalLink, Trash2 } from 'lucide-angular';
import { CasoPlantilla } from '../../../../interfaces';
import { ImportePipe } from '../../../../core/moneda/importe.pipe';

@Component({
  selector: 'app-plantilla-card',
  imports: [ImportePipe, LucideAngularModule, RouterLink],
  templateUrl: './plantilla-card.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PlantillaCardComponent {
  readonly plantilla = input.required<CasoPlantilla>();
  readonly delete = output<string>();

  readonly ExternalLinkIcon = ExternalLink;
  readonly Trash2Icon = Trash2;
}
