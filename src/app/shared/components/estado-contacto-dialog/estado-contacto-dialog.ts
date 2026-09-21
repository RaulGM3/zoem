import {
  Component, ChangeDetectionStrategy, OnInit, inject, input, output, signal, computed,
  viewChildren, ElementRef,
} from '@angular/core';
import { ReactiveFormsModule, FormBuilder } from '@angular/forms';
import { LucideAngularModule, X, CalendarClock, ArrowLeft } from 'lucide-angular';

import { FocusTrapDirective } from '../../directives/focus-trap.directive';
import { PermissionService } from '../../../core/services/permission.service';
import { UsersService } from '../../../core/services/users';
import {
  CONTACT_STATUS_OPTIONS, getContactStatusStyle, getContactDisplayName,
  type Contact, type ContactStatus,
} from '../../../interfaces/contact.interface';
import {
  SEGUIMIENTO_SUGERENCIAS, fechaLimiteSugerida, type SeguimientoDraft,
} from '../../../core/contactos/seguimiento';

export interface CambioEstadoResult {
  status: ContactStatus;
  /** Ausente si el usuario omitió el compromiso. */
  seguimiento?: SeguimientoDraft;
}

/** Plazo por defecto cuando el estado destino no tiene sugerencia propia. */
const DIAS_PLAZO_FALLBACK = 7;

/**
 * Diálogo de cambio rápido de estado de un contacto.
 *
 * Paso 1: radiogroup con todos los estados.
 * Paso 2 (nudge, omitible): el compromiso que hace avanzar al contacto —
 * qué se entrega, hasta cuándo y quién responde. Quien lo consume decide
 * si persistirlo; aquí sólo se emite.
 */
