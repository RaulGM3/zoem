import { afterNextRender, ChangeDetectionStrategy, Component, ElementRef, computed, effect, inject, Injector, input, output, signal, untracked } from '@angular/core';
import { LucideAngularModule, TriangleAlert, ExternalLink } from 'lucide-angular';
import type { Caso } from '../../../../interfaces/caso.interface';
import { esPlazoProcesal } from '../../../../interfaces/evento.interface';
import type { Evento } from '../../../../interfaces/evento.interface';
import { JURISDICCIONES, JURISDICCION_LABEL } from '../../../../core/plazos/calendario-judicial';
import type { DiaInhabil, Jurisdiccion } from '../../../../core/plazos/calendario-judicial';
import type { UnidadPlazo } from '../../../../core/plazos/computo-plazo';
import { formatearFechaEs } from '../../../../core/plazos/plazo-evento';
import { agruparParaRevision, alternarDias, diasAMostrar, fechaItem, fusionarCandidatos, itemMarcado } from '../../../../core/plazos/revision-dias';
import type { ItemRevision } from '../../../../core/plazos/revision-dias';
import { TIPOS_PLAZO } from '../../../../core/plazos/tipos-plazo';
import { PlazosService } from '../../../../core/services/plazos.service';
import type { EntradaPrevisualizacion, Previsualizacion } from '../../../../core/services/plazos.service';
import { ToastService } from '../../../../core/services/toast.service';
import { OverlayShellComponent } from '../../../../shared/components/overlay-shell/overlay-shell';

const DEBOUNCE_MS = 250;
const ISO = /^\d{4}-\d{2}-\d{2}$/;
const ETIQUETA_POR_DEFECTO = 'Plazo procesal';

export const AVISO_BETA = 'Función en pruebas. Cálculo orientativo; la responsabilidad del cómputo es del profesional.';

/**
 * Drawer de cálculo de plazos procesales (BETA). Nada se guarda sin que el usuario revise y confirme
 * los días inhábiles y el vencimiento resultante (principio rector: ningún día rojo se aplica a ciegas).
 */
