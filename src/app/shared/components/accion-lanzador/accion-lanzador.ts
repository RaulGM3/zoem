import { ChangeDetectionStrategy, Component, OnInit, computed, inject, input, output, signal } from '@angular/core';
import { AccionesService } from '../../../core/services/acciones.service';
import { PermissionService } from '../../../core/services/permission.service';
import type { Accion, AmbitoAccion } from '../../../interfaces/accion.interface';
import type { Contact } from '../../../interfaces/contact.interface';
import type { Caso, Hito } from '../../../interfaces/caso.interface';
import { AccionSelectorComponent } from '../accion-selector/accion-selector';
import { AccionEjecutarComponent } from '../accion-ejecutar/accion-ejecutar';

/**
 * Orquesta "elegir acción -> ejecutar" para que contactos y casos solo tengan
 * que montar este componente. Si llega `accion` salta el selector; si llegan
 * `sugeridas` las ofrece sin consultar el catálogo.
 */
@Component({
  selector: 'app-accion-lanzador',
  imports: [AccionSelectorComponent, AccionEjecutarComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'contents' },
  template: `
    @if (elegida(); as a) {
      <app-accion-ejecutar
        [accion]="a" [contactos]="contactos()" [caso]="caso()" [hitos]="hitos()" [hitoId]="hitoId()"
        (closed)="closed.emit()" />
    } @else {
      <app-accion-selector
        [acciones]="lista()" [cargando]="cargando()" [puedeGestionar]="puedeGestionar()"
        (elegida)="elegida.set($event)" (closed)="closed.emit()" />
    }
  `,
})
export class AccionLanzadorComponent implements OnInit {
  private readonly accionesService = inject(AccionesService);
  private readonly perm = inject(PermissionService);

  readonly ambito = input.required<AmbitoAccion>();
  readonly contactos = input.required<Contact[]>();
  readonly caso = input<Caso | null>(null);
  readonly hitos = input<Hito[]>([]);
  readonly hitoId = input<string | null>(null);
  /** Acción ya decidida: salta el selector. */
  readonly accion = input<Accion | null>(null);
  /** Acciones candidatas ya conocidas (p. ej. las ligadas al hito completado). */
  readonly sugeridas = input<Accion[] | null>(null);

  readonly closed = output<void>();

  readonly elegida = signal<Accion | null>(null);
  private readonly cargadas = signal<Accion[]>([]);
  readonly cargando = signal(false);
  readonly lista = computed(() => this.sugeridas() ?? this.cargadas());
  readonly puedeGestionar = computed(() => this.perm.can('Configuración', 'editar'));

  async ngOnInit(): Promise<void> {
    const directa = this.accion();
    if (directa) {
      this.elegida.set(directa);
      return;
    }
    if (this.sugeridas()) return;
    this.cargando.set(true);
    try {
      this.cargadas.set(await this.accionesService.listarPorAmbito(this.ambito()));
    } catch (e) {
      console.error('[acciones] no se pudieron cargar', e);
    } finally {
      this.cargando.set(false);
    }
  }
}
