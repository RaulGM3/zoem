import { Component, ChangeDetectionStrategy, input, output } from '@angular/core';
import { LucideAngularModule, Search } from 'lucide-angular';
import type { CasoEstado, CasoTipo } from '../../../../interfaces';

@Component({
  selector: 'app-casos-filter-bar',
  imports: [LucideAngularModule],
  templateUrl: './casos-filter-bar.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CasosFilterBarComponent {
  readonly search = input.required<string>();
  readonly filterEstado = input.required<string>();
  readonly filterTipo = input.required<string>();
  readonly estados = input.required<readonly CasoEstado[]>();
  readonly tipos = input.required<readonly CasoTipo[]>();

  readonly searchChange = output<string>();
  readonly filterEstadoChange = output<string>();
  readonly filterTipoChange = output<string>();

  readonly SearchIcon = Search;
}
