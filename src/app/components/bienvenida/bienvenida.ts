import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { AuthService } from '../../auth/auth.service';
import { AuthShellComponent } from '../../auth/auth-shell/auth-shell';
import { AutoservicioService, type DatosAlta } from '../../core/autoservicio/autoservicio.service';
import type { ProgresoSeed } from '../../core/services/demo-seed.service';
import { PAISES, paisDesdeZona, paisPorCodigo, regionDesdeNombre, zonaSugerida, type CodigoPais } from '../../core/paises/catalogo-paises';
import { opcionesZona, zonaDelNavegador } from '../../core/planes/zonas';
import type { CiudadElegida } from '../../core/ubicacion/places.service';
import { CiudadComboboxComponent } from '../../shared/components/ciudad-combobox/ciudad-combobox';
import type { TipoPersona, UbicacionEmpresa } from '../../interfaces/company';

type Fase = 'formulario' | 'trabajando' | 'avisoDemo';

const ESPECIALIDADES = [
  'Civil', 'Penal', 'Laboral', 'Mercantil', 'Familia', 'Administrativo', 'Fiscal', 'Sucesiones', 'Seguros',
] as const;

/**
 * Asistente de alta para quien no pertenece a ningún despacho. Crea el despacho real
 * (callable `crearEmpresaAutoservicio`) y, si se marca, un despacho de ejemplo aparte.
 */
