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
import { AlmacenamientoCupoService } from '../../../../core/planes/almacenamiento-cupo.service';
import { DecimalPipe } from '@angular/common';
import { FormArray, FormBuilder, FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { LucideAngularModule, Plus, Trash2, Info, Paperclip, X, Camera, Image } from 'lucide-angular';
import { OverlayShellComponent } from '../../../../shared/components/overlay-shell/overlay-shell';
import { CAUSAS_EXENCION, CAUSA_EXENCION_LABELS, opcionesIva } from '../../../../interfaces/iva';
import type { CausaExencion } from '../../../../interfaces/verifactu.interface';
import type { PeriodoIva, TrimestreIva } from '../../../../interfaces/factura-recibida.interface';
import { esFechaIso, trimestre } from '../../../../core/facturas-recibidas/trimestre';
import { validarFacturaRecibida, type ResultadoValidacionFactura } from '../../../../core/facturas-recibidas/validar-factura-recibida';
import type { DatosNuevaFactura, VinculoMovimiento } from '../../../../core/services/facturas-recibidas.service';
import { sugerirMovimientos, type MovimientoCandidato } from '../../../../core/facturas-recibidas/tesoreria-link';
import {
  ACCEPT_FACTURA,
  ACCEPT_FOTO,
  CapturaArchivoService,
  type OrigenFoto,
  type ResultadoCaptura,
} from '../../../../core/services/captura-archivo.service';
import { FacturaExtractionService, type DatosExtraidos } from '../../../../core/services/factura-extraction.service';
import { QrDecodeService } from '../../../../core/services/qr-decode.service';
import { contrastarQr, type ResultadoParseQr } from '../../../../core/facturas-recibidas/qr-verifactu';

export interface FacturaRecibidaPayload {
  datos: DatosNuevaFactura;
  /** `true` solo cuando el usuario confirmó reactivar una factura anulada con la misma clave. */
  reactivar: boolean;
  /** Archivo adjunto elegido (se sube a Storage al confirmar, no antes). */
  archivo?: File;
  /** Gasto de tesorería a crear o movimiento existente a vincular (se escribe junto a la factura). */
  movimiento?: VinculoMovimiento;
}

type ModoVinculo = 'ninguno' | 'crear' | 'vincular';

type EstadoExtraccion = 'idle' | 'leyendo' | 'ok' | 'error';

type LineaGroup = FormGroup<{
  base: FormControl<number | null>;
  tipo: FormControl<string>;
  cuota: FormControl<number | null>;
  exenta: FormControl<boolean>;
  causa: FormControl<string>;
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
  private readonly captura = inject(CapturaArchivoService);
  private readonly cupo = inject(AlmacenamientoCupoService);
  private readonly extraccion = inject(FacturaExtractionService);
  private readonly qrDecode = inject(QrDecodeService);

  /** Fecha de hoy (`yyyy-MM-dd`) que propone la fecha de registro; la aporta el padre. */
  readonly fechaHoy = input.required<string>();
  readonly saving = input(false);
  /** Error devuelto al guardar (p. ej. factura duplicada). */
  readonly errorServidor = input<string | null>(null);
  /** Existe una factura anulada con la misma clave: se ofrece reactivarla. */
  readonly reactivacionPendiente = input(false);

  /** Movimientos de tesorería entre los que sugerir el pago de la factura. */
  readonly movimientos = input<readonly MovimientoCandidato[]>([]);

  readonly closed = output<void>();
  readonly confirmed = output<FacturaRecibidaPayload>();

  protected readonly PlusIcon = Plus;
  protected readonly Trash2Icon = Trash2;
  protected readonly InfoIcon = Info;
  protected readonly PaperclipIcon = Paperclip;
  protected readonly XIcon = X;
  protected readonly CameraIcon = Camera;
  protected readonly ImageIcon = Image;
  protected readonly ACCEPT_FACTURA = ACCEPT_FACTURA;
  protected readonly ACCEPT_FOTO = ACCEPT_FOTO;
  /** En la app nativa se usa @capacitor/camera en lugar del input con `capture`. */
  protected readonly nativo = this.captura.esNativo();

  protected readonly archivo = signal<File | null>(null);
  protected readonly errorArchivo = signal<string | null>(null);
  protected readonly estadoExtraccion = signal<EstadoExtraccion>('idle');
  private readonly mensajeFallo = signal('');
  private readonly origenIa = signal(false);
  private readonly qrResultado = signal<ResultadoParseQr | null>(null);
  /** Descarta el resultado de una extracción si entretanto se eligió otro archivo. */
  private extraccionActual = 0;

  /** Texto de la región viva (`role="status"`): anuncia leyendo / listo / fallo. */
  protected readonly mensajeExtraccion = computed(() => {
    switch (this.estadoExtraccion()) {
      case 'leyendo':
        return 'Leyendo la factura con IA…';
      case 'ok':
        return 'Datos leídos de la factura. Revísalos y corrígelos antes de registrar.';
      case 'error':
        return this.mensajeFallo();
      default:
        return '';
    }
  });

  protected readonly qrInfo = computed(() => {
    const r = this.qrResultado();
    if (!r) return null;
    return r.ok
      ? 'Se ha leído el QR de Verifactu de la factura y se contrasta con los datos del formulario.'
      : 'El archivo tiene un QR, pero no es de validación de la AEAT: se ignora.';
  });

  private readonly qrValido = computed(() => {
    const r = this.qrResultado();
    return r?.ok ? r.datos : null;
  });

  /** Diferencias entre el QR y el formulario. Avisan, nunca bloquean el registro. */
  protected readonly discrepanciasQr = computed(() => {
    const qr = this.qrValido();
    if (!qr) return [];
    const v = this.formValue();
    return contrastarQr(qr, {
      nif: v.proveedorNif,
      numero: v.numero,
      fechaExpedicion: v.fechaExpedicion,
      total: v.total ?? Number.NaN,
    });
  });

  protected readonly trimestres: readonly TrimestreIva[] = [1, 2, 3, 4];
  protected readonly causasExencion = CAUSAS_EXENCION.map((c) => ({ valor: c, etiqueta: CAUSA_EXENCION_LABELS[c] }));

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
      lineasIva: v.lineas.map((l) =>
        l.exenta
          ? {
              base: l.base ?? Number.NaN,
              tipo: 0,
              cuota: 0,
              exento: true,
              ...(l.causa ? { causaExencion: l.causa as CausaExencion } : {}),
            }
          : {
              base: l.base ?? Number.NaN,
              tipo: l.tipo === '' ? Number.NaN : Number(l.tipo),
              cuota: l.cuota ?? Number.NaN,
            },
      ),
      total: v.total ?? Number.NaN,
      porcentajeDeducible: v.porcentajeDeducible ?? 100,
      concepto: v.concepto.trim(),
      extraccion: { origen: this.origenIa() ? 'ia' : 'manual', discrepancias: this.discrepanciasQr() },
      ...this.qrParaPayload(),
    };
  });

  private qrParaPayload(): Pick<DatosNuevaFactura, 'qr'> {
    const q = this.qrValido();
    return q ? { qr: { url: q.url, nif: q.nif, numserie: q.numserie, fecha: q.fecha, importe: q.importe } } : {};
  }

  protected readonly validacion = computed<ResultadoValidacionFactura>(() => validarFacturaRecibida({ ...this.datos(), claveOperacion: '01' }));

  protected readonly modoVinculo = signal<ModoVinculo>('ninguno');
  private readonly movElegido = signal<string | null>(null);

  protected readonly sugerencias = computed(() => {
    const { total, fechaExpedicion } = this.datos();
    return sugerirMovimientos({ total, fechaExpedicion }, this.movimientos());
  });

  /** Solo vale la selección si el movimiento sigue siendo una sugerencia con los datos actuales. */
  protected readonly movVigente = computed(() => this.sugerencias().find((m) => m.id === this.movElegido()) ?? null);

  protected readonly errorVinculo = computed(() =>
    this.submitted() && this.modoVinculo() === 'vincular' && !this.movVigente()
      ? this.sugerencias().length === 0
        ? 'No hay ningún movimiento que vincular: elige otra opción de tesorería.'
        : 'Elige el movimiento al que vincular la factura.'
      : null,
  );

  protected onModoVinculo(modo: ModoVinculo): void {
    this.modoVinculo.set(modo);
    this.movElegido.set(null);
  }

  protected onMovimiento(id: string): void {
    this.movElegido.set(id);
  }

  private vinculoParaPayload(): VinculoMovimiento | undefined {
    const modo = this.modoVinculo();
    if (modo === 'crear') return { modo };
    const m = this.movVigente();
    return modo === 'vincular' && m ? { modo, id: m.id, ...(m.casoId ? { casoId: m.casoId } : {}) } : undefined;
  }

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
    this.lineas.push(this.crearLinea());
  }

  private crearLinea(): LineaGroup {
    const grupo: LineaGroup = this.fb.group({
      base: this.fb.control<number | null>(null),
      tipo: this.fb.nonNullable.control('21'),
      cuota: this.fb.control<number | null>(null),
      exenta: this.fb.nonNullable.control(false),
      causa: this.fb.nonNullable.control(''),
    });
    // Cuota = base × tipo y total = suma de líneas; el usuario puede corregirlos a mano y la validación avisa si no cuadran.
    // Una línea exenta/no sujeta va siempre a tipo 0 y cuota 0; la causa es obligatoria (la valida el núcleo).
    const recalcularCuota = () => {
      const { base, tipo, exenta } = grupo.getRawValue();
      const cuota = exenta ? 0 : base == null || tipo === '' ? null : round2((base * Number(tipo)) / 100);
      grupo.controls.cuota.setValue(cuota, { emitEvent: false });
      this.recalcularTotal();
    };
    grupo.controls.base.valueChanges.subscribe(recalcularCuota);
    grupo.controls.tipo.valueChanges.subscribe(recalcularCuota);
    grupo.controls.cuota.valueChanges.subscribe(() => this.recalcularTotal());
    grupo.controls.exenta.valueChanges.subscribe((exenta) => {
      if (exenta) {
        grupo.controls.tipo.setValue('0', { emitEvent: false });
        grupo.controls.tipo.disable({ emitEvent: false });
        grupo.controls.cuota.disable({ emitEvent: false });
      } else {
        grupo.controls.tipo.enable({ emitEvent: false });
        grupo.controls.cuota.enable({ emitEvent: false });
        grupo.controls.causa.setValue('', { emitEvent: false });
      }
      recalcularCuota();
    });
    return grupo;
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

  /** Antes de abrir el selector: sin cupo se cancela el click y el servicio muestra el modal de mejora. */
  protected onAbrirSelector(event: Event): void {
    if (!this.cupo.puedeSubir()) event.preventDefault();
  }

  protected async onArchivo(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    // El adjunto se guarda en el almacenamiento del plan: si no cabe, ni se adjunta (el modal dice cuánto queda).
    const [file] = this.cupo.admitir(Array.from(input.files ?? []).slice(0, 1));
    input.value = '';
    if (!file) return;

    await this.procesarArchivo(this.captura.validar(file));
  }

  /** Nativo: cámara o galería con @capacitor/camera. Cancelar no muestra nada; un fallo (p. ej. permiso) sí. */
  protected async onFotoNativa(origen: OrigenFoto): Promise<void> {
    if (!this.cupo.puedeSubir()) return;
    const resultado = await this.captura.capturar(origen);
    if ('cancelado' in resultado) return;
    if (resultado.ok && this.cupo.admitir([resultado.archivo]).length === 0) return;
    await this.procesarArchivo(resultado);
  }

  private async procesarArchivo(resultado: ResultadoCaptura): Promise<void> {
    if (!resultado.ok) {
      this.errorArchivo.set(resultado.mensaje);
      return;
    }
    this.errorArchivo.set(null);
    this.archivo.set(resultado.archivo);
    this.origenIa.set(false);
    this.qrResultado.set(null);

    const token = ++this.extraccionActual;
    void this.leerQr(resultado.archivo, token);
    this.estadoExtraccion.set('leyendo');
    const extraido = await this.extraccion.extraer(resultado.archivo);
    if (token !== this.extraccionActual) return;
    if (extraido.ok) {
      this.precargar(extraido.datos);
      this.origenIa.set(true);
      this.estadoExtraccion.set('ok');
    } else {
      this.mensajeFallo.set(extraido.mensaje);
      this.estadoExtraccion.set('error');
    }
    this.formValue.set(this.form.getRawValue());
  }

  /** En paralelo a la IA y sin bloquear nada: si hay QR de Verifactu, se guarda para contrastarlo. */
  private async leerQr(archivo: File, token: number): Promise<void> {
    const r = await this.qrDecode.leer(archivo);
    if (token === this.extraccionActual) this.qrResultado.set(r);
  }

  protected quitarArchivo(): void {
    this.extraccionActual++;
    this.qrResultado.set(null);
    this.archivo.set(null);
    this.origenIa.set(false);
    this.estadoExtraccion.set('idle');
    this.errorArchivo.set(null);
  }

  /** Vuelca lo leído por la IA en el formulario sin pisar con vacíos lo que el usuario ya escribió. */
  private precargar(d: DatosExtraidos): void {
    const f = this.form.controls;
    if (d.proveedorNombre) f.proveedorNombre.setValue(d.proveedorNombre, { emitEvent: false });
    if (d.proveedorNif) f.proveedorNif.setValue(d.proveedorNif, { emitEvent: false });
    if (d.numero) f.numero.setValue(d.numero, { emitEvent: false });
    if (d.fechaExpedicion) f.fechaExpedicion.setValue(d.fechaExpedicion, { emitEvent: false });
    if (d.concepto) f.concepto.setValue(d.concepto, { emitEvent: false });
    f.tipoFactura.setValue(d.tipoFactura, { emitEvent: false });

    if (d.lineasIva.length > 0) {
      this.lineas.clear({ emitEvent: false });
      for (const l of d.lineasIva) {
        const grupo = this.crearLinea();
        grupo.setValue({ base: l.base, tipo: String(l.tipo), cuota: l.cuota, exenta: false, causa: '' }, { emitEvent: false });
        this.lineas.push(grupo, { emitEvent: false });
      }
      this.recalcularTotal();
    }
    // El total leído manda (si no cuadra con las líneas, la validación lo señala al registrar).
    if (d.total !== null) f.total.setValue(d.total, { emitEvent: false });
  }

  protected onConfirm(reactivar = false): void {
    this.submitted.set(true);
    if (!this.validacion().ok || this.errorVinculo()) {
      afterNextRender(() => this.host.nativeElement.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus(), {
        injector: this.injector,
      });
      return;
    }
    this.confirmed.emit({
      datos: this.datos(),
      reactivar,
      archivo: this.archivo() ?? undefined,
      movimiento: this.vinculoParaPayload(),
    });
  }
}