@Component({
  selector: 'app-estado-contacto-dialog',
  imports: [LucideAngularModule, FocusTrapDirective, ReactiveFormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'fixed inset-0 z-50 flex items-center justify-center p-4',
    style: 'background:rgba(15,23,41,0.45)',
    '(click)': 'closed.emit()',
  },
  template: `
    <div
      class="w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden"
      style="background:var(--surface);border:1px solid var(--border)"
      (click)="$event.stopPropagation()"
      role="dialog"
      aria-modal="true"
      aria-labelledby="estado-contacto-dialog-title"
      appFocusTrap
      (escapeKey)="closed.emit()"
    >
      <div class="flex items-center justify-between px-5 py-4" style="border-bottom:1px solid var(--border)">
        <div class="min-w-0">
          <h2 id="estado-contacto-dialog-title" class="text-base font-semibold truncate"
            style="color:var(--text-strong);font-family:var(--font-display)">
            {{ paso() === 'estado' ? 'Cambiar estado' : 'Próximo paso' }}
          </h2>
          <p class="text-xs truncate" style="color:var(--text-faint)">{{ nombreContacto() }}</p>
        </div>
        <button type="button" (click)="closed.emit()"
          class="rounded-xl p-1.5 shrink-0 transition-colors duration-150"
          style="color:var(--text-muted)"
          (mouseenter)="$any($event.currentTarget).style.background='var(--surface-2)'"
          (mouseleave)="$any($event.currentTarget).style.background=''"
          aria-label="Cerrar">
          <lucide-icon [img]="XIcon" size="18"></lucide-icon>
        </button>
      </div>

      @if (paso() === 'estado') {
        <div class="px-5 py-4">
          <div role="radiogroup" aria-labelledby="estado-contacto-dialog-title"
            class="grid gap-2 sm:grid-cols-2"
            (keydown)="onRadioKeydown($event)">
            @for (opt of opciones; track opt.value; let i = $index) {
              <button #radio type="button" role="radio"
                [attr.aria-checked]="seleccionado() === opt.value"
                [attr.tabindex]="seleccionado() === opt.value ? 0 : -1"
                (click)="elegirEstado(opt.value)"
                class="flex items-center gap-2 rounded-xl px-3 py-2.5 text-left text-sm font-semibold transition-all duration-150"
                [style.background]="estiloDe(opt.value).background"
                [style.color]="estiloDe(opt.value).color"
                [style.border]="seleccionado() === opt.value
                  ? '2px solid ' + estiloDe(opt.value).color
                  : '1px solid var(--border)'">
                <span class="truncate">{{ opt.label }}</span>
                @if (opt.value === estadoActual()) {
                  <span class="ml-auto shrink-0 text-[10px] font-bold uppercase tracking-wider opacity-70">Actual</span>
                }
              </button>
            }
          </div>
        </div>
      } @else {
        <form [formGroup]="form" class="px-5 py-4 space-y-4">
          <div class="flex items-start gap-2.5 rounded-xl p-3"
            style="background:color-mix(in srgb,var(--brand) 8%,transparent)">
            <lucide-icon [img]="CalendarClockIcon" size="16" class="shrink-0 mt-0.5" style="color:var(--brand)"></lucide-icon>
            <p class="text-xs" style="color:var(--text-body)">
              {{ nombreContacto() }} pasa a <strong>{{ labelDestino() }}</strong>.
              ¿Qué tiene que entregar el despacho y para cuándo, para que avance?
            </p>
          </div>

          <div>
            <label for="entregable" class="form-label">Qué hay que entregar *</label>
            <input id="entregable" formControlName="entregable" type="text" class="form-input"
              placeholder="Ej. Enviar propuesta de honorarios" />
          </div>

          <div class="grid grid-cols-2 gap-4">
            <div>
              <label for="fechaLimite" class="form-label">Fecha límite *</label>
              <input id="fechaLimite" formControlName="fechaLimite" type="date" class="form-input" />
            </div>
            <div>
              <label for="responsableId" class="form-label">Responsable</label>
              <select id="responsableId" formControlName="responsableId" class="form-select">
                @for (m of miembros(); track m.userId) {
                  <option [value]="m.userId">{{ m.nombre }}{{ m.apellido ? ' ' + m.apellido : '' }}</option>
                }
              </select>
            </div>
          </div>

          <p class="text-xs" style="color:var(--text-faint)">
            Se creará un evento en el calendario del responsable y aparecerá en su panel.
          </p>
        </form>
      }

      <div class="flex gap-3 px-5 py-4" style="border-top:1px solid var(--border)">
        @if (paso() === 'seguimiento') {
          @if (!soloSeguimiento()) {
            <button type="button" (click)="volverAEstado()"
              class="rounded-xl px-3 py-2.5 text-sm font-medium flex items-center gap-1 transition-colors duration-150"
              style="border:1px solid var(--border);color:var(--text-body);background:var(--surface-2)">
              <lucide-icon [img]="ArrowLeftIcon" size="15"></lucide-icon>
              Atrás
            </button>
          }
          <button type="button" (click)="omitir()"
            class="flex-1 rounded-xl py-2.5 text-sm font-medium transition-colors duration-150"
            style="border:1px solid var(--border);color:var(--text-body);background:var(--surface-2)">
            Omitir
          </button>
          <button type="button" (click)="guardarConSeguimiento()" [disabled]="!puedeGuardar()"
            class="flex-1 rounded-xl py-2.5 text-sm font-semibold text-white disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-150"
            style="background:var(--brand)">
            Guardar y programar
          </button>
        } @else {
          <button type="button" (click)="closed.emit()"
            class="flex-1 rounded-xl py-2.5 text-sm font-medium transition-colors duration-150"
            style="border:1px solid var(--border);color:var(--text-body);background:var(--surface-2)">
            Cancelar
          </button>
        }
      </div>
    </div>
  `,
})
export class EstadoContactoDialogComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly perm = inject(PermissionService);
  private readonly usersService = inject(UsersService);

  readonly contacto = input.required<Contact>();
  /** Alta de contacto: el estado ya está fijado, sólo se pide el compromiso. */
  readonly soloSeguimiento = input(false);

  readonly closed = output<void>();
  readonly saved = output<CambioEstadoResult>();

  readonly XIcon = X;
  readonly CalendarClockIcon = CalendarClock;
  readonly ArrowLeftIcon = ArrowLeft;

  readonly opciones = CONTACT_STATUS_OPTIONS;
  readonly miembros = this.usersService.members;

  private readonly radios = viewChildren<ElementRef<HTMLElement>>('radio');

  readonly paso = signal<'estado' | 'seguimiento'>('estado');
  /** Estado enfocado/marcado en el radiogroup. */
  readonly seleccionado = signal<ContactStatus | null>(null);
  /** Estado ya confirmado, pendiente de emitir junto al compromiso. */
  private readonly destino = signal<ContactStatus | null>(null);

  readonly form = this.fb.nonNullable.group({
    entregable: '',
    fechaLimite: '',
    responsableId: '',
  });

  readonly estadoActual = computed(() => this.contacto().status);
  readonly nombreContacto = computed(() => getContactDisplayName(this.contacto()));
  readonly labelDestino = computed(() => {
    const d = this.destino();
    return this.opciones.find(o => o.value === d)?.label ?? '';
  });

  ngOnInit(): void {
    this.seleccionado.set(this.estadoActual());
    if (this.soloSeguimiento()) {
      this.destino.set(this.estadoActual());
      this.prefill(this.estadoActual());
      this.paso.set('seguimiento');
    }
  }

  estiloDe(status: ContactStatus): { background: string; color: string } {
    return getContactStatusStyle(status);
  }

  puedeGuardar(): boolean {
    const { entregable, fechaLimite } = this.form.getRawValue();
    return entregable.trim().length > 0 && fechaLimite.length > 0;
  }

  elegirEstado(status: ContactStatus): void {
    this.seleccionado.set(status);

    // Reabrir el mismo estado no es un cambio: no hay nada que comprometer.
    if (status === this.estadoActual()) {
      this.closed.emit();
      return;
    }

    this.destino.set(status);

    // Sin permiso para crear en Calendario no se puede programar el compromiso.
    if (!this.perm.can('Calendario', 'crear')) {
      this.saved.emit({ status });
      return;
    }

    this.prefill(status);
    this.paso.set('seguimiento');
  }

  volverAEstado(): void {
    this.paso.set('estado');
  }

  omitir(): void {
    const status = this.destino();
    if (status) this.saved.emit({ status });
  }

  guardarConSeguimiento(): void {
    const status = this.destino();
    if (!status || !this.puedeGuardar()) return;

    const { entregable, fechaLimite, responsableId } = this.form.getRawValue();
    this.saved.emit({
      status,
      seguimiento: { entregable: entregable.trim(), fechaLimite, responsableId },
    });
  }

  /** Navegación por flechas del radiogroup (WCAG: roving tabindex). */
  onRadioKeydown(event: KeyboardEvent): void {
    const delta = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[event.key];
    if (!delta) return;

    event.preventDefault();
    const items = this.opciones;
    const actual = items.findIndex(o => o.value === this.seleccionado());
    const siguiente = (actual + delta + items.length) % items.length;

    this.seleccionado.set(items[siguiente].value);
    this.radios()[siguiente]?.nativeElement.focus();
  }

  private prefill(destino: ContactStatus): void {
    const sugerencia = SEGUIMIENTO_SUGERENCIAS[destino];
    const hoy = new Date().toISOString().slice(0, 10);

    this.form.setValue({
      entregable: sugerencia?.entregable ?? '',
      fechaLimite: fechaLimiteSugerida(hoy, sugerencia?.diasPlazo ?? DIAS_PLAZO_FALLBACK),
      responsableId: this.contacto().assignedTo ?? this.perm.currentMember()?.userId ?? '',
    });
  }
}
