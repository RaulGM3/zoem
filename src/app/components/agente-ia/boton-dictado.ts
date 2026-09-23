import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { LoaderCircle, LucideAngularModule, Mic, Square, TriangleAlert } from 'lucide-angular';
import { DictadoService } from '../../core/voz/dictado.service';

/**
 * Botón de dictado por voz del composer.
 *
 * Es un TOGGLE, no un "mantener pulsado": un `<button>` nativo que se activa
 * con clic, Enter o Espacio. Push-to-talk exigiría sostener el gesto, que no es
 * operable por teclado ni por conmutador (WCAG 2.1.1).
 *
 * No envía nada: emite el texto para que el composer lo deje en el textarea y
 * sea el usuario quien revise y decida. En un CRM jurídico, un apellido mal
 * oído que se enviara solo acabaría en el expediente equivocado.
 *
 * Si el navegador no puede grabar, el botón NO se renderiza: un control muerto
 * anunciado por el lector de pantalla es peor que la ausencia del control.
 */
@Component({
  selector: 'app-boton-dictado',
  imports: [LucideAngularModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'relative shrink-0' },
  template: `
    @if (soportado) {
      @if (mensajeError(); as detalle) {
        <p
          role="alert"
          class="absolute bottom-full right-0 mb-2 w-64 flex items-start gap-2 px-3 py-2 rounded-lg text-xs shadow-lg"
          style="background:var(--surface);border:1px solid var(--danger);color:var(--danger)"
        >
          <lucide-icon [img]="AlertIcon" class="w-4 h-4 shrink-0 mt-px" aria-hidden="true" />
          <span>{{ detalle }}</span>
        </p>
      }

      <button
        type="button"
        (click)="alternar()"
        (keydown.escape)="cancelar()"
        [disabled]="bloqueado()"
        [attr.aria-pressed]="grabando()"
        [attr.aria-label]="etiqueta()"
        [attr.aria-busy]="transcribiendo() ? 'true' : null"
        class="w-10 h-10 flex items-center justify-center rounded-xl transition-colors
               disabled:opacity-40 disabled:cursor-not-allowed
               focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1"
        [class.motion-safe:animate-pulse]="grabando()"
        [style.background]="grabando() ? 'var(--danger)' : 'transparent'"
        [style.color]="grabando() ? '#fff' : 'var(--text-muted)'"
      >
        <lucide-icon [img]="icono()" class="w-5 h-5" aria-hidden="true" />
      </button>

      <span class="sr-only" role="status" aria-live="polite">{{ anuncio() }}</span>
    }
  `,
  providers: [DictadoService],
})
export class BotonDictadoComponent {
  private readonly dictado = inject(DictadoService);

  readonly MicIcon = Mic;
  readonly StopIcon = Square;
  readonly LoaderIcon = LoaderCircle;
  readonly AlertIcon = TriangleAlert;

  /** El composer lo activa mientras el agente está respondiendo. */
  readonly deshabilitado = input(false);
  readonly transcrito = output<string>();

  /** Se consulta una vez: la capacidad del navegador no cambia en caliente. */
  readonly soportado = this.dictado.soportado();

  readonly etiqueta = this.dictado.etiqueta;
  readonly anuncio = this.dictado.anuncio;
  readonly grabando = this.dictado.grabando;
  readonly mensajeError = this.dictado.mensajeError;

  readonly transcribiendo = computed(() => this.dictado.estado() === 'transcribiendo');
  readonly bloqueado = computed(() => this.deshabilitado() || this.transcribiendo());

  readonly icono = computed(() => {
    if (this.grabando()) return this.StopIcon;
    if (this.transcribiendo()) return this.LoaderIcon;
    return this.MicIcon;
  });

  async alternar(): Promise<void> {
    const texto = await this.dictado.alternar();
    if (texto) this.transcrito.emit(texto);
  }

  cancelar(): void {
    this.dictado.cancelar();
  }
}
