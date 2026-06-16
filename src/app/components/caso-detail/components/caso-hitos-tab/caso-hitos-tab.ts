import { Component, ChangeDetectionStrategy, input, output, computed, signal } from '@angular/core';
import { LucideAngularModule, LucideIconData, Plus, Edit2, Trash2, Activity, X, Clock, Euro } from 'lucide-angular';
import type { CompanyMember, Hito, HitoActividad, HitoEstado } from '../../../../interfaces';
import {
  HITO_ESTADO_ICON_COLOR,
  HITO_ESTADO_LABEL,
} from '../../../../core/hitos/hito-estado';
import { HITO_ESTADO_ICON } from '../../../../core/hitos/hito-estado.icons';
import { describeActividad, HITO_ACTIVIDAD_DOT_CLASS } from '../../../../core/hitos/hito-actividad';
import { relativeTime } from '../../../../core/format/relative-time';

@Component({
  selector: 'app-caso-hitos-tab',
  host: { style: 'display: block' },
  imports: [LucideAngularModule],
  templateUrl: './caso-hitos-tab.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CasoHitosTabComponent {
  readonly hitos = input.required<Hito[]>();
  readonly actividad = input.required<HitoActividad[]>();
  readonly members = input.required<CompanyMember[]>();
  readonly isAdmin = input(false);

  readonly toggle = output<Hito>();
  readonly editHito = output<Hito>();
  readonly deleteHito = output<string>();
  readonly addHito = output<void>();
  readonly facturarHoras = output<Hito>();

  readonly PlusIcon = Plus;
  readonly Edit2Icon = Edit2;
  readonly Trash2Icon = Trash2;
  readonly ActivityIcon = Activity;
  readonly XIcon = X;
  readonly ClockIcon = Clock;
  readonly EuroIcon = Euro;

  readonly actividadVisible = signal(false);

  readonly completados = computed(() => this.hitos().filter(h => h.estado === 'completado').length);

  readonly progress = computed(() => {
    const total = this.hitos().length;
    if (total === 0) return 0;
    return Math.round((this.completados() / total) * 100);
  });

  getMemberName(userId?: string): string {
    if (!userId) return '—';
    const m = this.members().find(x => x.userId === userId);
    return m ? `${m.nombre}${m.apellido ? ' ' + m.apellido : ''}` : userId;
  }

  /** Asignados del hito (multi), con compat para el campo legacy asignadoA. */
  asignados(hito: Hito): string[] {
    if (hito.asignadosA?.length) return hito.asignadosA;
    return hito.asignadoA ? [hito.asignadoA] : [];
  }

  asignadosLabel(hito: Hito): string {
    const ids = this.asignados(hito);
    return ids.length ? ids.map(id => this.getMemberName(id)).join(', ') : '—';
  }

  /** Horas declaradas en total para el hito (suma de registros). */
  totalHoras(hito: Hito): number {
    const min = (hito.registrosHoras ?? []).reduce((s, r) => s + r.minutos, 0);
    return Math.round((min / 60) * 100) / 100;
  }

  /** ¿Hay registros de horas sin facturar? Habilita la acción "facturar horas". */
  tieneHorasPendientes(hito: Hito): boolean {
    return (hito.registrosHoras ?? []).some(r => !r.facturado);
  }

  getHitoEstadoIcon(estado: HitoEstado): LucideIconData {
    return HITO_ESTADO_ICON[estado];
  }

  getHitoEstadoColor(estado: HitoEstado): string {
    return HITO_ESTADO_ICON_COLOR[estado];
  }

  getHitoEstadoLabel(estado: HitoEstado): string {
    return HITO_ESTADO_LABEL[estado];
  }

  // ── Feed de actividad ──────────────────────────────────
  describeActividad(act: HitoActividad): string {
    return describeActividad(act, this.getMemberName(act.autorId));
  }

  actividadDotClass(act: HitoActividad): string {
    return HITO_ACTIVIDAD_DOT_CLASS[act.tipo];
  }

  actividadTiempo(act: HitoActividad): string {
    // createdAt llega null en el instante optimista previo a que el server
    // resuelva el serverTimestamp; mostramos "hace un momento" mientras tanto.
    const date = act.createdAt?.toDate?.();
    return date ? relativeTime(date) : 'hace un momento';
  }
}
