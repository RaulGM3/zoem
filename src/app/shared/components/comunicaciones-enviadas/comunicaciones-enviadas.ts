import { ChangeDetectionStrategy, Component, computed, effect, inject, input, output, signal } from '@angular/core';
import { LucideAngularModule, FileText, Send } from 'lucide-angular';
import { AccionRegistrosService } from '../../../core/services/accion-registros.service';
import { UsersService } from '../../../core/services/users';
import { CANAL_LABELS, type AccionRegistro } from '../../../interfaces/accion.interface';
import { formatearFechaEs } from '../../../core/acciones/contexto-accion';

/**
 * Historial de acciones enviadas (registros de Acciones) de un contacto o de un
 * caso. Si el padre ya tiene los registros (p. ej. para contar envíos), los pasa
 * por `registros` + `cargando` y el componente no consulta Firestore.
 * Con `puedeLanzar` muestra un atajo que emite `lanzar` para abrir el lanzador.
 *
 * `display:block` en el host: un custom element es inline por defecto y el
 * `space-y-*` de Tailwind v4 (margin-bottom) no se aplicaría.
 */
@Component({
  selector: 'app-comunicaciones-enviadas',
  imports: [LucideAngularModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  template: `
    <section aria-labelledby="ce-titulo" class="rounded-xl p-5" style="background:var(--surface);border:1px solid var(--border)">
      <div class="mb-3 flex items-start justify-between gap-3">
        <div class="min-w-0">
          <h2 id="ce-titulo" class="flex items-center gap-2 text-sm font-semibold" style="color:var(--text-strong)">
            <lucide-icon [img]="SendIcon" class="w-4 h-4" style="color:var(--brand)" aria-hidden="true" />Acciones enviadas
          </h2>
          <p class="mt-0.5 text-xs" style="color:var(--text-muted)">Mensajes y documentos enviados desde Acciones.</p>
        </div>
        @if (puedeLanzar()) {
          <button type="button" data-testid="lanzar-accion" (click)="lanzar.emit()"
            class="tap-target inline-flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors duration-150 hover:bg-[var(--surface-2)]"
            style="border:1px solid var(--border);color:var(--brand)">
            <lucide-icon [img]="SendIcon" class="w-3.5 h-3.5" aria-hidden="true" />Lanzar acción
          </button>
        }
      </div>
      @if (cargando()) {
        <p role="status" class="text-sm" style="color:var(--text-faint)">Cargando...</p>
      } @else if (error()) {
        <p role="alert" class="text-sm" style="color:var(--danger)">No se pudo cargar el historial de comunicaciones.</p>
      } @else if (registros().length === 0) {
        <p class="text-sm" style="color:var(--text-muted)">Todavía no se ha enviado ninguna acción.</p>
      } @else {
        <ul class="divide-y" style="--tw-divide-color:var(--border)">
          @for (r of registros(); track r.id) {
            <li class="py-2.5 flex items-start justify-between gap-3">
              <div class="min-w-0">
                <p class="text-sm font-medium truncate" style="color:var(--text-strong)">{{ r.accionNombre }}</p>
                <p class="text-xs" style="color:var(--text-muted)">
                  {{ fecha(r) }} · {{ canalLabels[r.canal] }} · {{ autor(r) }}
                </p>
              </div>
              @if (r.docPath) {
                <span data-testid="con-documento" class="shrink-0 inline-flex items-center gap-1 text-xs" style="color:var(--text-muted)">
                  <lucide-icon [img]="FileTextIcon" class="w-3.5 h-3.5" /> Documento
                </span>
              }
            </li>
          }
        </ul>
      }
    </section>
  `,
})
export class ComunicacionesEnviadasComponent {
  private readonly registrosService = inject(AccionRegistrosService);
  private readonly users = inject(UsersService);

  readonly contactoId = input<string | null>(null);
  readonly casoId = input<string | null>(null);
  readonly registrosExternos = input<AccionRegistro[] | undefined>(undefined, { alias: 'registros' });
  readonly cargandoExterno = input(false, { alias: 'cargando' });
  readonly puedeLanzar = input(false);
  readonly lanzar = output<void>();

  readonly FileTextIcon = FileText;
  readonly SendIcon = Send;
  readonly canalLabels = CANAL_LABELS;

  private readonly cargados = signal<AccionRegistro[]>([]);
  private readonly cargandoPropio = signal(true);
  readonly registros = computed(() => this.registrosExternos() ?? this.cargados());
  readonly cargando = computed(() => (this.registrosExternos() ? this.cargandoExterno() : this.cargandoPropio()));
  readonly error = signal(false);
  private readonly nombres = computed(
    () => new Map(this.users.members().map((m) => [m.userId, `${m.nombre}${m.apellido ? ' ' + m.apellido : ''}`])),
  );

  constructor() {
    effect(() => {
      const contacto = this.contactoId();
      const caso = this.casoId();
      if (this.registrosExternos() || (!contacto && !caso)) return;
      void this.cargar(contacto, caso);
    });
  }

  private async cargar(contacto: string | null, caso: string | null): Promise<void> {
    this.cargandoPropio.set(true);
    this.error.set(false);
    try {
      this.cargados.set(
        contacto ? await this.registrosService.listarPorContacto(contacto) : await this.registrosService.listarPorCaso(caso!),
      );
    } catch (e) {
      console.error('[acciones] historial', e);
      this.error.set(true);
    } finally {
      this.cargandoPropio.set(false);
    }
  }

  fecha(r: AccionRegistro): string {
    return r.createdAt ? formatearFechaEs(r.createdAt.toDate()) : '—';
  }

  autor(r: AccionRegistro): string {
    return this.nombres().get(r.createdBy) ?? 'Desconocido';
  }
}
