import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { LucideAngularModule, Sparkles } from 'lucide-angular';
import { AccionRedaccionService } from '../../../core/services/accion-redaccion.service';
import type { FormatoRedaccion, ModoRedaccion, TextoRedactado } from '../../../core/acciones/redaccion-ia';

/**
 * Bloque plegable "Redactar con IA": el usuario explica qué quiere decir y
 * Gemini escribe asunto y cuerpo. Emite `redactado`; el padre decide cómo
 * volcarlo en su formulario.
 */
@Component({
  selector: 'app-redactor-ia',
  imports: [LucideAngularModule, ReactiveFormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="rounded-xl" style="border:1px dashed color-mix(in srgb,var(--brand) 40%,var(--border))">
      <button type="button" data-testid="redactor-toggle" (click)="abierto.set(!abierto())"
        [attr.aria-expanded]="abierto()" [attr.aria-controls]="idPrefix() + '-ia-panel'"
        class="w-full flex items-center gap-2 px-3 min-h-11 text-sm font-medium rounded-xl" style="color:var(--brand)">
        <lucide-icon [img]="SparklesIcon" size="16" aria-hidden="true"></lucide-icon>
        Redactar con IA
      </button>
      @if (abierto()) {
        <div [id]="idPrefix() + '-ia-panel'" class="px-3 pb-3 space-y-2">
          <label [for]="idPrefix() + '-ia-instrucciones'" class="form-label">¿Qué quieres decir?</label>
          <textarea [id]="idPrefix() + '-ia-instrucciones'" [formControl]="instrucciones" rows="3"
            class="form-input resize-y" [attr.aria-describedby]="idPrefix() + '-ia-ayuda'"
            [placeholder]="placeholder()"></textarea>
          <p [id]="idPrefix() + '-ia-ayuda'" class="text-xs" style="color:var(--text-faint)">
            {{ ayuda() }} Revisa siempre el texto antes de enviarlo.
          </p>
          @if (error(); as e) {
            <p role="alert" class="text-sm" style="color:var(--danger)">{{ e }}</p>
          }
          <div class="flex justify-end">
            <button type="button" data-testid="redactor-generar" (click)="generar()"
              [disabled]="cargando() || !hayInstrucciones()" [attr.aria-busy]="cargando()"
              class="px-4 min-h-11 text-sm font-semibold text-white rounded-xl disabled:opacity-50 disabled:cursor-not-allowed"
              style="background:var(--brand)">
              {{ cargando() ? 'Redactando…' : 'Redactar' }}
            </button>
          </div>
          <p role="status" aria-live="polite" class="sr-only">{{ cargando() ? 'Redactando el mensaje…' : '' }}</p>
        </div>
      }
    </div>
  `,
})
export class RedactorIaComponent {
  private readonly svc = inject(AccionRedaccionService);

  readonly modo = input.required<ModoRedaccion>();
  readonly formato = input.required<FormatoRedaccion>();
  /** Prefijo de ids: puede haber más de un redactor en el DOM. */
  readonly idPrefix = input.required<string>();
  readonly contexto = input<Record<string, string> | null>(null);
  readonly borrador = input<TextoRedactado | null>(null);

  readonly redactado = output<TextoRedactado>();

  readonly SparklesIcon = Sparkles;
  readonly instrucciones = new FormControl('', { nonNullable: true });
  readonly abierto = signal(false);
  readonly cargando = signal(false);
  readonly error = signal<string | null>(null);
  private readonly valor = signal('');

  readonly hayInstrucciones = computed(() => this.valor().trim().length > 0);
  readonly placeholder = computed(() =>
    this.formato() === 'whatsapp'
      ? 'Ej. Recordarle que mañana es la vista y que traiga el DNI'
      : 'Ej. Pedirle la documentación pendiente para presentar la demanda antes del viernes',
  );
  readonly ayuda = computed(() =>
    this.modo() === 'plantilla'
      ? `Se generará una plantilla ${this.formato() === 'whatsapp' ? 'de WhatsApp' : 'de email'} con variables y reemplazará el asunto y el cuerpo.`
      : `Se envían a la IA el nombre del cliente y los datos del caso (no se envían el email ni el teléfono). Reemplazará el ${this.formato() === 'whatsapp' ? 'mensaje de WhatsApp' : 'email'} actual.`,
  );

  constructor() {
    this.instrucciones.valueChanges.subscribe((v) => this.valor.set(v));
  }

  async generar(): Promise<void> {
    if (this.cargando() || !this.hayInstrucciones()) return;
    this.cargando.set(true);
    this.error.set(null);
    const contexto = this.contexto();
    const borrador = this.borrador();
    const r = await this.svc.redactar({
      modo: this.modo(),
      formato: this.formato(),
      instrucciones: this.instrucciones.value.trim(),
      ...(contexto ? { contexto } : {}),
      ...(borrador ? { borrador } : {}),
    });
    this.cargando.set(false);
    if (r.ok) this.redactado.emit(r.texto);
    else this.error.set(r.mensaje);
  }
}
