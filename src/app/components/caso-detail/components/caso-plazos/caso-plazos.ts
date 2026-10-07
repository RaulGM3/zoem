import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { of, switchMap } from 'rxjs';
import { LucideAngularModule, Gavel } from 'lucide-angular';
import type { Caso } from '../../../../interfaces/caso.interface';
import { esPlazoProcesal } from '../../../../interfaces/evento.interface';
import type { EstadoPlazo, Evento } from '../../../../interfaces/evento.interface';
import { formatearFechaEs } from '../../../../core/plazos/plazo-evento';
import { PlazosService } from '../../../../core/services/plazos.service';
import { ToastService } from '../../../../core/services/toast.service';
import { PlazoDrawerComponent } from '../plazo-drawer/plazo-drawer';

const ESTADO_LABEL: Record<EstadoPlazo, string> = {
  vigente: 'Vigente',
  requiere_revision: 'Requiere revisión',
  cumplido: 'Cumplido',
  vencido: 'Vencido',
};

const ESTADO_COLOR: Record<EstadoPlazo, string> = {
  vigente: 'var(--brand)',
  requiere_revision: 'var(--danger)',
  cumplido: 'var(--success)',
  vencido: 'var(--text-muted)',
};

/** Bloque "Plazos procesales" (BETA) de la ficha del caso: listado, alta y revisión. */
@Component({
  selector: 'app-caso-plazos',
  imports: [LucideAngularModule, PlazoDrawerComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  template: `
    <section aria-labelledby="caso-plazos-titulo" class="rounded-xl p-5" style="background:var(--surface);border:1px solid var(--border)">
      <div class="flex items-center justify-between gap-2 mb-3">
        <h2 id="caso-plazos-titulo" class="flex items-center gap-2 text-sm font-semibold" style="color:var(--text-strong)">
          <lucide-icon [img]="GavelIcon" class="w-4 h-4" aria-hidden="true" />
          Plazos procesales
          <span class="rounded-full px-2 py-0.5 text-[10px] font-bold tracking-wide"
            style="background:color-mix(in srgb,var(--warning) 18%,transparent);color:var(--text-strong)">BETA</span>
        </h2>
        @if (canEdit()) {
          <button type="button" data-nuevo-plazo (click)="abrirNuevo()"
            class="max-sm:tap-target px-3 py-1.5 text-sm text-white rounded-lg bg-[var(--brand)] transition-colors duration-150 hover:bg-[var(--brand-hover)]">
            Nuevo plazo
          </button>
        }
      </div>

      @if (plazos().length === 0) {
        <p class="text-sm" style="color:var(--text-muted)">Aún no hay plazos calculados para este caso.</p>
      } @else {
        <ul class="space-y-2">
          @for (p of plazos(); track p.id) {
            <li [attr.data-plazo]="p.id" class="rounded-lg p-3" style="background:var(--surface-2);border:1px solid var(--border)">
              <div class="flex flex-wrap items-center justify-between gap-2">
                <div class="min-w-0">
                  <p class="text-sm font-medium truncate" style="color:var(--text-strong)">{{ p.titulo }}</p>
                  <p class="text-xs" style="color:var(--text-muted)">Vence el {{ fecha(p) }}</p>
                </div>
                <span class="rounded-full px-2 py-0.5 text-xs font-medium"
                  [style.color]="color(p)" style="background:color-mix(in srgb,currentColor 12%,transparent)">{{ etiqueta(p) }}</span>
              </div>
              @if (canEdit()) {
                <div class="mt-2 flex flex-wrap gap-2">
                  @if (estado(p) === 'requiere_revision') {
                    <button type="button" data-revisar (click)="revisar(p)"
                      class="max-sm:tap-target px-3 py-1 text-xs rounded-lg text-white bg-[var(--danger)] hover:brightness-90">Revisar</button>
                  }
                  @if (estado(p) !== 'cumplido') {
                    <button type="button" data-cumplido (click)="cumplir(p)"
                      class="max-sm:tap-target px-3 py-1 text-xs rounded-lg hover:bg-[var(--surface)]"
                      style="border:1px solid var(--border);color:var(--text-body)"
                      [attr.aria-label]="'Marcar cumplido: ' + p.titulo">Marcar cumplido</button>
                  }
                </div>
              }
            </li>
          }
        </ul>
      }
    </section>

    <app-plazo-drawer
      [visible]="drawerAbierto()"
      [caso]="caso()"
      [canEdit]="canEdit()"
      [plazoRevision]="enRevision()"
      (closed)="cerrar()"
    />
  `,
})
export class CasoPlazosComponent {
  private readonly plazosService = inject(PlazosService);
  private readonly toast = inject(ToastService);

  readonly caso = input.required<Pick<Caso, 'id' | 'titulo' | 'jurisdiccion' | 'partidoJudicialId'>>();
  /** `Casos.editar`: sin él solo se consulta. */
  readonly canEdit = input(true);

  protected readonly GavelIcon = Gavel;
  protected readonly drawerAbierto = signal(false);
  protected readonly enRevision = signal<Evento | null>(null);

  private readonly eventos = toSignal(
    toObservable(computed(() => this.caso().id)).pipe(switchMap((id) => (id ? this.plazosService.plazosDelCaso(id) : of([] as Evento[])))),
    { initialValue: [] as Evento[] },
  );

  protected readonly plazos = computed(() =>
    this.eventos().filter(esPlazoProcesal).sort((a, b) => a.fecha.localeCompare(b.fecha)),
  );

  protected estado(p: Evento): EstadoPlazo {
    return esPlazoProcesal(p) ? p.origen.estadoPlazo : 'vigente';
  }
  protected etiqueta(p: Evento): string {
    return ESTADO_LABEL[this.estado(p)];
  }
  protected color(p: Evento): string {
    return ESTADO_COLOR[this.estado(p)];
  }
  protected fecha(p: Evento): string {
    return formatearFechaEs(p.fecha);
  }

  protected abrirNuevo(): void {
    if (!this.canEdit()) return;
    this.enRevision.set(null);
    this.drawerAbierto.set(true);
  }

  protected revisar(p: Evento): void {
    if (!this.canEdit()) return;
    this.enRevision.set(p);
    this.drawerAbierto.set(true);
  }

  protected cerrar(): void {
    this.drawerAbierto.set(false);
    this.enRevision.set(null);
  }

  protected async cumplir(p: Evento): Promise<void> {
    if (!this.canEdit()) return;
    await this.toast.run(() => this.plazosService.marcarCumplido(p.id), {
      successMessage: 'Plazo marcado como cumplido',
      errorTitle: 'No se pudo marcar el plazo como cumplido',
    });
  }
}