@Component({
  selector: 'app-bienvenida',
  imports: [ReactiveFormsModule, AuthShellComponent, CiudadComboboxComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-auth-shell>
      <header class="auth-header">
        <p class="auth-eyebrow">Configura tu despacho</p>
        <h1>Bienvenido a Vertey</h1>
        <p>Cuéntanos sobre tu despacho. Solo tardarás un minuto.</p>
      </header>

      @if (!verificada()) {
        <section data-testid="aviso-verificacion" role="status" class="auth-notice">
          <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/></svg>
          <div>
            <p>
              <strong>Verifica tu email.</strong> Te enviamos un enlace a
              <strong>{{ email() || 'tu correo' }}</strong>. Púlsalo y vuelve aquí para crear tu despacho.
            </p>
            <div class="auth-notice-actions">
              <button type="button" data-testid="reenviar" (click)="reenviar()" [disabled]="reenviado()" class="auth-btn-secondary">
                {{ reenviado() ? 'Correo reenviado' : 'Reenviar correo' }}
              </button>
              <span>¿No lo ves? Revisa spam o promociones.</span>
            </div>
          </div>
        </section>
      }

      @switch (fase()) {
        @case ('trabajando') {
          <section role="status" aria-live="polite" class="auth-card">
            <p class="font-semibold">{{ paso() }}</p>
            @if (porcentaje() !== null) {
              <progress max="100" [value]="porcentaje()" [attr.aria-label]="paso()"></progress>
            }
          </section>
        }
        @case ('avisoDemo') {
          <section data-testid="aviso-demo" role="status" class="auth-card flex flex-col gap-4">
            <p>
              Tu despacho está listo, pero no pudimos preparar el despacho de ejemplo. Puedes seguir y pedirlo más adelante.
            </p>
            <button type="button" (click)="continuar()" class="auth-btn-primary">
              Entrar a mi despacho
            </button>
          </section>
        }
        @default {
          <form [formGroup]="form" (ngSubmit)="enviar()" novalidate class="auth-form">
            <div class="auth-field">
              <label for="bv-nombre" class="auth-label">Nombre del despacho</label>
              <input id="bv-nombre" type="text" formControlName="nombre" autocomplete="organization"
                placeholder="Ej. García & Asociados Abogados" class="auth-input"
                aria-describedby="bv-nombre-ayuda bv-nombre-error" />
              @if (invalido('nombre')) {
                <span id="bv-nombre-error" class="auth-field-error" role="alert">
                  Indica el nombre del despacho (mínimo 2 caracteres).
                </span>
              } @else {
                <span id="bv-nombre-ayuda" class="auth-hint">Aparecerá en tus facturas y comunicaciones.</span>
              }
            </div>

            <fieldset class="auth-field" aria-describedby="bv-tipo-error">
              <legend class="auth-label mb-2">Tipo de persona</legend>
              <div class="auth-options">
                <label class="auth-option">
                  <input type="radio" formControlName="tipoPersona" value="fisica" />
                  <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></svg>
                  <strong>Persona física</strong>
                  <span>Abogado autónomo</span>
                </label>
                <label class="auth-option">
                  <input type="radio" formControlName="tipoPersona" value="juridica" />
                  <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 21h18M5 21V9l7-5 7 5v12"/><path d="M10 21v-6h4v6"/></svg>
                  <strong>Persona jurídica</strong>
                  <span>Sociedad o despacho colectivo</span>
                </label>
              </div>
              @if (invalido('tipoPersona')) {
                <span id="bv-tipo-error" class="auth-field-error" role="alert">
                  Elige el tipo de persona.
                </span>
              }
            </fieldset>

            <div class="auth-field">
              <label for="bv-pais" class="auth-label">País</label>
              <select id="bv-pais" formControlName="pais" aria-describedby="bv-pais-ayuda" class="auth-input">
                @for (p of paises; track p.codigo) {
                  <option [value]="p.codigo">{{ p.nombre }}</option>
                }
              </select>
              @if (paisDetectado() === pais()) {
                <span id="bv-pais-ayuda" class="auth-hint" data-testid="aviso-pais">
                  Detectamos que estás en {{ paisActual().nombre }}. ¿No es así? Cámbialo.
                </span>
              }
            </div>

            <div class="auth-row">
              <div class="auth-field">
                <label for="bv-ciudad" class="auth-label">Ciudad <span class="auth-optional">(opcional)</span></label>
                <app-ciudad-combobox inputId="bv-ciudad" inputClass="auth-input" [pais]="pais()"
                  [valor]="ciudad()" (textoCambiado)="alEscribirCiudad($event)" (elegida)="alElegirCiudad($event)" />
              </div>

              <div class="auth-field">
                <label for="bv-region" class="auth-label">{{ paisActual().etiquetaRegion }}</label>
                <select id="bv-region" formControlName="region" aria-describedby="bv-region-error" class="auth-input">
                  <option value="" disabled>Selecciona…</option>
                  @for (r of paisActual().regiones; track r.codigo) {
                    <option [value]="r.codigo">{{ r.nombre }}</option>
                  }
                </select>
                @if (invalido('region')) {
                  <span id="bv-region-error" class="auth-field-error" role="alert">
                    Selecciona tu {{ paisActual().etiquetaRegion.toLowerCase() }}.
                  </span>
                }
              </div>
            </div>

            <div class="flex flex-col gap-2">
              <div class="auth-row">
                <div class="auth-field">
                  <label for="bv-zona" class="auth-label">Zona horaria</label>
                  <select id="bv-zona" formControlName="zonaHoraria" aria-describedby="bv-zona-ayuda" class="auth-input">
                    @for (z of zonas(); track z.valor) {
                      <option [value]="z.valor">{{ z.etiqueta }}</option>
                    }
                  </select>
                </div>

                <div class="auth-field">
                  <label for="bv-moneda" class="auth-label">Moneda</label>
                  <select id="bv-moneda" formControlName="moneda" aria-describedby="bv-moneda-ayuda" class="auth-input">
                    @for (m of paisActual().monedasPermitidas; track m) {
                      <option [value]="m">{{ m }}</option>
                    }
                  </select>
                </div>
              </div>
              <span id="bv-zona-ayuda" class="auth-hint">
                La zona horaria marca cuándo empieza cada mes para los cupos de tu plan. Puedes cambiarla en Configuración.
              </span>
              <span id="bv-moneda-ayuda" class="auth-hint">No podrás cambiarla después del alta.</span>
            </div>

            <div class="auth-field">
              <span id="bv-especialidad" class="auth-label">
                Especialidad <span class="auth-optional">(opcional)</span>
              </span>
              <div class="auth-chips" role="group" aria-labelledby="bv-especialidad">
                @for (e of especialidadesDisponibles; track e) {
                  <button type="button" class="auth-chip" [attr.aria-pressed]="especialidades().includes(e)"
                    (click)="alternarEspecialidad(e)">{{ e }}</button>
                }
              </div>
            </div>

            <label class="auth-check">
              <input id="bv-ejemplo" type="checkbox" formControlName="ejemplo" />
              <span>
                <strong>Crear también un despacho de ejemplo</strong>
                <span>Con datos ficticios para explorar Vertey. No se envía nada real.</span>
              </span>
            </label>

            @if (error()) {
              <div class="bv-error" role="alert">{{ error() }}</div>
            }

            <button type="submit" class="auth-btn-primary">
              Crear mi despacho
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>
            </button>

            <p class="auth-footer">
              ¿No es tu cuenta?
              <button type="button" (click)="cerrarSesion()" class="btn-link">Cerrar sesión</button>
            </p>
          </form>
        }
      }
    </app-auth-shell>
  `,
})
export class BienvenidaComponent {
  private readonly fb = inject(FormBuilder);
  private readonly autoservicio = inject(AutoservicioService);
  private readonly auth = inject(AuthService);

  protected readonly paises = PAISES;
  protected readonly especialidadesDisponibles = ESPECIALIDADES;
  protected readonly especialidades = signal<string[]>([]);
  protected readonly email = computed(() => this.auth.user()?.email ?? '');

  protected readonly form = this.fb.group({
    nombre: this.fb.nonNullable.control('', [Validators.required, Validators.minLength(2), Validators.maxLength(120)]),
    tipoPersona: this.fb.control<TipoPersona | null>(null, Validators.required),
    pais: this.fb.nonNullable.control<CodigoPais>('ES'),
    // España: slug de la comunidad autónoma. Resto: ISO 3166-2.
    region: this.fb.nonNullable.control('', Validators.required),
    zonaHoraria: this.fb.nonNullable.control(zonaSugerida('ES'), Validators.required),
    moneda: this.fb.nonNullable.control(paisPorCodigo('ES').moneda, Validators.required),
    ejemplo: this.fb.nonNullable.control(true),
  });

  protected readonly pais = toSignal(this.form.controls.pais.valueChanges, { initialValue: this.form.controls.pais.value });
  private readonly zonaActual = toSignal(this.form.controls.zonaHoraria.valueChanges, { initialValue: this.form.controls.zonaHoraria.value });
  protected readonly paisActual = computed(() => paisPorCodigo(this.pais()));
  protected readonly zonas = computed(() => opcionesZona(this.zonaActual()));

  protected readonly ciudad = signal('');
  /** Solo vale mientras el texto de la ciudad sea el que Google resolvió. */
  private readonly ubicacion = signal<UbicacionEmpresa | null>(null);
  /** País que sugerimos (IP o zona horaria); el aviso solo se muestra mientras siga elegido. */
  protected readonly paisDetectado = signal<CodigoPais | null>(null);

  protected readonly verificada = signal(this.autoservicio.verificada());
  protected readonly reenviado = signal(false);
  protected readonly fase = signal<Fase>('formulario');
  protected readonly paso = signal('');
  private readonly progreso = signal<ProgresoSeed | null>(null);
  protected readonly error = signal('');
  private companyId = '';

  constructor() {
    this.form.controls.pais.valueChanges.subscribe((p) => this.reiniciarPorPais(p));
    this.form.controls.region.valueChanges.subscribe((r) => this.ajustarZona(r));
    void this.detectarPais();
  }

  /** Al cambiar de país nada de lo anterior vale: ciudad, región, zona y moneda vuelven a los del país. */
  private reiniciarPorPais(pais: CodigoPais): void {
    const { moneda } = paisPorCodigo(pais);
    this.ciudad.set('');
    this.ubicacion.set(null);
    this.form.controls.region.reset('', { emitEvent: false });
    this.form.controls.zonaHoraria.reset(zonaSugerida(pais));
    this.form.patchValue({ moneda });
  }

  /** La zona sigue a la región (Quintana Roo -> Cancún) mientras el usuario no la haya tocado a mano. */
  private ajustarZona(region: string): void {
    const zona = this.form.controls.zonaHoraria;
    if (zona.dirty) return;
    zona.setValue(zonaSugerida(this.pais(), region));
  }

  /** Servidor (IP) -> zona del navegador -> España. Es solo una pista: nunca bloquea ni pisa lo ya elegido. */
  private async detectarPais(): Promise<void> {
    let sugerido: CodigoPais | null | undefined;
    try {
      sugerido = (await this.autoservicio.sugerirPais()) ?? paisDesdeZona(zonaDelNavegador());
    } catch {
      sugerido = paisDesdeZona(zonaDelNavegador());
    }
    if (!sugerido) return;
    const c = this.form.controls;
    // Si ya tocó algo, la detección no debe borrarle el trabajo.
    if (c.pais.dirty || c.region.value || this.ciudad()) return;
    this.paisDetectado.set(sugerido);
    c.pais.setValue(sugerido);
  }

  protected alEscribirCiudad(texto: string): void {
    this.ciudad.set(texto);
    this.ubicacion.set(null);
  }

  protected alElegirCiudad(c: CiudadElegida): void {
    this.ciudad.set(c.nombre);
    this.ubicacion.set(c.lat !== undefined && c.lng !== undefined ? { placeId: c.placeId, lat: c.lat, lng: c.lng } : null);
    // La región guardada sale siempre del catálogo, nunca del texto de Places.
    const region = regionDesdeNombre(this.pais(), c.regionNombre);
    if (region) this.form.controls.region.setValue(region);
  }

  protected readonly porcentaje = computed(() => {
    const p = this.progreso();
    return p && p.total > 0 ? Math.round((p.hechos / p.total) * 100) : null;
  });

  // Método y no computed(): el estado del form no es un signal (ver login.ts).
  protected invalido(campo: 'nombre' | 'tipoPersona' | 'region'): boolean {
    const control = this.form.controls[campo];
    return control.invalid && control.touched;
  }

  protected alternarEspecialidad(e: string): void {
    this.especialidades.update((sel) => {
      const nueva = sel.includes(e) ? sel.filter((x) => x !== e) : [...sel, e];
      // Orden del catálogo, no el del clic: el texto guardado es estable.
      return ESPECIALIDADES.filter((x) => nueva.includes(x));
    });
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
      const especialidad = this.especialidades().join(', ');
      const ciudad = this.ciudad().trim();
      const ubicacion = this.ubicacion();
      const datos: DatosAlta = {
        nombre: v.nombre.trim(),
        tipoPersona: v.tipoPersona!,
        pais: v.pais,
        region: v.region,
        moneda: v.moneda,
        zonaHoraria: v.zonaHoraria,
        ...(ciudad ? { ciudad } : {}),
        ...(ciudad && ubicacion ? { ubicacion } : {}),
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
        const { pais, moneda, zonaHoraria } = this.form.getRawValue();
        const demoId = await this.autoservicio.crearDemo(this.form.controls.nombre.value.trim(), { pais, moneda, zonaHoraria });
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
