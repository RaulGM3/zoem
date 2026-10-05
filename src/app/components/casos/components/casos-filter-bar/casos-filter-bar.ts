import { Component, ChangeDetectionStrategy, input, output } from '@angular/core';
import { CASO_ESTADO_LABEL, type CasoEstado, type CasoTipo } from '../../../../interfaces';

@Component({
  selector: 'app-casos-filter-bar',
  host: { style: 'display: block' },
  templateUrl: './casos-filter-bar.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CasosFilterBarComponent {
  readonly filterEstado = input.required<string>();
  readonly filterTipo = input.required<string>();
  readonly estados = input.required<readonly CasoEstado[]>();
  readonly tipos = input.required<readonly CasoTipo[]>();

  readonly filterEstadoChange = output<string>();
  readonly filterTipoChange = output<string>();

  readonly estadoLabel = CASO_ESTADO_LABEL;
}
