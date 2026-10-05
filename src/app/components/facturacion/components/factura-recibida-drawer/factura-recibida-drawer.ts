import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  ElementRef,
  inject,
  Injector,
  input,
  output,
  signal,
  untracked,
} from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { FormArray, FormBuilder, FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { LucideAngularModule, Plus, Trash2, Info } from 'lucide-angular';
import { OverlayShellComponent } from '../../../../shared/components/overlay-shell/overlay-shell';
import { opcionesIva } from '../../../../interfaces/iva';
import type { PeriodoIva, TrimestreIva } from '../../../../interfaces/factura-recibida.interface';
import { esFechaIso, trimestre } from '../../../../core/facturas-recibidas/trimestre';
import { validarFacturaRecibida, type ResultadoValidacionFactura } from '../../../../core/facturas-recibidas/validar-factura-recibida';
import type { DatosNuevaFactura } from '../../../../core/services/facturas-recibidas.service';

export interface FacturaRecibidaPayload {
  datos: DatosNuevaFactura;
  /** `true` solo cuando el usuario confirmó reactivar una factura anulada con la misma clave. */
  reactivar: boolean;
}

type LineaGroup = FormGroup<{
  base: FormControl<number | null>;
  tipo: FormControl<string>;
  cuota: FormControl<number | null>;
}>;

const round2 = (n: number): number => Math.round((n + Number.EPSILON) * 100) / 100;

@Component({
  selector: 'app-factura-recibida-drawer',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LucideAngularModule, DecimalPipe, ReactiveFormsModule, OverlayShellComponent],
  templateUrl: './factura-recibida-drawer.html',
})
export class FacturaRecibidaDrawerComponent {
  private readonly fb = inject(FormBuilder);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly injector = inject(Injector);

  /** Fecha de hoy (`yyyy-MM-dd`) que propone la fecha de registro; la aporta el padre. */
  readonly fechaHoy = input.required<string>();
  readonly saving = input(false);
  /** Error devuelto al guardar (p. ej. factura duplicada). */
  readonly errorServidor = input<string | null>(null);
  /** Existe una factura anulada con la misma clave: se ofrece reactivarla. */
  readonly reactivacionPendiente = input(false);

  readonly closed = output<void>();
  readonly confirmed = output<FacturaRecibidaPayload>();

  protected readonly PlusIcon = Plus;
  protected readonly Trash2Icon = Trash2;
  protected readonly InfoIcon = Info;

  protected readonly trimestres: readonly TrimestreIva[] = [1, 2, 3, 4];

  /** Se activa al intentar confirmar: solo entonces se muestran los errores de campo. */
  protected readonly submitted = signal(false);

  readonly form = this.fb.group({
    proveedorNombre: this.fb.nonNullable.control(''),
    proveedorNif: this.fb.nonNullable.control(''),
    numero: this.fb.nonNullable.control(''),
    tipoFactura: this.fb.nonNullable.control<'F1' | 'F2'>('F1'),
    fechaExpedicion: this.fb.nonNullable.control(''),
    fechaRegistro: this.fb.nonNullable.control(''),
    total: this.fb.control<number | null>(null),
    porcentajeDeducible: this.fb.control<number | null>(100),
    concepto: this.fb.nonNullable.control(''),
    lineas: this.fb.array<LineaGroup>([]),
  });

  private readonly formValue = signal(this.form.getRawValue());

  /** Periodo 303 elegido a mano; `null` = se deriva de la fecha de registro. */
  private readonly periodoManual = signal<PeriodoIva | null>(null);

  protected readonly periodo = computed<PeriodoIva>(() => {
    const manual = this.periodoManual();
    if (manual) return manual;
    const fecha = this.formValue().fechaRegistro;
    return esFechaIso(fecha) ? trimestre(fecha) : { ejercicio: 0, trimestre: 1 };
  });

  protected readonly tiposIva = computed(() =>
    opcionesIva(this.formValue().lineas.map((l) => (l.tipo === '' ? null : Number(l.tipo)))),
  );

