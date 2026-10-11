import { ChangeDetectionStrategy, Component, DestroyRef, computed, effect, inject, input, linkedSignal, output, signal } from '@angular/core';
import type { CodigoPais } from '../../../core/paises/catalogo-paises';
import { PlacesService, type CiudadElegida, type SugerenciaCiudad } from '../../../core/ubicacion/places.service';

const DEBOUNCE_MS = 300;
const MIN_CARACTERES = 3;
let secuencia = 0;

/**
 * Campo de ciudad con autocompletado de Google Places (patrón ARIA combobox con listbox).
 * Si Places no está disponible (sin clave, bloqueador, error) es un campo de texto libre:
 * el alta nunca depende de Places. El padre pone la `<label for="inputId">`.
 */
@Component({
  selector: 'app-ciudad-combobox',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'relative block' },
  template: `
    <input
      [id]="inputId()"
      type="text"
      role="combobox"
      autocomplete="off"
      [class]="inputClass()"
      [value]="texto()"
      [attr.aria-expanded]="abierto()"
      aria-autocomplete="list"
      [attr.aria-controls]="abierto() ? listaId : null"
      [attr.aria-activedescendant]="idActivo()"
      [attr.aria-describedby]="describedBy() || null"
      [attr.aria-invalid]="invalido() ? 'true' : null"
      [attr.placeholder]="placeholder() || null"
      (input)="alEscribir($any($event.target).value)"
      (keydown)="alTeclear($event)"
      (blur)="cerrar()"
    />
    @if (abierto()) {
      <div class="absolute left-0 right-0 z-20 mt-1 overflow-hidden rounded-md border border-slate-300 bg-white text-slate-900 shadow-lg">
        <ul [id]="listaId" role="listbox" [attr.aria-label]="'Ciudades sugeridas'" class="max-h-56 overflow-auto py-1">
          @for (o of opciones(); track o.placeId; let i = $index) {
            <li
              [id]="idOpcion(i)"
              role="option"
              [attr.aria-selected]="i === activo()"
              class="cursor-pointer px-3 py-2 text-sm"
              [class.bg-slate-100]="i === activo()"
              (mousedown)="$event.preventDefault()"
              (click)="elegir(o)"
            >
              <span class="font-medium">{{ o.principal }}</span>
              @if (o.secundario) {
                &ngsp;<span class="text-slate-600">{{ o.secundario }}</span>
              }
            </li>
          }
        </ul>
        <p class="border-t border-slate-200 px-3 py-1 text-right text-xs text-slate-600">Powered by Google</p>
      </div>
    }
    <span role="status" class="sr-only">{{ anuncio() }}</span>
  `,
})
export class CiudadComboboxComponent {
  private readonly places = inject(PlacesService);
  private readonly destroyRef = inject(DestroyRef);

  readonly pais = input.required<CodigoPais>();
  /** Texto actual de la ciudad (lo guarda el padre). */
  readonly valor = input('');
  readonly inputId = input.required<string>();
  readonly inputClass = input('');
  readonly describedBy = input('');
  readonly invalido = input(false);
  readonly placeholder = input('');

  /** Se eligió una sugerencia: nombre, coordenadas y región según Google. */
  readonly elegida = output<CiudadElegida>();
  /** El usuario escribió: el padre descarta la ubicación anterior, que ya no corresponde al texto. */
  readonly textoCambiado = output<string>();

  protected readonly listaId = `ciudad-lista-${++secuencia}`;
  protected readonly texto = linkedSignal(() => this.valor());
  protected readonly opciones = signal<readonly SugerenciaCiudad[]>([]);
  protected readonly abierto = computed(() => this.opciones().length > 0 && this.visible());
  protected readonly activo = signal(-1);
  protected readonly anuncio = computed(() => (this.abierto() ? `${this.opciones().length} sugerencias disponibles` : ''));
  protected readonly idActivo = computed(() => (this.abierto() && this.activo() >= 0 ? this.idOpcion(this.activo()) : null));

  private readonly visible = signal(true);
  private temporizador: ReturnType<typeof setTimeout> | undefined;
  /** Descarta respuestas de búsquedas que ya no son la última. */
  private version = 0;

  constructor() {
    effect(() => {
      this.pais();
      this.reiniciar();
    });
    this.destroyRef.onDestroy(() => clearTimeout(this.temporizador));
  }

  protected idOpcion(i: number): string {
    return `${this.listaId}-${i}`;
  }

  protected alEscribir(valor: string): void {
    this.texto.set(valor);
    this.textoCambiado.emit(valor);
    this.reiniciar();
    const termino = valor.trim();
    if (!this.places.disponible() || termino.length < MIN_CARACTERES) return;
    const version = this.version;
    this.temporizador = setTimeout(() => void this.buscar(termino, version), DEBOUNCE_MS);
  }

  private async buscar(termino: string, version: number): Promise<void> {
    try {
      const r = await this.places.buscar(termino, this.pais());
      if (version !== this.version) return;
      this.opciones.set(r);
      this.visible.set(true);
      this.activo.set(-1);
    } catch {
      // Places falló: el servicio ya se marcó como no disponible; el campo sigue siendo texto libre.
      if (version === this.version) this.reiniciar();
    }
  }

  protected alTeclear(e: KeyboardEvent): void {
    const n = this.opciones().length;
    switch (e.key) {
      case 'ArrowDown':
        if (!this.abierto()) return;
        e.preventDefault();
        this.activo.update((a) => (a + 1) % n);
        break;
      case 'ArrowUp':
        if (!this.abierto()) return;
        e.preventDefault();
        this.activo.update((a) => (a <= 0 ? n - 1 : a - 1));
        break;
      case 'Enter':
        if (this.abierto() && this.activo() >= 0) {
          e.preventDefault();
          this.elegir(this.opciones()[this.activo()]);
        }
        break;
      case 'Escape':
        if (this.abierto()) {
          e.preventDefault();
          this.cerrar();
        }
        break;
    }
  }

  protected async elegir(o: SugerenciaCiudad): Promise<void> {
    this.reiniciar();
    // Texto provisional por si falla la resolución: queda como texto libre.
    this.texto.set(o.principal);
    try {
      const c = await this.places.elegir(o.placeId);
      this.texto.set(c.nombre);
      this.elegida.emit(c);
    } catch {
      this.textoCambiado.emit(o.principal);
    }
  }

  protected cerrar(): void {
    this.visible.set(false);
    this.activo.set(-1);
  }

  private reiniciar(): void {
    clearTimeout(this.temporizador);
    this.version++;
    this.opciones.set([]);
    this.activo.set(-1);
  }
}
