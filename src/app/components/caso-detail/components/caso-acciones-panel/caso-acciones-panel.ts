import { ChangeDetectionStrategy, Component, OnInit, computed, effect, inject, input, output, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LucideAngularModule, Send, CircleCheck, Circle, FileText } from 'lucide-angular';
import { AccionesService } from '../../../../core/services/acciones.service';
import { AccionRegistrosService } from '../../../../core/services/accion-registros.service';
import { resumirEjecuciones, type ResumenEjecucion } from '../../../../core/acciones/resumen-ejecuciones';
import { formatearFechaEs } from '../../../../core/acciones/contexto-accion';
import type { Accion, AccionRegistro } from '../../../../interfaces/accion.interface';
import { getContactDisplayName, type Contact } from '../../../../interfaces';
import { ComunicacionesEnviadasComponent } from '../../../../shared/components/comunicaciones-enviadas/comunicaciones-enviadas';

/** Tokens de color rotados por acción (estable por id: no cambia al reordenar el catálogo). */
const COLORES = ['var(--brand)', 'var(--accent-ia)', 'var(--success)', 'var(--warning)', 'var(--danger)'];

function colorDe(id: string): string {
  let h = 0;
  for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return COLORES[h % COLORES.length];
}

/**
 * Columna de acciones del caso: un botón de color por acción de catálogo con
 * cuántas veces se envió (total y por cliente vinculado) y, debajo, el log de
 * comunicaciones. Carga el log una sola vez y lo comparte con el historial.
 */
