import { Component, ChangeDetectionStrategy, computed, input, signal } from '@angular/core';
import {
  LucideAngularModule, type LucideIconData,
  Activity, Briefcase, Users, Calendar, FileText, Receipt, Wallet, Bot,
  ChevronLeft, ChevronRight,
} from 'lucide-angular';

import type { Actividad } from '../../../interfaces/actividad';
import type { Modulo } from '../../../core/permissions/permissions';

/** Variantes visuales del feed: la del dashboard y la del panel de Usuarios. */
export type ActividadFeedVariante = 'panel' | 'compacta';

const MODULO_ICON: Record<Modulo, LucideIconData> = {
  Casos: Briefcase, Contactos: Users, Calendario: Calendar, Documentos: FileText,
  Facturación: Receipt, Tesorería: Wallet, RecepciónIA: Bot, Informes: Activity, Configuración: Users,
};

/**
 * Feed de actividad paginado. Recibe el lote completo ya cargado y muestra
 * bloques de `porPagina`; el botón "Siguiente" pasa al bloque siguiente.
 *
 * La página es estado derivado saneado: si el lote encoge en vivo (el feed es
 * un stream de Firestore) la vista nunca queda fuera de rango.
 */
@Component({
  selector: 'app-actividad-feed',
  imports: [LucideAngularModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div>
      @for (a of visibles(); track a.id) {
        @if (variante() === 'panel') {
          <div class="flex items-start gap-3 px-5 py-3" style="border-bottom:1px solid var(--border)">
            <div class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full"
              style="background:var(--surface-2);color:var(--text-muted)">
              <lucide-icon [img]="iconFor(a.modulo)" size="14" />
            </div>
            <div class="min-w-0 flex-1">
              <p class="text-sm" style="color:var(--text)">
                <span class="font-medium" style="color:var(--text-strong)">{{ a.autorNombre }}</span> {{ a.accion }}
              </p>
              <p class="text-xs" style="color:var(--text-faint)">{{ fechaLabel(a) }}</p>
            </div>
          </div>
        } @else {
          <div class="flex items-start gap-3 border-b border-slate-100 p-4">
            <div class="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-violet-100 text-xs font-semibold text-violet-700">
              {{ a.autorNombre.charAt(0) }}
            </div>
            <div class="min-w-0">
              <p class="text-sm font-medium text-slate-700">{{ a.autorNombre }}</p>
              <p class="truncate text-xs font-medium text-slate-700">{{ a.accion }}</p>
              <p class="mt-0.5 text-xs font-medium text-slate-600">{{ fechaLabel(a) }}</p>
            </div>
          </div>
        }
      } @empty {
        @if (variante() === 'panel') {
          <div class="px-5 py-6 text-center text-sm" style="color:var(--text-faint)">Sin actividad reciente</div>
        } @else {
          <div class="p-8 text-center text-sm text-slate-600">Sin actividad reciente</div>
        }
      }
    </div>

    @if (totalPaginas() > 1) {
      <nav class="flex items-center justify-between px-5 py-3" aria-label="Paginación de actividad reciente">
        <button
          type="button"
          (click)="anterior()"
          [disabled]="pagina() === 1"
          class="flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-medium disabled:cursor-not-allowed disabled:opacity-40"
          [style.color]="variante() === 'panel' ? 'var(--text-body)' : null"
          [class.text-slate-700]="variante() === 'compacta'"
        >
          <lucide-icon [img]="ChevronLeftIcon" size="14" aria-hidden="true" />
          Anterior
        </button>
        <span class="text-xs" aria-live="polite"
          [style.color]="variante() === 'panel' ? 'var(--text-faint)' : null"
          [class.text-slate-600]="variante() === 'compacta'">
          Página {{ pagina() }} de {{ totalPaginas() }}
        </span>
        <button
          type="button"
          (click)="siguiente()"
          [disabled]="pagina() === totalPaginas()"
          class="flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-medium disabled:cursor-not-allowed disabled:opacity-40"
          [style.color]="variante() === 'panel' ? 'var(--text-body)' : null"
          [class.text-slate-700]="variante() === 'compacta'"
        >
          Siguiente
          <lucide-icon [img]="ChevronRightIcon" size="14" aria-hidden="true" />
        </button>
      </nav>
    }
  `,
})
export class ActividadFeedComponent {
  readonly items = input.required<Actividad[]>();
  readonly porPagina = input(10);
  readonly variante = input<ActividadFeedVariante>('panel');

  readonly ChevronLeftIcon = ChevronLeft;
  readonly ChevronRightIcon = ChevronRight;

  /** Página pedida por el usuario; puede quedar fuera de rango si el lote encoge. */
  private readonly paginaPedida = signal(1);

  readonly totalPaginas = computed(() => Math.max(1, Math.ceil(this.items().length / this.porPagina())));

  /** Página realmente visible: la pedida, saneada contra el total actual. */
  readonly pagina = computed(() => Math.min(this.paginaPedida(), this.totalPaginas()));

  readonly visibles = computed(() => {
    const desde = (this.pagina() - 1) * this.porPagina();
    return this.items().slice(desde, desde + this.porPagina());
  });

  anterior(): void {
    this.paginaPedida.set(Math.max(1, this.pagina() - 1));
  }

  siguiente(): void {
    this.paginaPedida.set(Math.min(this.totalPaginas(), this.pagina() + 1));
  }

  iconFor(modulo: Modulo): LucideIconData {
    return MODULO_ICON[modulo] ?? Activity;
  }

  /** Timestamp de Firestore → '19 Jun 16:40' (vacío mientras el server no lo resuelve). */
  fechaLabel(a: Actividad): string {
    const d = a.createdAt?.toDate?.();
    if (!d) return '';
    return d.toLocaleString('es-ES', {
      day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
    });
  }
}
