import {
  ChangeDetectionStrategy, Component, DestroyRef, ElementRef, Injector, afterNextRender, computed,
  inject, output, signal, viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router } from '@angular/router';
import { filter } from 'rxjs';
import {
  LoaderCircle, LucideAngularModule, MessageSquare, Mic, RotateCcw, Send, Square, TriangleAlert, X,
} from 'lucide-angular';
import { AgentChatService } from '../../core/agent/agent-chat.service';
import { PermissionService } from '../../core/services/permission.service';
import type { EstadoDictado } from '../../core/voz/dictado-estado';
import { DictadoService } from '../../core/voz/dictado.service';
import { fusionarDictado } from '../../core/voz/transcripcion-texto';
import { FocusTrapDirective } from '../../shared/directives/focus-trap.directive';
import { contextoAgente } from './contexto-agente';

export type FaseVoz = 'dictando' | 'editando' | 'pensando' | 'respuesta';

/**
 * En qué punto del ciclo está la hoja. Pura, para que la plantilla no tenga
 * que combinar tres flags y para poder probar la tabla entera sin TestBed.
 *
 * El orden importa: si el usuario vuelve a dictar con una respuesta en
 * pantalla, manda el dictado.
 */
export function faseVoz(
  estado: EstadoDictado,
  pensando: boolean,
  hayRespuesta: boolean,
): FaseVoz {
  if (pensando) return 'pensando';
  if (estado === 'permiso' || estado === 'grabando' || estado === 'transcribiendo') return 'dictando';
  if (hayRespuesta) return 'respuesta';
  return 'editando';
}

/**
 * Entrada por voz al agente, la que abre el botón flotante en MÓVIL.
 *
 * Abre grabando: en el teléfono hablar es más rápido que teclear. Pero NUNCA
 * envía lo dictado por su cuenta: la transcripción cae en un textarea y es el
 * usuario quien la revisa y pulsa "Ejecutar". En un CRM jurídico, un apellido
 * mal oído que se ejecutara solo acabaría en el expediente equivocado.
 *
 * Si no hay micro (navegador, permiso denegado), la hoja sirve igual para
 * escribir: el textarea está siempre ahí cuando no se está grabando.
 *
 * Igual que el panel, vive en el chunk diferido del lanzador y se DESTRUYE al
 * cerrarse, para que `appFocusTrap` devuelva el foco al botón flotante.
 */
