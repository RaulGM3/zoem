import {
  ChangeDetectionStrategy, Component, ElementRef, computed, effect, inject, input, output, signal,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { LucideAngularModule, X } from 'lucide-angular';
import { FocusTrapDirective } from '../../directives/focus-trap.directive';
import {
  CANALES, CANAL_LABELS, type Accion, type AccionInput, type AmbitoAccion, type Canal,
} from '../../../interfaces/accion.interface';
import type { DocTemplate } from '../../../interfaces/doc-template.interface';
import type { HitoPlantilla } from '../../../interfaces/plantilla.interface';
import { VARIABLES_ACCION, insertarVariable } from '../../../core/acciones/insertar-variable';
import { formatoParaCanales, type TextoRedactado } from '../../../core/acciones/redaccion-ia';
import { RedactorIaComponent } from '../redactor-ia/redactor-ia';

type CampoTexto = 'asunto' | 'cuerpo';

/**
 * Drawer de alta/edición de una acción. Presentacional: emite `saved` con el
 * `AccionInput` y el padre persiste. Lo reutilizan el catálogo (Acciones) y la
 * pestaña "Acciones" de una plantilla de caso (con `ambitoFijo`, `plantillaId`
 * y `hitosPlantilla`).
 */
@Component({
  selector: 'app-accion-form-drawer',
  imports: [LucideAngularModule, ReactiveFormsModule, FocusTrapDirective, RedactorIaComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'contents' },
  template: `
    <div class="fixed inset-0 z-40 bg-black/30" (click)="closed.emit()" aria-hidden="true"></div>
    <aside
      class="fixed right-0 top-0 h-full w-full sm:max-w-md shadow-2xl z-50 flex flex-col"
      style="background:var(--surface)"
      role="dialog" aria-modal="true" aria-labelledby="af-title"
      appFocusTrap (escapeKey)="closed.emit()">
      <div class="flex items-center justify-between px-5 py-4" style="border-bottom:1px solid var(--border)">
        <h2 id="af-title" class="text-base font-semibold"
          style="color:var(--text-strong);font-family:var(--font-display)">
          {{ accion() ? 'Editar acción' : 'Nueva acción' }}
        </h2>
        <button type="button" (click)="closed.emit()" aria-label="Cerrar"
          class="p-2 rounded-lg min-w-11 min-h-11 flex items-center justify-center" style="color:var(--text-muted)">
          <lucide-icon [img]="XIcon" class="w-4 h-4" />
        </button>
      </div>

      <form [formGroup]="form" (ngSubmit)="guardar()" class="flex-1 overflow-y-auto px-5 py-4 space-y-4">
        <div>
          <label for="af-nombre" class="form-label">Nombre *</label>
          <input id="af-nombre" formControlName="nombre" type="text" class="form-input"
            placeholder="Ej. Enviar presupuesto" />
        </div>

        @if (!ambitoFijo()) {
          <div>
            <label for="af-ambito" class="form-label">Se ejecuta desde</label>
            <select id="af-ambito" formControlName="ambito" class="form-select">
              <option value="contacto">Un contacto</option>
              <option value="caso">Un caso</option>
            </select>
          </div>
        }

        @if (hitosPlantilla(); as hitos) {
          <div>
            <label for="af-hito" class="form-label">Sugerir al completar el hito</label>
            <select id="af-hito" formControlName="hitoPlantillaId" class="form-select">
              <option value="">Ninguno (solo manual)</option>
              @for (h of hitos; track h.id) {
                <option [value]="h.id">{{ h.titulo }}</option>
              }
            </select>
          </div>
        }

        <app-redactor-ia idPrefix="af" modo="plantilla" [formato]="formatoRedaccion()" [borrador]="textos()"
          (redactado)="aplicarRedaccion($event)" />

        <div>
          <label for="af-asunto" class="form-label">Asunto *</label>
          <input id="af-asunto" formControlName="asunto" type="text" class="form-input"
            (focus)="registrarFoco('asunto')" />
        </div>

        <div>
          <label for="af-cuerpo" class="form-label">Cuerpo *</label>
          <textarea id="af-cuerpo" formControlName="cuerpo" rows="7" class="form-input resize-y"
            (focus)="registrarFoco('cuerpo')"></textarea>
          <div class="mt-2" role="group" aria-label="Variables disponibles">
            <p class="text-xs mb-1" style="color:var(--text-faint)">
              Pulsa una variable para insertarla en {{ campoActivo() === 'asunto' ? 'el asunto' : 'el cuerpo' }}.
            </p>
            <div class="flex flex-wrap gap-1.5">
              @for (v of variables; track v.key) {
                <button type="button" [attr.data-variable]="v.key"
                  [attr.aria-label]="'Insertar variable ' + v.key"
                  (mousedown)="$event.preventDefault()"
                  (click)="insertarVariable(v.key)"
                  class="px-2.5 py-1 min-h-8 text-xs rounded-full font-mono"
                  style="background:color-mix(in srgb,var(--brand) 10%,transparent);color:var(--brand)">
                  {{ '{{' + v.key + '}}' }}
                </button>
              }
            </div>
          </div>
        </div>

        <div>
          <label for="af-doc" class="form-label">Documento adjunto (opcional)</label>
          <select id="af-doc" formControlName="docTemplateId" class="form-select">
            <option value="">Sin documento</option>
            @for (t of docTemplates(); track t.id) {
              <option [value]="t.id">{{ t.name }}</option>
            }
          </select>
          <p class="text-xs mt-1" style="color:var(--text-faint)">
            Se rellena con los datos del contacto o caso y se envía como enlace que caduca a los 7 días.
          </p>
        </div>

        <fieldset>
          <legend class="form-label">Canales permitidos *</legend>
          <div class="grid grid-cols-2 gap-2">
            @for (c of canales; track c) {
              <label class="flex items-center gap-2 text-sm min-h-11 cursor-pointer" style="color:var(--text-body)">
                <input type="checkbox" [checked]="canalesSel().includes(c)" (change)="toggleCanal(c)"
                  style="accent-color:var(--brand)" />
                {{ canalLabels[c] }}
              </label>
            }
          </div>
          @if (canalesSel().length === 0) {
            <p class="form-error" role="alert">Elige al menos un canal.</p>
          }
        </fieldset>

        <label class="flex items-center gap-2 text-sm min-h-11 cursor-pointer" style="color:var(--text-body)">
          <input type="checkbox" formControlName="activa" style="accent-color:var(--brand)" />
          Activa (disponible al ejecutar)
        </label>
      </form>

      <div class="px-5 py-4 flex gap-3 justify-end" style="border-top:1px solid var(--border)">
        <button type="button" (click)="closed.emit()"
          class="px-4 py-2 min-h-11 text-sm rounded-lg" style="border:1px solid var(--border);color:var(--text-muted)">
          Cancelar
        </button>
        <button type="button" (click)="guardar()" [disabled]="saving() || !puedeGuardar()"
          class="px-4 py-2 min-h-11 text-sm text-white rounded-lg disabled:opacity-50" style="background:var(--brand)">
          {{ saving() ? 'Guardando...' : (accion() ? 'Guardar' : 'Crear acción') }}
        </button>
      </div>
    </aside>
  `,
})
export class AccionFormDrawerComponent {
  private readonly fb = inject(FormBuilder);

  /** Acción en edición (null = alta). */
  readonly accion = input<Accion | null>(null);
  readonly saving = input(false);
  /** Plantillas de Documentos utilizables (estado `listo`). */
  readonly docTemplates = input<DocTemplate[]>([]);
  /** Si viene, el ámbito no se elige (p. ej. 'caso' desde una plantilla de caso). */
  readonly ambitoFijo = input<AmbitoAccion | null>(null);
  readonly plantillaId = input<string | null>(null);
  /** Hitos de la plantilla de caso: habilita el selector "Sugerir al completar el hito". */
  readonly hitosPlantilla = input<HitoPlantilla[] | null>(null);

  readonly saved = output<AccionInput>();
  readonly closed = output<void>();

  readonly XIcon = X;
  readonly variables = VARIABLES_ACCION;
  readonly canales = CANALES;
  readonly canalLabels = CANAL_LABELS;

  readonly form = this.fb.nonNullable.group({
    nombre: ['', Validators.required],
    ambito: this.fb.nonNullable.control<AmbitoAccion>('contacto'),
    asunto: ['', Validators.required],
    cuerpo: ['', Validators.required],
    docTemplateId: [''],
    hitoPlantillaId: [''],
    activa: [true],
  });

  readonly canalesSel = signal<Canal[]>([]);
  readonly campoActivo = signal<CampoTexto>('cuerpo');
  private readonly formValido = signal(false);
  /** Asunto y cuerpo espejados a signal: borrador que se pasa al redactor IA. */
  readonly textos = signal<TextoRedactado>({ asunto: '', cuerpo: '' });
  readonly formatoRedaccion = computed(() => formatoParaCanales(this.canalesSel()));


  readonly puedeGuardar = computed(() => this.formValido() && this.canalesSel().length > 0);

  constructor() {
    this.form.statusChanges.subscribe(() => this.formValido.set(this.form.valid));
    this.form.valueChanges.subscribe(() => this.sincronizarTextos());
    effect(() => {
      const a = this.accion();
      const fijo = this.ambitoFijo();
      this.form.reset({
        nombre: a?.nombre ?? '',
        ambito: fijo ?? a?.ambito ?? 'contacto',
        asunto: a?.asunto ?? '',
        cuerpo: a?.cuerpo ?? '',
        docTemplateId: a?.docTemplateId ?? '',
        hitoPlantillaId: a?.hitoPlantillaId ?? '',
        activa: a?.activa ?? true,
      });
      this.canalesSel.set(a?.canales ? [...a.canales] : []);
      this.formValido.set(this.form.valid);
      this.sincronizarTextos();
    });
  }

  private sincronizarTextos(): void {
    const { asunto, cuerpo } = this.form.getRawValue();
    this.textos.set({ asunto, cuerpo });
  }

  /** Sustituye asunto y cuerpo por lo redactado; un asunto vacío no pisa el actual. */
  aplicarRedaccion(t: TextoRedactado): void {
    const c = this.form.controls;
    c.asunto.setValue(t.asunto || c.asunto.value);
    c.cuerpo.setValue(t.cuerpo);
    c.asunto.markAsDirty();
    c.cuerpo.markAsDirty();
  }

  registrarFoco(campo: CampoTexto): void {
    this.campoActivo.set(campo);
  }

  toggleCanal(canal: Canal): void {
    this.canalesSel.update((l) => (l.includes(canal) ? l.filter((c) => c !== canal) : [...l, canal]));
  }

  insertarVariable(key: string): void {
    const campo = this.campoActivo();
    const control = this.form.controls[campo];
    const host = (this.hostEl.nativeElement as HTMLElement).querySelector<HTMLInputElement | HTMLTextAreaElement>(
      campo === 'asunto' ? '#af-asunto' : '#af-cuerpo',
    );
    const { texto, cursor } = insertarVariable(
      control.value, key, host?.selectionStart ?? null, host?.selectionEnd ?? null,
    );
    control.setValue(texto);
    control.markAsDirty();
    if (host) {
      host.value = texto;
      host.focus();
      host.setSelectionRange(cursor, cursor);
    }
  }

  guardar(): void {
    if (!this.puedeGuardar()) return;
    const v = this.form.getRawValue();
    const previa = this.accion();
    const fijo = this.ambitoFijo();
    const plantilla = this.plantillaId();
    // En edición, '' (no undefined) para poder BORRAR el campo: el servicio
    // elimina los `undefined` antes de escribir y el valor viejo se quedaría.
    const opcional = (valor: string, antes: string | undefined) => valor || (antes ? '' : undefined);
    const doc = opcional(v.docTemplateId, previa?.docTemplateId);
    const hito = opcional(v.hitoPlantillaId, previa?.hitoPlantillaId);
    this.saved.emit({
      nombre: v.nombre.trim(),
      ambito: fijo ?? v.ambito,
      asunto: v.asunto.trim(),
      cuerpo: v.cuerpo,
      canales: this.canalesSel(),
      activa: v.activa,
      ...(doc !== undefined ? { docTemplateId: doc } : {}),
      ...(plantilla ? { plantillaId: plantilla } : {}),
      ...(hito !== undefined && plantilla ? { hitoPlantillaId: hito } : {}),
    });
  }

  private readonly hostEl = inject(ElementRef);
}
