import {
  afterRenderEffect,
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  inject,
  InjectionToken,
  input,
  PendingTasks,
  signal,
  viewChild,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { LifeBuoy, LucideAngularModule, Search, Sparkles } from 'lucide-angular';
import { buscarGuias } from '../../core/ayuda/buscar-guias';
import { cargarGuias } from '../../core/ayuda/cargar-guias';
import { guiaPorId, guiasVisibles } from '../../core/ayuda/filtro-guias';
import type { Guia } from '../../core/ayuda/guia';
import { PermissionService } from '../../core/services/permission.service';

/**
 * De dónde salen las guías. Es un token para que los tests inyecten guías de
 * juguete; en la app resuelve al import diferido del contenido real.
 */
export const CARGADOR_GUIAS = new InjectionToken<() => Promise<readonly Guia[]>>('CARGADOR_GUIAS', {
  providedIn: 'root',
  factory: () => cargarGuias,
});

type EstadoAyuda = 'cargando' | 'error' | 'guia' | 'sin-acceso' | 'no-existe';

/**
 * Página de ayuda: las mismas guías que consulta el agente, sin depender de la IA.
 * Todo el criterio (qué se ve, cómo se busca) vive en `core/ayuda`; aquí solo se pinta.
 */
@Component({
  selector: 'app-ayuda',
  imports: [RouterLink, LucideAngularModule],
  templateUrl: './ayuda.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AyudaComponent {
  private readonly perm = inject(PermissionService);
  private readonly cargar = inject(CARGADOR_GUIAS);
  private readonly tareas = inject(PendingTasks);

  /** Id de la guía, enlazado desde el parámetro de ruta `ayuda/:guia`. */
  readonly guia = input<string>();

  protected readonly LifeBuoyIcon = LifeBuoy;
  protected readonly SearchIcon = Search;
  protected readonly SparklesIcon = Sparkles;

  private readonly guias = signal<readonly Guia[]>([]);
  private readonly cargando = signal(true);
  private readonly errorCarga = signal(false);
  protected readonly consulta = signal('');

  private readonly tituloGuia = viewChild<ElementRef<HTMLElement>>('tituloGuia');

  /** Guías y tareas que este usuario puede ver. Reactivo al cambio de rol o de empresa. */
  protected readonly visibles = computed(() =>
    guiasVisibles(this.guias(), (modulo, capacidad) => this.perm.can(modulo, capacidad)),
  );

  protected readonly buscando = computed(() => this.consulta().trim().length > 0);

  protected readonly resultados = computed(() =>
    this.buscando() ? buscarGuias(this.visibles(), this.consulta()) : [],
  );

  private readonly totalTareas = computed(() =>
    this.resultados().reduce((suma, r) => suma + r.tareas.length, 0),
  );

  /** Texto de la región viva: lo que un lector de pantalla oye al teclear. */
  protected readonly recuento = computed(() => {
    if (!this.buscando()) return '';
    const total = this.totalTareas();
    if (total === 0) return 'Sin resultados';
    return total === 1 ? '1 resultado' : `${total} resultados`;
  });

  /** Sin guía en la URL se muestra la primera visible. */
  protected readonly idActivo = computed(() => this.guia() ?? this.visibles()[0]?.id);

  protected readonly activa = computed(() => {
    const id = this.idActivo();
    return id ? guiaPorId(this.visibles(), id) : undefined;
  });

  protected readonly estado = computed<EstadoAyuda>(() => {
    if (this.cargando()) return 'cargando';
    if (this.errorCarga()) return 'error';
    if (this.activa()) return 'guia';
    // Existe pero no es visible: no revelamos nada de su contenido.
    const id = this.idActivo();
    return id && guiaPorId(this.guias(), id) ? 'sin-acceso' : 'no-existe';
  });

  constructor() {
    this.cargarGuias();

    // Al cambiar de guía, el foco va a su título: si no, quien navega con teclado
    // o lector de pantalla se queda en el enlace del menú sin saber que cambió algo.
    let anterior: string | undefined;
    let primeraVez = true;
    afterRenderEffect(() => {
      const id = this.guia();
      const titulo = this.tituloGuia();
      if (!primeraVez && id !== anterior) titulo?.nativeElement.focus();
      primeraVez = false;
      anterior = id;
    });
  }

  protected reintentar(): void {
    this.cargarGuias();
  }

  protected alBuscar(evento: Event): void {
    this.consulta.set((evento.target as HTMLInputElement).value);
  }

  protected limpiarBusqueda(): void {
    this.consulta.set('');
  }

  private cargarGuias(): void {
    this.cargando.set(true);
    this.errorCarga.set(false);
    // PendingTasks: la app no se considera estable hasta que llegan las guías.
    void this.tareas.run(async () => {
      try {
        this.guias.set(await this.cargar());
      } catch {
        this.errorCarga.set(true);
      } finally {
        this.cargando.set(false);
      }
    });
  }
}