@Component({
  selector: 'app-caso-acciones-panel',
  imports: [LucideAngularModule, RouterLink, ComunicacionesEnviadasComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block space-y-6' },
  template: `
    <section aria-labelledby="cap-titulo" class="rounded-xl p-5" style="background:var(--surface);border:1px solid var(--border)">
      <h2 id="cap-titulo" class="text-sm font-semibold mb-3" style="color:var(--text-strong)">Acciones disponibles</h2>
      @if (cargandoAcciones()) {
        <p role="status" class="text-sm" style="color:var(--text-faint)">Cargando acciones...</p>
      } @else if (error()) {
        <p role="alert" class="text-sm" style="color:var(--danger)">No se pudieron cargar las acciones.</p>
      } @else if (acciones().length === 0) {
        <p class="text-sm" style="color:var(--text-muted)">
          No hay acciones disponibles para casos.
          <a routerLink="/acciones" class="underline" style="color:var(--brand)">Crear una acción</a>
        </p>
      } @else {
        <ul class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2 gap-3">
          @for (a of acciones(); track a.id) {
            @let r = resumen().get(a.id);
            <li>
              <button type="button" data-testid="accion-boton" (click)="ejecutar.emit(a)" [disabled]="!canEdit()"
                [style.--accion-color]="color(a)"
                class="accion-boton group w-full h-full text-left rounded-xl p-3 min-h-11 flex gap-3 transition-[box-shadow,transform] duration-150 enabled:hover:-translate-y-px enabled:hover:shadow-md disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accion-color)]">
                <span aria-hidden="true" class="w-8 h-8 shrink-0 rounded-lg flex items-center justify-center text-white" style="background:var(--accion-color)">
                  <lucide-icon [img]="SendIcon" class="w-4 h-4" />
                </span>
                <span class="min-w-0 flex-1">
                  <span class="block text-sm font-medium" style="color:var(--text-strong)">
                    {{ a.nombre }}
                    @if (a.docTemplateId) {
                      <lucide-icon [img]="FileTextIcon" class="w-3 h-3 inline -mt-0.5" style="color:var(--text-muted)" aria-label="Con documento" />
                    }
                  </span>
                  @if (r && r.total > 0) {
                    <span class="mt-1 flex items-center gap-1 text-xs" style="color:var(--text-body)">
                      <lucide-icon [img]="CheckIcon" class="w-3.5 h-3.5 shrink-0" style="color:var(--success)" aria-hidden="true" />
                      Enviada · {{ veces(r.total) }}
                    </span>
                    @if (r.ultima) {
                      <span class="block text-xs" style="color:var(--text-muted)">Última: {{ fecha(r.ultima) }}</span>
                    }
                  } @else {
                    <span class="mt-1 flex items-center gap-1 text-xs" style="color:var(--text-muted)">
                      <lucide-icon [img]="CircleIcon" class="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                      Sin enviar
                    </span>
                  }
                  @if (r && contactos().length > 1) {
                    <span class="mt-1.5 flex flex-wrap gap-1">
                      @for (pc of r.porContacto; track pc.contactoId) {
                        <span data-testid="por-cliente" class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-xs"
                          style="background:var(--surface);color:var(--text-body);border:1px solid var(--border)">
                          {{ nombreContacto(pc.contactoId) }}
                          <span class="font-semibold" style="color:var(--text-strong)">{{ pc.total }}</span>
                        </span>
                      }
                    </span>
                  }
                </span>
              </button>
            </li>
          }
        </ul>
      }
    </section>

    <app-comunicaciones-enviadas [casoId]="casoId()" [registros]="registros()" [cargando]="cargandoRegistros()" />
  `,
  styles: `
    .accion-boton {
      background: color-mix(in srgb, var(--accion-color) 8%, var(--surface-2));
      border: 1px solid color-mix(in srgb, var(--accion-color) 30%, transparent);
      border-left: 4px solid var(--accion-color);
    }
  `,
})
export class CasoAccionesPanelComponent implements OnInit {
  private readonly accionesService = inject(AccionesService);
  private readonly registrosService = inject(AccionRegistrosService);

  readonly casoId = input.required<string>();
  readonly contactos = input<Contact[]>([]);
  readonly canEdit = input(true);
  /** Se incrementa desde el padre tras ejecutar una acción para refrescar contadores y log. */
  readonly recarga = input(0);

  readonly ejecutar = output<Accion>();

  readonly SendIcon = Send;
  readonly CheckIcon = CircleCheck;
  readonly CircleIcon = Circle;
  readonly FileTextIcon = FileText;

  readonly acciones = signal<Accion[]>([]);
  readonly registros = signal<AccionRegistro[]>([]);
  readonly cargandoAcciones = signal(true);
  readonly cargandoRegistros = signal(true);
  readonly error = signal(false);

  readonly resumen = computed<Map<string, ResumenEjecucion>>(() =>
    resumirEjecuciones(
      this.acciones().map((a) => a.id),
      this.registros(),
      this.contactos().map((c) => c.id),
    ),
  );
  private readonly nombres = computed(() => new Map(this.contactos().map((c) => [c.id, getContactDisplayName(c)])));

  constructor() {
    effect(() => {
      const casoId = this.casoId();
      this.recarga();
      void this.cargarRegistros(casoId);
    });
  }

  async ngOnInit(): Promise<void> {
    try {
      this.acciones.set(await this.accionesService.listarPorAmbito('caso'));
    } catch (e) {
      console.error('[acciones] panel caso', e);
      this.error.set(true);
    } finally {
      this.cargandoAcciones.set(false);
    }
  }

  private async cargarRegistros(casoId: string): Promise<void> {
    this.cargandoRegistros.set(true);
    try {
      this.registros.set(await this.registrosService.listarPorCaso(casoId));
    } catch (e) {
      console.error('[acciones] log caso', e);
      this.error.set(true);
    } finally {
      this.cargandoRegistros.set(false);
    }
  }

  color(a: Accion): string {
    return colorDe(a.id);
  }

  veces(n: number): string {
    return n === 1 ? '1 vez' : `${n} veces`;
  }

  fecha(d: Date): string {
    return formatearFechaEs(d);
  }

  nombreContacto(id: string): string {
    return this.nombres().get(id) ?? 'Cliente';
  }
}