@Component({
  selector: 'app-plazo-drawer',
  imports: [OverlayShellComponent, LucideAngularModule],
  templateUrl: './plazo-drawer.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PlazoDrawerComponent {
  private readonly plazos = inject(PlazosService);
  private readonly toast = inject(ToastService);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly injector = inject(Injector);

  readonly visible = input.required<boolean>();
  readonly caso = input.required<Pick<Caso, 'id' | 'titulo' | 'jurisdiccion' | 'partidoJudicialId'>>();
  /** Permiso `Casos.editar`: sin él no se puede crear ni aceptar. */
  readonly canEdit = input(true);
  /** Plazo en estado `requiere_revision` que se está revisando; null = plazo nuevo. */
  readonly plazoRevision = input<Evento | null>(null);

  readonly closed = output<void>();
  readonly guardado = output<void>();

  protected readonly AlertIcon = TriangleAlert;
  protected readonly LinkIcon = ExternalLink;
  protected readonly jurisdicciones = JURISDICCIONES;
  protected readonly jurisdiccionLabel = JURISDICCION_LABEL;
  protected readonly avisoBeta = AVISO_BETA;
  protected readonly formatearFecha = formatearFechaEs;

  protected readonly fechaNotificacion = signal('');
  protected readonly tipoId = signal('');
  protected readonly etiquetaPersonal = signal('');
  protected readonly cantidad = signal('');
  protected readonly unidad = signal<UnidadPlazo>('dias');
  protected readonly jurisdiccion = signal<Jurisdiccion | ''>('');
  protected readonly urgente = signal(false);
  protected readonly excluidos = signal<readonly string[]>([]);
  protected readonly candidatos = signal<readonly DiaInhabil[]>([]);
  protected readonly confirmado = signal(false);

  protected readonly preview = signal<Previsualizacion | null>(null);
  protected readonly calculando = signal(false);
  protected readonly errorCalculo = signal<string | null>(null);
  protected readonly saving = signal(false);

  private focoAvisosHecho = false;

  /** El plazo en revisión, si lo hay y es un plazo procesal. */
  protected readonly revision = computed(() => {
    const e = this.plazoRevision();
    return e && esPlazoProcesal(e) ? e : null;
  });
  protected readonly modoRevision = computed(() => this.revision() !== null);
  protected readonly titulo = computed(() => (this.modoRevision() ? 'Revisar plazo (BETA)' : 'Nuevo plazo (BETA)'));

  protected readonly tiposDisponibles = computed(() => TIPOS_PLAZO.filter((t) => t.jurisdiccion === this.jurisdiccion()));

  private readonly entrada = computed<EntradaPrevisualizacion | null>(() => {
    const fecha = this.fechaNotificacion();
    const cantidad = Number(this.cantidad());
    const jurisdiccion = this.jurisdiccion();
    if (!ISO.test(fecha) || !Number.isInteger(cantidad) || cantidad <= 0 || !jurisdiccion) return null;
    const caso = this.caso();
    return {
      caso: { id: caso.id, titulo: caso.titulo, partidoJudicialId: caso.partidoJudicialId },
      fechaNotificacion: fecha,
      cantidad,
      unidad: this.unidad(),
      jurisdiccion,
      ...(this.urgente() ? { urgente: true } : {}),
      ...(this.tipoId() ? { tipoPlazoId: this.tipoId() } : {}),
      excluidosPorUsuario: this.excluidos(),
    };
  });

  protected readonly etiqueta = computed(() => {
    const tipo = TIPOS_PLAZO.find((t) => t.id === this.tipoId());
    return tipo?.etiqueta ?? (this.etiquetaPersonal().trim() || ETIQUETA_POR_DEFECTO);
  });

  protected readonly resultado = computed(() => this.preview()?.resultado ?? null);
  protected readonly advertencias = computed(() => this.preview()?.advertencias ?? []);
  protected readonly numInhabiles = computed(() => this.resultado()?.diasInhabiles.length ?? 0);

  protected readonly items = computed<ItemRevision[]>(() => {
    const r = this.resultado();
    if (!r) return [];
    const dias = diasAMostrar(this.candidatos(), r.diasInhabiles, this.excluidos(), r.diaGracia);
    return agruparParaRevision(dias, this.preview()?.fuentes ?? {});
  });

  /** Vencimiento anterior (aceptado) y actual, para el aviso del modo revisión. */
  protected readonly vencimientoAnterior = computed(() => this.revision()?.origen.aceptacion.vencimiento ?? null);

  protected readonly puedeGuardar = computed(
    () => this.canEdit() && !this.saving() && !this.calculando() && !this.errorCalculo() && this.resultado() !== null && this.confirmado(),
  );

  constructor() {
    // Apertura: limpia o precarga el formulario.
    effect(() => {
      if (!this.visible()) return;
      const rev = this.revision();
      const caso = untracked(() => this.caso());
      untracked(() => {
        this.focoAvisosHecho = false;
        this.preview.set(null);
        this.errorCalculo.set(null);
        this.confirmado.set(false);
        this.candidatos.set([]);
        if (rev) {
          const e = rev.origen.entrada;
          this.fechaNotificacion.set(e.fechaNotificacion);
          this.tipoId.set(e.tipoPlazoId ?? '');
          this.etiquetaPersonal.set('');
          this.cantidad.set(String(e.cantidad));
          this.unidad.set(e.unidad);
          this.jurisdiccion.set(e.jurisdiccion);
          this.urgente.set(e.urgente ?? false);
          this.excluidos.set([...rev.origen.aceptacion.excluidosPorUsuario]);
        } else {
          this.fechaNotificacion.set('');
          this.tipoId.set('');
          this.etiquetaPersonal.set('');
          this.cantidad.set('');
          this.unidad.set('dias');
          this.jurisdiccion.set(caso.jurisdiccion ?? '');
          this.urgente.set(false);
          this.excluidos.set([]);
        }
      });
    });

    // Vista previa en vivo (con debounce); descarta respuestas obsoletas.
    effect((onCleanup) => {
      const entrada = this.entrada();
      if (!this.visible()) return;
      untracked(() => {
        this.confirmado.set(false);
        if (!entrada) {
          this.preview.set(null);
          this.calculando.set(false);
          this.errorCalculo.set(null);
          return;
        }
        this.calculando.set(true);
      });
      if (!entrada) return;
      let vigente = true;
      const timer = setTimeout(async () => {
        try {
          const p = await this.plazos.previsualizar(entrada);
          if (!vigente) return;
          this.preview.set(p);
          this.errorCalculo.set(null);
          this.candidatos.update((prev) => fusionarCandidatos(prev, p.resultado.diasInhabiles));
          this.calculando.set(false);
          this.enfocarPrimerAviso(p.advertencias.length);
        } catch (e) {
          if (!vigente) return;
          this.preview.set(null);
          this.errorCalculo.set(e instanceof Error ? e.message : 'No se pudo calcular el plazo.');
          this.calculando.set(false);
        }
      }, DEBOUNCE_MS);
      onCleanup(() => {
        vigente = false;
        clearTimeout(timer);
      });
    });
  }

  private enfocarPrimerAviso(n: number): void {
    if (n === 0 || this.focoAvisosHecho) return;
    this.focoAvisosHecho = true;
    afterNextRender(() => this.host.nativeElement.querySelector<HTMLElement>('[data-advertencia]')?.focus(), { injector: this.injector });
  }

  /** Cambia el cómputo base: los días revisados dejan de valer. */
  private invalidar(): void {
    this.excluidos.set([]);
    this.candidatos.set([]);
  }

  protected onFecha(v: string): void {
    this.fechaNotificacion.set(v);
    this.invalidar();
  }

  protected onTipo(id: string): void {
    this.tipoId.set(id);
    const tipo = TIPOS_PLAZO.find((t) => t.id === id);
    if (tipo) {
      this.cantidad.set(String(tipo.cantidad));
      this.unidad.set(tipo.unidad);
    }
    this.invalidar();
  }

  protected onCantidad(v: string): void {
    this.cantidad.set(v);
    this.invalidar();
  }

  protected onUnidad(v: string): void {
    this.unidad.set(v as UnidadPlazo);
    this.invalidar();
  }

  protected onJurisdiccion(v: string): void {
    this.jurisdiccion.set(v as Jurisdiccion | '');
    if (!TIPOS_PLAZO.some((t) => t.id === this.tipoId() && t.jurisdiccion === v)) this.tipoId.set('');
    this.invalidar();
  }

  protected onUrgente(v: boolean): void {
    this.urgente.set(v);
    this.invalidar();
  }

  protected marcado(item: ItemRevision): boolean {
    return itemMarcado(item, this.excluidos());
  }

  protected fechaDe(item: ItemRevision): string {
    return fechaItem(item);
  }

  protected alternar(item: ItemRevision, marcado: boolean): void {
    if (!this.canEdit()) return;
    this.excluidos.update((e) => alternarDias(e, item.fechas, marcado));
  }

  protected async guardar(): Promise<void> {
    const entrada = this.entrada();
    const p = this.preview();
    if (!this.canEdit() || !this.puedeGuardar() || !entrada || !p) return;
    const rev = this.revision();
    const excluidos = [...this.excluidos()];
    const caso = this.caso();
    this.saving.set(true);
    try {
      await this.toast.run(
        async () => {
          if (rev) {
            await this.plazos.aceptarRevision(rev.id, p.resultado, excluidos);
          } else {
            await this.plazos.guardar(
              caso.id,
              {
                fechaNotificacion: entrada.fechaNotificacion,
                cantidad: entrada.cantidad,
                unidad: entrada.unidad,
                jurisdiccion: entrada.jurisdiccion,
                urgente: entrada.urgente,
                tipoPlazoId: entrada.tipoPlazoId,
                etiqueta: this.etiqueta(),
                casoTitulo: caso.titulo,
                capas: { ca: p.capas.ca, ...(p.capas.partido ? { partido: p.capas.partido } : {}) },
              },
              p.resultado,
              excluidos,
            );
          }
        },
        {
          successMessage: rev ? 'Revisión aceptada: plazo actualizado' : 'Plazo guardado en el calendario',
          errorTitle: 'No se pudo guardar el plazo',
          onSuccess: () => {
            this.guardado.emit();
            this.closed.emit();
          },
        },
      );
    } finally {
      this.saving.set(false);
    }
  }
}