@Component({
  selector: 'app-agente-voz',
  imports: [LucideAngularModule, FocusTrapDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [DictadoService],
  template: `
    <div
      appFocusTrap
      (escapeKey)="cerrar()"
      role="dialog"
      aria-modal="false"
      aria-labelledby="agente-voz-titulo"
      class="fixed z-[60] inset-x-0 bottom-0 flex flex-col gap-4 px-4 pt-4 rounded-t-2xl shadow-2xl"
      style="background:var(--popover);border-top:1px solid var(--border);color:var(--text);padding-bottom:calc(1rem + env(safe-area-inset-bottom, 0px))"
    >
      <div class="flex items-center justify-between">
        <h2 id="agente-voz-titulo" class="text-sm font-semibold">Vertey IA</h2>
        <button
          type="button"
          data-test="cancelar"
          (click)="cerrar()"
          aria-label="Cerrar el asistente"
          class="tap-target p-2 rounded-lg text-[var(--text-muted)] hover:bg-surface-2 hover:text-[var(--text)]
                 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-ia)]"
        >
          <lucide-icon [img]="XIcon" class="w-5 h-5" aria-hidden="true" />
        </button>
      </div>

      @switch (fase()) {
        @case ('dictando') {
          <div class="flex flex-col items-center gap-3 py-4">
            <button
              type="button"
              data-test="micro"
              (click)="dictar()"
              [disabled]="transcribiendo()"
              [attr.aria-pressed]="grabando()"
              [attr.aria-label]="etiqueta()"
              [attr.aria-busy]="transcribiendo() ? 'true' : null"
              class="w-20 h-20 flex items-center justify-center rounded-full text-white shadow-lg
                     disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2
                     focus-visible:ring-offset-2 focus-visible:ring-[var(--accent-ia)]"
              [class.motion-safe:animate-pulse]="grabando()"
              [style.background]="grabando() ? 'var(--danger)' : 'var(--ia-solid)'"
            >
              <lucide-icon
                [img]="transcribiendo() ? LoaderIcon : grabando() ? StopIcon : MicIcon"
                class="w-8 h-8"
                [class.motion-safe:animate-spin]="transcribiendo()"
                aria-hidden="true"
              />
            </button>
            <p class="text-sm text-[var(--text-muted)] text-center" aria-hidden="true">{{ anuncio() }}</p>
          </div>
        }

        @case ('pensando') {
          <div class="flex flex-col gap-3 py-2" aria-busy="true">
            <p class="text-sm">{{ enviado() }}</p>
            <p class="flex items-center gap-2 text-sm text-[var(--text-muted)]">
              <lucide-icon [img]="LoaderIcon" class="w-4 h-4 motion-safe:animate-spin" aria-hidden="true" />
              Pensando…
            </p>
          </div>
        }

        @case ('respuesta') {
          <p data-test="respuesta" class="text-sm whitespace-pre-wrap max-h-[50vh] overflow-y-auto">{{ respuesta() }}</p>
          <div class="grid grid-cols-2 gap-2">
            @if (soportado) {
              <button
                type="button"
                data-test="dictar-otra-vez"
                (click)="dictarOtraVez()"
                class="tap-target flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-sm font-medium
                       focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-ia)]"
                style="border:1px solid var(--border)"
              >
                <lucide-icon [img]="RotateIcon" class="w-4 h-4" aria-hidden="true" />
                Dictar otra vez
              </button>
            }
            <button
              type="button"
              data-test="ver-conversacion"
              (click)="verConversacion.emit()"
              class="tap-target flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-sm font-medium
                     focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-ia)]"
              [class.col-span-2]="!soportado"
              style="border:1px solid var(--border)"
            >
              <lucide-icon [img]="ChatIcon" class="w-4 h-4" aria-hidden="true" />
              Ver conversación
            </button>
          </div>
        }

        @default {
          @if (mensajeError(); as detalle) {
            <p
              role="alert"
              class="flex items-start gap-2 px-3 py-2 rounded-lg text-xs"
              style="border:1px solid var(--danger);color:var(--danger)"
            >
              <lucide-icon [img]="AlertIcon" class="w-4 h-4 shrink-0 mt-px" aria-hidden="true" />
              <span>{{ detalle }}</span>
            </p>
          }

          <label for="agente-voz-texto" class="sr-only">Lo que quieres pedir al asistente</label>
          <textarea
            #entrada
            id="agente-voz-texto"
            rows="2"
            [value]="inputText()"
            (input)="onInput($event)"
            placeholder="Dime qué necesitas…"
            class="w-full max-h-40 resize-none px-3 py-2 rounded-xl text-base
                   focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-ia)]"
            style="background:var(--surface);border:1px solid var(--border);color:var(--text)"
          ></textarea>

          <div class="flex items-center gap-2">
            @if (soportado) {
              <button
                type="button"
                data-test="micro"
                (click)="dictar()"
                [attr.aria-pressed]="grabando()"
                [attr.aria-label]="etiqueta()"
                class="tap-target w-11 h-11 shrink-0 flex items-center justify-center rounded-xl text-[var(--text-muted)]
                       focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-ia)]"
                style="border:1px solid var(--border)"
              >
                <lucide-icon [img]="MicIcon" class="w-5 h-5" aria-hidden="true" />
              </button>
            }
            <button
              type="button"
              data-test="ejecutar"
              (click)="ejecutar()"
              [disabled]="!puedeEjecutar()"
              class="tap-target flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold
                     text-white disabled:opacity-40 disabled:cursor-not-allowed
                     focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2
                     focus-visible:ring-[var(--accent-ia)]"
              style="background:var(--ia-solid)"
            >
              <lucide-icon [img]="SendIcon" class="w-4 h-4" aria-hidden="true" />
              Ejecutar
            </button>
          </div>
        }
      }

      <span class="sr-only" role="status" aria-live="polite">{{ anuncio() }}</span>
    </div>
  `,
})
export class AgenteVozComponent {
  private readonly dictado = inject(DictadoService);
  private readonly chat = inject(AgentChatService);
  private readonly router = inject(Router);
  private readonly perm = inject(PermissionService);
  private readonly injector = inject(Injector);

  readonly MicIcon = Mic;
  readonly StopIcon = Square;
  readonly LoaderIcon = LoaderCircle;
  readonly AlertIcon = TriangleAlert;
  readonly SendIcon = Send;
  readonly RotateIcon = RotateCcw;
  readonly ChatIcon = MessageSquare;
  readonly XIcon = X;

  readonly cerrado = output<void>();
  readonly verConversacion = output<void>();

  private readonly entrada = viewChild<ElementRef<HTMLTextAreaElement>>('entrada');

  /** Se consulta una vez: la capacidad del navegador no cambia en caliente. */
  readonly soportado = this.dictado.soportado();

  readonly etiqueta = this.dictado.etiqueta;
  readonly anuncio = this.dictado.anuncio;
  readonly grabando = this.dictado.grabando;
  readonly mensajeError = this.dictado.mensajeError;
  readonly transcribiendo = computed(() => this.dictado.estado() === 'transcribiendo');

  readonly inputText = signal('');
  /** Lo último que se mandó al agente. `null` = aún no se ha ejecutado nada. */
  readonly enviado = signal<string | null>(null);

  readonly respuesta = computed(
    () => [...this.chat.mensajes()].reverse().find((m) => m.entrante)?.texto ?? '',
  );

  readonly fase = computed(() =>
    faseVoz(
      this.dictado.estado(),
      this.chat.pensando(),
      this.enviado() !== null,
    ),
  );

  readonly puedeEjecutar = computed(() => !!this.inputText().trim() && !this.chat.pensando());

  constructor() {
    afterNextRender(() => {
      if (this.soportado) void this.dictar();
      else this.enfocarEntrada();
    });

    // Si el agente nos lleva a otra pantalla, lo que el usuario quiere ver es
    // esa pantalla, no la hoja tapándola. Solo tras ejecutar: antes, una
    // navegación no tiene nada que ver con lo que se está dictando.
    this.router.events
      .pipe(filter((e) => e instanceof NavigationEnd), takeUntilDestroyed())
      .subscribe(() => {
        if (this.enviado() !== null) this.cerrado.emit();
      });

    // Cerrar a mitad de grabación descarta el audio: no sale del navegador.
    inject(DestroyRef).onDestroy(() => this.dictado.cancelar());
  }

  /** Arranca la grabación o, si ya graba, la termina. El texto se AÑADE, no se envía. */
  async dictar(): Promise<void> {
    const texto = await this.dictado.alternar();
    if (!texto) {
      if (this.dictado.estado() === 'error') this.enfocarEntrada();
      return;
    }

    const actual = this.inputText();
    const { texto: nuevo, cursor } = fusionarDictado(actual, texto, actual.length, actual.length);
    this.inputText.set(nuevo);
    this.enfocarEntrada(cursor);
  }

  dictarOtraVez(): void {
    this.enviado.set(null);
    this.inputText.set('');
    void this.dictar();
  }

  onInput(event: Event): void {
    const el = event.target as HTMLTextAreaElement;
    this.inputText.set(el.value);
    autoGrow(el);
  }

  ejecutar(): void {
    const msg = this.inputText().trim();
    if (!msg || this.chat.pensando()) return;

    this.enviado.set(msg);
    void this.chat.send(msg, {
      soloLectura: false,
      contexto: contextoAgente(this.router.url, this.perm.userRole()),
    });
  }

  cerrar(): void {
    this.dictado.cancelar();
    this.cerrado.emit();
  }

  /**
   * El textarea solo existe en la fase de edición, así que hay que esperar al
   * render que lo pinta antes de darle el foco.
   */
  private enfocarEntrada(cursor?: number): void {
    afterNextRender(
      () => {
        const el = this.entrada()?.nativeElement;
        if (!el) return;
        el.value = this.inputText();
        el.focus();
        const fin = cursor ?? el.value.length;
        el.setSelectionRange(fin, fin);
        autoGrow(el);
      },
      { injector: this.injector },
    );
  }
}

/** Crece con el contenido; el tope lo pone `max-h-40`. Resetear a 'auto' hace que encoja. */
function autoGrow(el: HTMLTextAreaElement): void {
  el.style.height = 'auto';
  el.style.height = `${el.scrollHeight}px`;
}
