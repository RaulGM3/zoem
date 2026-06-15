import { Component, ChangeDetectionStrategy, input, output, computed } from '@angular/core';
import { LucideAngularModule, LucideIconData, Plus, Edit2, Trash2 } from 'lucide-angular';
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

  readonly toggle = output<Hito>();
  readonly editHito = output<Hito>();
  readonly deleteHito = output<string>();
  readonly addHito = output<void>();

  readonly PlusIcon = Plus;
  readonly Edit2Icon = Edit2;
  readonly Trash2Icon = Trash2;

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
