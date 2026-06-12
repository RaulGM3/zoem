import { Component, ChangeDetectionStrategy, input, output } from '@angular/core';
import { LucideAngularModule, Layers } from 'lucide-angular';
import { CasoPlantilla } from '../../../../interfaces';
import { PlantillaCardComponent } from '../plantilla-card/plantilla-card';

@Component({
  selector: 'app-plantillas-list',
  imports: [LucideAngularModule, PlantillaCardComponent],
  templateUrl: './plantillas-list.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PlantillasListComponent {
  readonly plantillas = input.required<CasoPlantilla[]>();
  readonly loading = input.required<boolean>();
  readonly delete = output<string>();
  readonly newPlantilla = output<void>();

  readonly LayersIcon = Layers;
}
