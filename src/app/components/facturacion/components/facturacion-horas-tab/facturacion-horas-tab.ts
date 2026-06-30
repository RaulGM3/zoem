import { Component, ChangeDetectionStrategy, input } from '@angular/core';
import { DecimalPipe } from '@angular/common';

export interface HoraFlat {
  id: string;
  casoId: string;
  casoTitulo: string;
  hitoId: string;
  hitoTitulo: string;
  memberName: string;
  fecha: string;
  minutos: number;
  horas: number;
  facturado: boolean;
  importe?: number;
}

@Component({
  selector: 'app-facturacion-horas-tab',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DecimalPipe],
  templateUrl: './facturacion-horas-tab.html',
})
export class FacturacionHorasTabComponent {
  readonly horasFlat = input.required<HoraFlat[]>();
  readonly totalHoras = input.required<number>();
  readonly horasPendientes = input.required<number>();
  readonly valorPendiente = input.required<number>();
}
