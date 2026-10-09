import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { AuthService } from '../../auth/auth.service';
import { AutoservicioService, type DatosAlta } from '../../core/autoservicio/autoservicio.service';
import type { ProgresoSeed } from '../../core/services/demo-seed.service';
import { opcionesZona, zonaDelNavegador } from '../../core/planes/zonas';
import { CA_LABELS, type ComunidadAutonoma, type TipoPersona } from '../../interfaces/company';

type Fase = 'formulario' | 'trabajando' | 'avisoDemo';

const COMUNIDADES = (Object.entries(CA_LABELS) as [ComunidadAutonoma, string][])
  .map(([valor, etiqueta]) => ({ valor, etiqueta }))
  .sort((a, b) => a.etiqueta.localeCompare(b.etiqueta, 'es'));

/**
 * Asistente de alta para quien no pertenece a ningún despacho. Crea el despacho real
 * (callable `crearEmpresaAutoservicio`) y, si se marca, un despacho de ejemplo aparte.
 */
@Component({
  selector: 'app-bienvenida',
  imports: [ReactiveFormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main class="mx-auto flex min-h-screen w-full max-w-xl flex-col justify-center gap-6 px-4 py-10"
      style="background:var(--surface-0, transparent);color:var(--text-body)">
      <header>
        <h1 class="text-2xl font-semibold" style="color:var(--text-strong)">Bienvenido a Vertey</h1>
        <p class="mt-1 text-sm">
          Cuéntanos sobre tu despacho. Empiezas con 14 días con todo desbloqueado y después pasas al plan gratuito.
        </p>
      </header>

      @if (!verificada()) {
        <section data-testid="aviso-verificacion" role="status"
          class="rounded-xl border p-4 text-sm" style="border-color:var(--border);background:var(--surface-2)">
          <p style="color:var(--text-strong)">
            Te enviamos un correo para verificar tu email. Pulsa el enlace y vuelve aquí para crear tu despacho.
          </p>
          <div class="mt-3 flex flex-wrap gap-2">
            <button type="button" data-testid="reenviar" (click)="reenviar()" [disabled]="reenviado()"
              class="tap-target rounded-lg border px-3 py-1.5 text-sm font-medium" style="border-color:var(--border);color:var(--text-strong)">
              {{ reenviado() ? 'Correo reenviado' : 'Reenviar correo' }}
            </button>
          </div>
        </section>
      }

      @switch (fase()) {
        @case ('trabajando') {
          <section role="status" aria-live="polite" class="rounded-xl border p-5" style="border-color:var(--border)">
            <p class="text-sm font-medium" style="color:var(--text-strong)">{{ paso() }}</p>
            @if (porcentaje() !== null) {
              <progress class="mt-3 h-2 w-full" max="100" [value]="porcentaje()" [attr.aria-label]="paso()"></progress>
            }
          </section>
        }
        @case ('avisoDemo') {
          <section data-testid="aviso-demo" role="status" class="rounded-xl border p-5" style="border-color:var(--border)">
            <p class="text-sm" style="color:var(--text-strong)">
              Tu despacho está listo, pero no pudimos preparar el despacho de ejemplo. Puedes seguir y pedirlo más adelante.
            </p>
            <button type="button" (click)="continuar()"
              class="tap-target mt-4 rounded-lg px-4 py-2 text-sm font-semibold"
              style="background:var(--brand);color:var(--brand-contrast, #fff)">
              Entrar a mi despacho
            </button>
          </section>
        }
        @default {
          <form [formGroup]="form" (ngSubmit)="enviar()" novalidate class="flex flex-col gap-5">
            <div class="flex flex-col gap-1.5">
              <label for="bv-nombre" class="text-sm font-medium" style="color:var(--text-strong)">Nombre del despacho</label>
              <input id="bv-nombre" type="text" formControlName="nombre" autocomplete="organization"
                aria-describedby="bv-nombre-error"
                class="rounded-lg border px-3 py-2 text-sm" style="border-color:var(--border);background:var(--surface-1, transparent);color:var(--text-strong)" />
              @if (invalido('nombre')) {
                <span id="bv-nombre-error" class="text-sm" style="color:var(--danger-text, #b91c1c)" role="alert">
                  Indica el nombre del despacho (mínimo 2 caracteres).
                </span>
              }
            </div>

            <fieldset class="flex flex-col gap-2" aria-describedby="bv-tipo-error">
              <legend class="text-sm font-medium" style="color:var(--text-strong)">Tipo de persona</legend>
              <label class="flex items-center gap-2 text-sm">
                <input type="radio" formControlName="tipoPersona" value="fisica" /> Persona física (autónomo)
              </label>
              <label class="flex items-center gap-2 text-sm">
                <input type="radio" formControlName="tipoPersona" value="juridica" /> Persona jurídica (sociedad)
              </label>
              @if (invalido('tipoPersona')) {
                <span id="bv-tipo-error" class="text-sm" style="color:var(--danger-text, #b91c1c)" role="alert">
                  Elige el tipo de persona.
                </span>
              }
            </fieldset>

            <div class="flex flex-col gap-1.5">
              <label for="bv-ca" class="text-sm font-medium" style="color:var(--text-strong)">Comunidad autónoma</label>
              <select id="bv-ca" formControlName="ca" aria-describedby="bv-ca-error"
                class="rounded-lg border px-3 py-2 text-sm" style="border-color:var(--border);background:var(--surface-1, transparent);color:var(--text-strong)">
                <option value="" disabled>Selecciona…</option>
                @for (c of comunidades; track c.valor) {
                  <option [value]="c.valor">{{ c.etiqueta }}</option>
                }
              </select>
              @if (invalido('ca')) {
                <span id="bv-ca-error" class="text-sm" style="color:var(--danger-text, #b91c1c)" role="alert">
                  Selecciona tu comunidad autónoma.
                </span>
              }
            </div>

            <div class="flex flex-col gap-1.5">
              <label for="bv-zona" class="text-sm font-medium" style="color:var(--text-strong)">Zona horaria</label>
              <select id="bv-zona" formControlName="zonaHoraria" aria-describedby="bv-zona-ayuda"
                class="rounded-lg border px-3 py-2 text-sm" style="border-color:var(--border);background:var(--surface-1, transparent);color:var(--text-strong)">
                @for (z of zonas; track z.valor) {
                  <option [value]="z.valor">{{ z.etiqueta }}</option>
                }
              </select>
              <span id="bv-zona-ayuda" class="text-xs" style="color:var(--text-muted)">
                Define cuándo empieza cada mes para los cupos de tu plan. Puedes cambiarla después en Configuración.
              </span>
            </div>

            <div class="flex flex-col gap-1.5">
              <label for="bv-especialidad" class="text-sm font-medium" style="color:var(--text-strong)">
                Especialidad <span class="font-normal">(opcional)</span>
              </label>
              <input id="bv-especialidad" type="text" formControlName="especialidad" maxlength="80"
                class="rounded-lg border px-3 py-2 text-sm" style="border-color:var(--border);background:var(--surface-1, transparent);color:var(--text-strong)" />
            </div>

            <label class="flex items-start gap-2 text-sm">
              <input id="bv-ejemplo" type="checkbox" formControlName="ejemplo" class="mt-0.5" />
              <span>Crear también un despacho de ejemplo para explorar (con datos ficticios, sin envíos reales).</span>
            </label>

            @if (error()) {
              <div class="bv-error rounded-lg border p-3 text-sm" role="alert"
                style="border-color:var(--danger-text, #b91c1c);color:var(--danger-text, #b91c1c)">{{ error() }}</div>
            }

            <div class="flex flex-wrap items-center gap-3">
              <button type="submit"
                class="tap-target rounded-lg px-4 py-2 text-sm font-semibold"
                style="background:var(--brand);color:var(--brand-contrast, #fff)">
                Crear mi despacho
              </button>
              <button type="button" (click)="cerrarSesion()" class="tap-target text-sm underline" style="color:var(--text-body)">
                Cerrar sesión
              </button>
            </div>
          </form>
        }
      }
    </main>
  `,
})
export class BienvenidaComponent {
  private readonly fb = inject(FormBuilder);
  private readonly autoservicio = inject(AutoservicioService);
  private readonly auth = inject(AuthService);

  protected readonly comunidades = COMUNIDADES;
  private readonly zonaInicial = zonaDelNavegador();
  protected readonly zonas = opcionesZona(this.zonaInicial);

  protected readonly form = this.fb.group({
    nombre: this.fb.nonNullable.control('', [Validators.required, Validators.minLength(2), Validators.maxLength(120)]),
    tipoPersona: this.fb.control<TipoPersona | null>(null, Validators.required),
    ca: this.fb.nonNullable.control('', Validators.required),
    zonaHoraria: this.fb.nonNullable.control(this.zonaInicial, Validators.required),
    especialidad: this.fb.nonNullable.control('', Validators.maxLength(80)),
    ejemplo: this.fb.nonNullable.control(true),
  });

  protected readonly verificada = signal(this.autoservicio.verificada());
  protected readonly reenviado = signal(false);
  protected readonly fase = signal<Fase>('formulario');
  protected readonly paso = signal('');
  private readonly progreso = signal<ProgresoSeed | null>(null);
  protected readonly error = signal('');
  private companyId = '';

  protected readonly porcentaje = computed(() => {
    const p = this.progreso();
    return p && p.total > 0 ? Math.round((p.hechos / p.total) * 100) : null;
  });

  // Método y no computed(): el estado del form no es un signal (ver login.ts).
  protected invalido(campo: 'nombre' | 'tipoPersona' | 'ca'): boolean {
    const control = this.form.controls[campo];
    return control.invalid && control.touched;
  }

  protected async reenviar(): Promise<void> {
    try {
      await this.autoservicio.reenviarVerificacion();
      this.reenviado.set(true);
    } catch {
      this.error.set('No se pudo reenviar el correo. Inténtalo de nuevo en unos minutos.');
    }
  }

  protected async enviar(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.error.set('');

    try {
      if (!this.verificada()) {
        this.verificada.set(await this.autoservicio.comprobarVerificacion());
        if (!this.verificada()) {
          this.error.set('Verifica tu correo electrónico antes de crear tu despacho. Revisa tu bandeja de entrada.');
          return;
        }
      }

      this.fase.set('trabajando');
      this.paso.set('Creando tu despacho…');
      const v = this.form.getRawValue();
      const especialidad = v.especialidad.trim();
      const datos: DatosAlta = {
        nombre: v.nombre.trim(),
        tipoPersona: v.tipoPersona!,
        ca: v.ca as ComunidadAutonoma,
        zonaHoraria: v.zonaHoraria,
        ...(especialidad ? { especialidad } : {}),
      };
      this.companyId = await this.autoservicio.crearEmpresa(datos);
    } catch (err) {
      this.fase.set('formulario');
      this.error.set(err instanceof Error ? err.message : 'No se pudo completar el alta.');
      return;
    }

    if (this.form.controls.ejemplo.value) {
      try {
        this.paso.set('Preparando el despacho de ejemplo…');
        const demoId = await this.autoservicio.crearDemo(this.form.controls.nombre.value.trim(), this.form.controls.zonaHoraria.value);
        await this.autoservicio.sembrarDemo(demoId, (p) => {
          this.progreso.set(p);
          this.paso.set(`Despacho de ejemplo: ${p.paso}`);
        });
      } catch (err) {
        console.error('[bienvenida] despacho de ejemplo', err);
        this.fase.set('avisoDemo');
        return;
      }
    }

    this.autoservicio.entrar(this.companyId);
  }

  protected continuar(): void {
    this.autoservicio.entrar(this.companyId);
  }

  protected cerrarSesion(): void {
    void this.auth.logout();
  }
}
