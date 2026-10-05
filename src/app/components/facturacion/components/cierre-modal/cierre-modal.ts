import { Component, ChangeDetectionStrategy, input, output } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { Caso } from '../../../../interfaces';
import { OverlayShellComponent } from '../../../../shared/components/overlay-shell/overlay-shell';

@Component({
  selector: 'app-cierre-modal',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DecimalPipe, OverlayShellComponent],
  templateUrl: './cierre-modal.html',
})
export class CierreModalComponent {
  readonly caso = input.required<Caso>();
  readonly movimientosOk = input.required<boolean>();
  readonly bancoOk = input.required<boolean>();
  readonly puedeCerrar = input.required<boolean>();
  readonly saving = input.required<boolean>();
  readonly saldoBancario = input<number | null | undefined>();

  readonly closed = output<void>();
  readonly confirmed = output<void>();
  readonly movimientosOkChange = output<boolean>();
  readonly bancoOkChange = output<boolean>();
}
