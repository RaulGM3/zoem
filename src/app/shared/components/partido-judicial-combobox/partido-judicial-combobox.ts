import { ChangeDetectionStrategy, Component, computed, effect, inject, input, output, signal } from '@angular/core';
import { CompanyService } from '../../../core/services/company.service';
import { buscarPartidos, partidoPorId } from '../../../core/plazos/partidos-judiciales';
import type { PartidoJudicial } from '../../../core/plazos/partidos-judiciales';

let siguienteId = 0;
const LIMITE = 20;

const etiqueta = (p: PartidoJudicial): string => `${p.nombre} (${p.provincia})`;

/**
 * Combobox accesible (patrón ARIA 1.2, autocompletado con lista) para elegir el partido judicial.
 * Las opciones de la comunidad autónoma del despacho salen primero.
 */
@Component({
  selector: 'app-partido-judicial-combobox',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'relative block' },
  template: `
    <input
      type="text"
      role="combobox"
      autocomplete="off"
      class="form-input"
      aria-autocomplete="list"
      [id]="inputId()"
      [disabled]="disabled()"
      [value]="texto()"
      [attr.aria-expanded]="listaVisible()"
      [attr.aria-controls]="listaId"
      [attr.aria-activedescendant]="opcionActivaId()"
      [attr.aria-describedby]="estadoId"
      placeholder="Busca por municipio sede o provincia"
      (input)="alEscribir($any($event.target).value)"
      (keydown)="alTeclear($event)"
      (blur)="alPerderFoco()"
    />
    <p [id]="estadoId" role="status" class="text-xs mt-1" style="color:var(--text-faint)">
      @if (abierto() && opciones().length === 0) { Sin resultados } @else if (abierto()) { {{ opciones().length }} resultados disponibles }
    </p>
    @if (listaVisible()) {
      <ul [id]="listaId" role="listbox" aria-label="Partidos judiciales"
        class="absolute left-0 right-0 z-20 mt-1 max-h-60 overflow-y-auto rounded-lg shadow-lg"
        style="background:var(--popover);border:1px solid var(--border)">
        @for (o of opciones(); track o.id; let i = $index) {
          <li role="option" [id]="idOpcion(i)" [attr.aria-selected]="i === activo()"
            class="cursor-pointer px-3 py-2 text-sm"
            [style.background]="i === activo() ? 'color-mix(in srgb,var(--brand) 12%,transparent)' : null"
            style="color:var(--text-body)"
            (mousedown)="$event.preventDefault(); seleccionar(o)">{{ etiquetaDe(o) }}</li>
        }
      </ul>
    }
  `,
})
export class PartidoJudicialComboboxComponent {
  private readonly company = inject(CompanyService);
  private readonly uid = siguienteId++;

  /** Id del partido seleccionado. */
  readonly value = input<string | undefined>(undefined);
  /** Id del `<input>`, para asociarlo con un `<label for>`. */
  readonly inputId = input.required<string>();
  readonly disabled = input(false);
  readonly cambio = output<string | undefined>();

  protected readonly listaId = `pj-lista-${this.uid}`;
  protected readonly estadoId = `pj-estado-${this.uid}`;

  protected readonly texto = signal('');
  protected readonly abierto = signal(false);
  protected readonly activo = signal(-1);

  protected readonly opciones = computed<PartidoJudicial[]>(() =>
    buscarPartidos(this.texto(), { ca: this.company.activeCompany()?.ca, limite: LIMITE }),
  );
  protected readonly listaVisible = computed(() => this.abierto() && this.opciones().length > 0);
  protected readonly opcionActivaId = computed(() => (this.abierto() && this.activo() >= 0 ? this.idOpcion(this.activo()) : null));

  constructor() {
    effect(() => {
      const id = this.value();
      const p = id ? partidoPorId(id) : undefined;
      this.texto.set(p ? etiqueta(p) : '');
    });
  }

  protected idOpcion(i: number): string {
    return `pj-opcion-${this.uid}-${i}`;
  }

  protected etiquetaDe(p: PartidoJudicial): string {
    return etiqueta(p);
  }

  protected alEscribir(texto: string): void {
    this.texto.set(texto);
    this.activo.set(-1);
    this.abierto.set(texto.trim().length > 0);
    if (!texto.trim() && this.value()) this.cambio.emit(undefined);
  }

  protected alTeclear(e: KeyboardEvent): void {
    const n = this.opciones().length;
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        if (!this.abierto() && this.texto().trim()) this.abierto.set(true);
        if (n > 0) this.activo.update((i) => (i + 1) % n);
        break;
      case 'ArrowUp':
        e.preventDefault();
        if (n > 0) this.activo.update((i) => (i <= 0 ? n - 1 : i - 1));
        break;
      case 'Enter': {
        const o = this.opciones()[this.activo()];
        if (this.abierto() && o) {
          e.preventDefault();
          this.seleccionar(o);
        }
        break;
      }
      case 'Escape':
        if (this.abierto()) {
          e.preventDefault();
          e.stopPropagation();
          this.abierto.set(false);
          this.activo.set(-1);
        }
        break;
    }
  }

  protected alPerderFoco(): void {
    this.abierto.set(false);
    this.activo.set(-1);
    // Texto sin seleccionar: vuelve a la etiqueta del valor actual para no dejar un texto engañoso.
    const id = this.value();
    const p = id ? partidoPorId(id) : undefined;
    this.texto.set(p ? etiqueta(p) : '');
  }

  protected seleccionar(p: PartidoJudicial): void {
    this.texto.set(etiqueta(p));
    this.abierto.set(false);
    this.activo.set(-1);
    this.cambio.emit(p.id);
  }
}
