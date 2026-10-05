import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal } from '@angular/core';
import { LucideAngularModule, FileText } from 'lucide-angular';
import { AccionRegistrosService } from '../../../core/services/accion-registros.service';
import { UsersService } from '../../../core/services/users';
import { CANAL_LABELS, type AccionRegistro } from '../../../interfaces/accion.interface';
import { formatearFechaEs } from '../../../core/acciones/contexto-accion';

/** Historial "Comunicaciones enviadas" de un contacto o de un caso. */
@Component({
  selector: 'app-comunicaciones-enviadas',
  imports: [LucideAngularModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section aria-labelledby="ce-titulo" class="rounded-xl p-5" style="background:var(--surface);border:1px solid var(--border)">
      <h2 id="ce-titulo" class="text-sm font-semibold mb-3" style="color:var(--text-strong)">Comunicaciones enviadas</h2>
      @if (cargando()) {
        <p role="status" class="text-sm" style="color:var(--text-faint)">Cargando...</p>
      } @else if (error()) {
        <p role="alert" class="text-sm" style="color:var(--danger)">No se pudo cargar el historial de comunicaciones.</p>
      } @else if (registros().length === 0) {
        <p class="text-sm" style="color:var(--text-muted)">Todavía no se ha enviado ninguna comunicación.</p>
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

  readonly FileTextIcon = FileText;
  readonly canalLabels = CANAL_LABELS;

  readonly registros = signal<AccionRegistro[]>([]);
  readonly cargando = signal(true);
  readonly error = signal(false);
  private readonly nombres = computed(
    () => new Map(this.users.members().map((m) => [m.userId, `${m.nombre}${m.apellido ? ' ' + m.apellido : ''}`])),
  );

  constructor() {
    effect(() => {
      const contacto = this.contactoId();
      const caso = this.casoId();
      if (!contacto && !caso) return;
      void this.cargar(contacto, caso);
    });
  }

  private async cargar(contacto: string | null, caso: string | null): Promise<void> {
    this.cargando.set(true);
    this.error.set(false);
    try {
      this.registros.set(
        contacto ? await this.registrosService.listarPorContacto(contacto) : await this.registrosService.listarPorCaso(caso!),
      );
    } catch (e) {
      console.error('[acciones] historial', e);
      this.error.set(true);
    } finally {
      this.cargando.set(false);
    }
  }

  fecha(r: AccionRegistro): string {
    return r.createdAt ? formatearFechaEs(r.createdAt.toDate()) : '—';
  }

  autor(r: AccionRegistro): string {
    return this.nombres().get(r.createdBy) ?? 'Desconocido';
  }
}
