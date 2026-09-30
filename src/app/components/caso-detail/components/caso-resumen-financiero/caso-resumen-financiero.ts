import { Component, ChangeDetectionStrategy, input, output, computed, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { LucideAngularModule, Info } from 'lucide-angular';
import type { MovimientoGestoria, MovimientoTipo } from '../../../../interfaces';
import { movTipoStyle } from '../mov-tipo-style';

/**
 * Tarjetas de resumen de la gestoría de un caso (ingresos, egresos con su
 * desglose, honorarios, saldo) e IVA, calculadas a partir de los movimientos.
 */
@Component({
  selector: 'app-caso-resumen-financiero',
  host: {
    class: 'block space-y-4',
    '(document:keydown.escape)': 'onEscape()',
  },
  imports: [LucideAngularModule, DecimalPipe],
  templateUrl: './caso-resumen-financiero.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CasoResumenFinancieroComponent {
  readonly movimientos = input.required<MovimientoGestoria[]>();

  /** Se ha pulsado un tipo en el desglose de egresos: el contenedor filtra la tabla por él. */
  readonly tipoSeleccionado = output<MovimientoTipo>();

  readonly InfoIcon = Info;

  readonly resumenMov = computed(() => {
    const acc = {
      totalIngresos: 0, totalEgresos: 0, suplidos: 0, honorarios: 0, gastos: 0, otros: 0,
      saldo: 0, ivaRepercutido: 0, ivaSoportado: 0,
    };
    for (const m of this.movimientos()) {
      const cuota = m.cuotaIva ?? 0;
      if (m.esEntrada) {
        acc.totalIngresos += m.importe;
        acc.ivaRepercutido += cuota;
      } else {
        acc.totalEgresos += m.importe;
        acc.ivaSoportado += cuota;
        if (m.tipo === 'suplido') acc.suplidos += m.importe;
        else if (m.tipo === 'honorario') acc.honorarios += m.importe;
        else if (m.tipo === 'gasto') acc.gastos += m.importe;
        else acc.otros += m.importe;
      }
    }
    acc.saldo = acc.totalIngresos - acc.totalEgresos;
    return acc;
  });

  // ── Desglose de egresos (popover) ──────────────────────

  /** Abierto por hover, foco o clic; se cierra con Escape o al salir del grupo. */
  readonly desgloseAbierto = signal(false);

  /** Tramos del desglose de egresos con su peso relativo, ya listos para pintar. */
  readonly desgloseEgresos = computed(() => {
    const r = this.resumenMov();
    const total = r.totalEgresos;
    if (total <= 0) return [];
    const tramos: { tipo: MovimientoTipo; etiqueta: string; importe: number }[] = [
      { tipo: 'suplido', etiqueta: 'Suplidos', importe: r.suplidos },
      { tipo: 'honorario', etiqueta: 'Honorarios', importe: r.honorarios },
      { tipo: 'gasto', etiqueta: 'Gastos', importe: r.gastos },
      { tipo: 'otro', etiqueta: 'Otros', importe: r.otros },
    ];
    return tramos
      .filter(t => t.importe > 0)
      .map(t => ({ ...t, porcentaje: (t.importe / total) * 100, color: movTipoStyle(t.tipo).color }));
  });

  onEscape(): void {
    this.desgloseAbierto.set(false);
  }

  seleccionarTipo(tipo: MovimientoTipo): void {
    this.desgloseAbierto.set(false);
    this.tipoSeleccionado.emit(tipo);
  }
}