  private readonly datos = computed<DatosNuevaFactura>(() => {
    const v = this.formValue();
    return {
      tipoFactura: v.tipoFactura,
      proveedor: { nombre: v.proveedorNombre.trim(), nif: v.proveedorNif.trim() },
      numero: v.numero.trim(),
      fechaExpedicion: v.fechaExpedicion,
      fechaRegistro: v.fechaRegistro,
      periodo303: this.periodo(),
      lineasIva: v.lineas.map((l) => ({
        base: l.base ?? Number.NaN,
        tipo: l.tipo === '' ? Number.NaN : Number(l.tipo),
        cuota: l.cuota ?? Number.NaN,
      })),
      total: v.total ?? Number.NaN,
      porcentajeDeducible: v.porcentajeDeducible ?? 100,
      concepto: v.concepto.trim(),
      extraccion: { origen: 'manual', discrepancias: [] },
    };
  });

  protected readonly validacion = computed<ResultadoValidacionFactura>(() => validarFacturaRecibida({ ...this.datos(), claveOperacion: '01' }));

  protected readonly advertencias = computed(() => this.validacion().advertencias);

  protected readonly resumen = computed(() => {
    const lineas = this.datos().lineasIva;
    const suma = (k: 'base' | 'cuota') => round2(lineas.reduce((s, l) => s + (Number.isFinite(l[k]) ? l[k] : 0), 0));
    return { base: suma('base'), cuota: suma('cuota') };
  });

  constructor() {
    this.form.valueChanges.subscribe(() => this.formValue.set(this.form.getRawValue()));
    this.form.controls.fechaRegistro.valueChanges.subscribe(() => this.periodoManual.set(null));
    this.agregarLinea();

    effect(() => {
      const hoy = this.fechaHoy();
      untracked(() => {
        if (!this.form.controls.fechaRegistro.value) this.form.controls.fechaRegistro.setValue(hoy);
      });
    });
  }

  protected get lineas(): FormArray<LineaGroup> {
    return this.form.controls.lineas;
  }

  protected agregarLinea(): void {
    const grupo: LineaGroup = this.fb.group({
      base: this.fb.control<number | null>(null),
      tipo: this.fb.nonNullable.control('21'),
      cuota: this.fb.control<number | null>(null),
    });
    // Cuota = base × tipo y total = suma de líneas; el usuario puede corregirlos a mano y la validación avisa si no cuadran.
    const recalcularCuota = () => {
      const { base, tipo } = grupo.getRawValue();
      grupo.controls.cuota.setValue(base == null || tipo === '' ? null : round2((base * Number(tipo)) / 100), {
        emitEvent: false,
      });
      this.recalcularTotal();
    };
    grupo.controls.base.valueChanges.subscribe(recalcularCuota);
    grupo.controls.tipo.valueChanges.subscribe(recalcularCuota);
    grupo.controls.cuota.valueChanges.subscribe(() => this.recalcularTotal());
    this.lineas.push(grupo);
  }

  protected quitarLinea(i: number): void {
    if (this.lineas.length <= 1) return;
    this.lineas.removeAt(i);
    this.recalcularTotal();
  }

  private recalcularTotal(): void {
    const suma = this.lineas.controls.reduce((s, g) => {
      const { base, cuota } = g.getRawValue();
      return s + (base ?? 0) + (cuota ?? 0);
    }, 0);
    this.form.controls.total.setValue(round2(suma), { emitEvent: false });
    this.formValue.set(this.form.getRawValue());
  }

  protected onEjercicio(valor: string): void {
    const ejercicio = Number(valor);
    this.periodoManual.set({ ejercicio, trimestre: this.periodo().trimestre });
  }

  protected onTrimestre(valor: string): void {
    this.periodoManual.set({ ejercicio: this.periodo().ejercicio, trimestre: Number(valor) as TrimestreIva });
  }

  /** Mensaje de error de un campo (ruta de `validarFacturaRecibida`), solo tras intentar confirmar. */
  protected errorDe(campo: string): string | null {
    if (!this.submitted()) return null;
    return this.validacion().errores.find((e) => e.campo === campo)?.mensaje ?? null;
  }

  protected idError(campo: string): string {
    return `fr-error-${campo.replace(/\./g, '-')}`;
  }

  protected onConfirm(reactivar = false): void {
    this.submitted.set(true);
    if (!this.validacion().ok) {
      afterNextRender(() => this.host.nativeElement.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus(), {
        injector: this.injector,
      });
      return;
    }
    this.confirmed.emit({ datos: this.datos(), reactivar });
  }
}
