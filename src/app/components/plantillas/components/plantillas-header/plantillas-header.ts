import { Component, ChangeDetectionStrategy, output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LucideAngularModule, Layers, Plus, ArrowLeft } from 'lucide-angular';

@Component({
  selector: 'app-plantillas-header',
  imports: [LucideAngularModule, RouterLink],
  templateUrl: './plantillas-header.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PlantillasHeaderComponent {
  readonly newPlantilla = output<void>();

  readonly LayersIcon = Layers;
  readonly PlusIcon = Plus;
  readonly ArrowLeftIcon = ArrowLeft;
}
