import {
  Component,
  ChangeDetectionStrategy,
  input,
  output,
  effect,
  inject,
  signal,
  computed,
  ElementRef,
  untracked,
} from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormArray, FormGroup, Validators, type ValidatorFn } from '@angular/forms';
import {
  LucideAngularModule,
  X,
  ShieldCheck,
  Plus,
  Trash2,
  ChevronUp,
  ChevronDown,
} from 'lucide-angular';
import type { Invoice, InvoiceLinea } from '../../../../core/services/invoice.service';
import { normalizeLinea } from '../../../../core/services/invoice.service';
import { Caso } from '../../../../interfaces';
import {
  CAUSAS_EXENCION,
  CAUSA_EXENCION_LABELS,
  esLineaExenta,
  opcionesIva,
} from '../../../../interfaces/iva';
import type { CausaExencion } from '../../../../interfaces/verifactu.interface';
import { motivoBloqueoVerifactu } from '../../../../core/verifactu/verifactu-ui';
import {
  camposClienteFactura,
  clienteDesdeContacto,
  contactoSinDocumento,
  filtrarContactos,
  type ClienteFactura,
  type TipoIdCliente,
} from '../../../../core/facturacion/cliente-factura';
import { nifValidator } from '../../../../core/fiscal/nif.validator';
import { getContactDisplayName, type Contact } from '../../../../interfaces/contact.interface';

export interface InvoiceFormPayload {
  lineas: InvoiceLinea[];
  ivaRate: number;
  issueDate: string;
  dueDate: string;
  notes: string;
  /** Cliente de la factura (copia legal): NIF ya normalizado, `contactoId` solo si sigue vinculado. */
  cliente: ClienteFactura;
  /** `true` solo con contacto vinculado y la casilla "Guardar también en el contacto" marcada. */
  guardarEnContacto: boolean;
}

export type CampoCliente = 'nombre' | 'nif';

interface IvaGroup {
  rate: number;
  base: number;
  cuota: number;
}

@Component({
  selector: 'app-factura-drawer',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LucideAngularModule, DecimalPipe, ReactiveFormsModule],
  templateUrl: './factura-drawer.html',
})
export class FacturaDrawerComponent {
  private readonly fb = inject(FormBuilder);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  /** Opciones del selector de causa de exención (E1..E6, N1, N2). */
  readonly causasExencion = CAUSAS_EXENCION.map((valor) => ({ valor, etiqueta: CAUSA_EXENCION_LABELS[valor] }));

  /** Se pone a `true` al intentar confirmar con el formulario inválido: entonces se muestran los errores. */
  readonly submitted = signal(false);

  // --- Inputs ---
  readonly caso = input<Caso | null>(null);
  readonly initialLineas = input<InvoiceLinea[]>([]);
  readonly defaultIvaRate = input(21);
  readonly issueDate = input('');
  readonly dueDate = input('');
  readonly initialNotes = input('');
  readonly saving = input(false);
  readonly verifactuEnabled = input(false);
  readonly editMode = input(false);
  readonly editingInvoice = input<Invoice | null>(null);
  /** Cliente con el que precargar la sección (contacto del caso o snapshot de la factura). */
  readonly initialCliente = input<ClienteFactura | null>(null);
  /** Contacto del que viene el cliente; permite desvincularlo y (más adelante) escribirle de vuelta. */
  readonly contactoVinculado = input<Contact | null>(null);
  /** Contactos entre los que buscar (los carga el padre cuando se le pide con `contactosSolicitados`). */
  readonly contactos = input<Contact[]>([]);
  /** Muestra el buscador de contactos (facturas con o sin caso; nunca en una rectificativa). */
  readonly permitirBuscarContacto = input(false);
  /** Rectificativa: hereda el cliente de la original, la sección es de solo lectura. */
  readonly rectificativa = input(false);

  /** Contacto vinculado a esta factura. Arranca con `contactoVinculado` y puede quitarse. */
  readonly contacto = signal<Contact | null>(null);
  readonly contactoNombre = computed(() => {
    const c = this.contacto();
    return c ? getContactDisplayName(c) : '';
  });

  /** Motivo del bloqueo: registro vivo en Verifactu (en cola, pendiente o enviado). */
  readonly verifactuBloqueo = computed(() => {
    const inv = this.editingInvoice();
    return inv ? motivoBloqueoVerifactu(inv) : null;
  });
  readonly verifactuLocked = computed(() => this.verifactuBloqueo() !== null);
  /** La sección Cliente no se puede editar: registro Verifactu vivo o rectificativa. */
  readonly soloLectura = computed(() => this.verifactuLocked() || this.rectificativa());
  readonly puedeBuscarContacto = computed(() => this.permitirBuscarContacto() && !this.soloLectura());
  readonly puedeGuardarEnContacto = computed(() => this.contacto() !== null && !this.soloLectura());

  // --- Buscador de contactos (combobox ARIA con listbox) ---
  readonly query = signal('');
  private readonly abierto = signal(false);
  private readonly activo = signal(-1);
  private readonly mensajeSeleccion = signal('');
  readonly opciones = computed(() => filtrarContactos(this.contactos(), this.query()));
  readonly listaAbierta = computed(() => this.abierto() && this.opciones().length > 0);
  readonly opcionActiva = computed(() => (this.listaAbierta() ? this.activo() : -1));
  readonly anuncioBusqueda = computed(() => {
    if (!this.query().trim()) return this.mensajeSeleccion();
    const n = this.opciones().length;
    if (n === 0) return 'Sin resultados';
    return n === 1 ? '1 contacto encontrado' : `${n} contactos encontrados`;
  });

  /** Tipos de IVA seleccionables; incluye los tipos libres que ya traiga la factura. */
  readonly tiposIva = computed(() =>
    opcionesIva([
      this.defaultIvaRate(),
      ...this.initialLineas().map((l) => (l.ivaRate != null ? l.ivaRate * 100 : null)),
    ]),
  );

  readonly headerTitle = computed(() => this.editMode() ? 'Editar factura' : 'Generar factura');
  readonly confirmLabel = computed(() => {
    if (this.saving()) return this.editMode() ? 'Guardando…' : 'Generando…';
    return this.editMode() ? 'Guardar cambios' : 'Generar factura';
  });

  // --- Outputs ---
  readonly closed = output<void>();
  readonly confirmed = output<InvoiceFormPayload>();
  /** El usuario va a buscar: el padre debe tener cargados los contactos. */
  readonly contactosSolicitados = output<void>();

  // --- Icons ---
  readonly XIcon = X;
  readonly ShieldCheckIcon = ShieldCheck;
  readonly PlusIcon = Plus;
  readonly Trash2Icon = Trash2;
  readonly ChevronUpIcon = ChevronUp;
  readonly ChevronDownIcon = ChevronDown;

  // --- Form ---
  readonly form = this.fb.group({
    ivaRate: [21],
    issueDate: [''],
    dueDate: [''],
    notes: [''],
    cliente: this.fb.group({
      nombre: ['', Validators.required],
      tipoId: ['nif'],
      nif: [''],
      direccion: [''],
      guardarEnContacto: [false],
    }),
    lineas: this.fb.array<FormGroup>([]),
  });

  /** Tipo de documento elegido, como señal para mostrar el aviso de documento extranjero. */
  readonly clienteTipoId = computed(() => this.formValue().cliente.tipoId as TipoIdCliente);
  readonly avisoDocumentoExtranjero = computed(() => this.verifactuEnabled() && this.clienteTipoId() === 'extranjero');

  get lineasArray(): FormArray<FormGroup> {
    return this.form.controls.lineas;
  }

  // --- Preview (driven by form value changes → signal) ---
  private readonly formValue = signal(this.form.getRawValue());

  /** Por línea: ¿su tipo efectivo es exento/no sujeto (y por tanto exige causa)? */
  readonly lineaExenta = computed(() => {
    const val = this.formValue();
    const globalRate = (val.ivaRate ?? 21) / 100;
    return val.lineas.map((l) =>
      esLineaExenta(
        { aplicaIva: !!l['aplicaIva'], ivaRate: l['ivaRate'] != null ? l['ivaRate'] / 100 : null },
        globalRate,
      ),
    );
  });

  readonly preview = computed(() => {
    const val = this.formValue();
    const globalRate = (val.ivaRate ?? 21) / 100;
    let base = 0;
    let iva = 0;
    for (const l of val.lineas) {
      const lineBase = (l['cantidad'] ?? 1) * (l['precioUnitario'] ?? 0);
      base += lineBase;
      if (l['aplicaIva']) {
        const rate = l['ivaRate'] != null ? l['ivaRate'] / 100 : globalRate;
        iva += lineBase * rate;
      }
    }
    return { base, iva, total: base + iva };
  });

  readonly ivaBreakdown = computed((): IvaGroup[] => {
    const val = this.formValue();
    const globalRate = (val.ivaRate ?? 21) / 100;
    const groups = new Map<number, { base: number; cuota: number }>();

    for (const l of val.lineas) {
      if (!l['aplicaIva']) continue;
      const rate = l['ivaRate'] != null ? l['ivaRate'] / 100 : globalRate;
      const pct = Math.round(rate * 100);
      const lineBase = (l['cantidad'] ?? 1) * (l['precioUnitario'] ?? 0);
      const existing = groups.get(pct) ?? { base: 0, cuota: 0 };
      existing.base += lineBase;
      existing.cuota += lineBase * rate;
      groups.set(pct, existing);
    }

    return Array.from(groups.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([rate, { base, cuota }]) => ({ rate, base, cuota }));
  });

  constructor() {
    // Sync form changes → signal for computed preview
    this.form.valueChanges.subscribe(() => {
      this.syncCausasExencion();
      this.syncClienteValidators();
      this.formValue.set(this.form.getRawValue());
    });

    // Cliente: efecto SEPARADO del de las líneas. El contacto del caso llega de forma asíncrona y
    // al re-parchear el cliente no se deben pisar las líneas que el usuario ya haya editado.
    effect(() => {
      const cliente = this.initialCliente();
      const contacto = this.contactoVinculado();
      untracked(() => {
        this.contacto.set(contacto);
        if (cliente) {
          this.form.controls.cliente.patchValue(
            {
              nombre: cliente.nombre,
              tipoId: cliente.tipoId,
              nif: cliente.nif ?? '',
              direccion: cliente.direccion ?? '',
            },
            { emitEvent: false },
          );
        }
        // Por defecto se escribe de vuelta solo si el contacto aún no tenía documento (S5.5).
        this.form.controls.cliente.controls.guardarEnContacto.setValue(
          contacto ? contactoSinDocumento(contacto) : false,
          { emitEvent: false },
        );
        this.syncClienteValidators();
        this.formValue.set(this.form.getRawValue());
      });
    });

    // Validadores y bloqueo dependen de la empresa (Verifactu) y del estado del registro, no de los datos.
    effect(() => {
      const bloqueada = this.soloLectura();
      this.verifactuEnabled();
      untracked(() => {
        if (bloqueada) this.form.controls.cliente.disable({ emitEvent: false });
        else this.form.controls.cliente.enable({ emitEvent: false });
        this.syncClienteValidators();
        this.formValue.set(this.form.getRawValue());
      });
    });

    // Initialize form when inputs arrive
    effect(() => {
      const lineas = this.initialLineas();
      const rate = Math.round(this.defaultIvaRate());
      const issue = this.issueDate();
      const due = this.dueDate();
      const notes = this.initialNotes();

      this.form.patchValue({ ivaRate: rate, issueDate: issue, dueDate: due, notes }, { emitEvent: false });
      this.lineasArray.clear({ emitEvent: false });
      for (const l of lineas) {
        this.lineasArray.push(this.createLineaGroup(normalizeLinea(l)), { emitEvent: false });
      }
      if (this.lineasArray.length === 0) {
        this.lineasArray.push(this.createLineaGroup(normalizeLinea({})), { emitEvent: false });
      }
      this.syncCausasExencion();
      this.formValue.set(this.form.getRawValue());
    });
  }

  // --- Line item management ---

  addLinea(): void {
    this.lineasArray.push(
      this.createLineaGroup({
        concepto: '',
        cantidad: 1,
        precioUnitario: 0,
        base: 0,
        aplicaIva: true,
      }),
    );
  }

  removeLinea(index: number): void {
    if (this.lineasArray.length <= 1) return;
    this.lineasArray.removeAt(index);
  }

  moveLinea(from: number, direction: 'up' | 'down'): void {
    const to = direction === 'up' ? from - 1 : from + 1;
    if (to < 0 || to >= this.lineasArray.length) return;
    const control = this.lineasArray.at(from);
    this.lineasArray.removeAt(from, { emitEvent: false });
    this.lineasArray.insert(to, control);
  }

  lineSubtotal(index: number): number {
    const g = this.lineasArray.at(index);
    return (g.value['cantidad'] ?? 1) * (g.value['precioUnitario'] ?? 0);
  }

  // --- Confirm ---

  /** ¿Hay que mostrar el error de la causa de la línea `i`? */
  causaInvalida(i: number): boolean {
    const control = this.lineasArray.at(i).controls['causaExencion'];
    return !!control && control.invalid && (control.touched || this.submitted());
  }

  /** ¿Hay que mostrar el error del campo del cliente? */
  clienteInvalido(campo: CampoCliente): boolean {
    const control = this.form.controls.cliente.controls[campo];
    return control.invalid && (control.touched || this.submitted());
  }

  /** Texto del error del NIF: obligatorio con Verifactu o con formato/control erróneo. */
  readonly mensajeErrorNif = (): string =>
    this.form.controls.cliente.controls.nif.hasError('required')
      ? 'Con Verifactu activado, el NIF del cliente es obligatorio.'
      : 'El NIF no es válido: revisa los números y la letra.';

  /** Desvincula el contacto conservando los datos escritos: pasa a ser un cliente puntual. */
  quitarContacto(): void {
    this.contacto.set(null);
    this.form.controls.cliente.controls.guardarEnContacto.setValue(false);
    this.host.nativeElement.querySelector<HTMLElement>('#cliente-nombre')?.focus();
  }

  /** Nombre y documento de una opción del buscador. */
  documentoContacto(c: Contact): string {
    return (c.type === 'persona_fisica' ? c.nif : c.cif) ?? '';
  }

  nombreContacto(c: Contact): string {
    return getContactDisplayName(c);
  }

  idOpcion(i: number): string {
    return `cliente-opcion-${i}`;
  }

  onBuscarInput(valor: string): void {
    this.query.set(valor);
    this.abierto.set(true);
    this.activo.set(-1);
    this.mensajeSeleccion.set('');
  }

  onBuscarKeydown(ev: KeyboardEvent): void {
    const n = this.opciones().length;
    switch (ev.key) {
      case 'ArrowDown':
        if (n === 0) return;
        ev.preventDefault();
        this.abierto.set(true);
        this.activo.update((i) => (i + 1) % n);
        return;
      case 'ArrowUp':
        if (n === 0) return;
        ev.preventDefault();
        this.abierto.set(true);
        this.activo.update((i) => (i <= 0 ? n - 1 : i - 1));
        return;
      case 'Enter': {
        const elegida = this.opciones()[this.opcionActiva()];
        if (!elegida) return;
        ev.preventDefault();
        this.seleccionarContacto(elegida);
        return;
      }
      case 'Escape':
        if (!this.listaAbierta()) return;
        ev.preventDefault();
        ev.stopPropagation();
        this.cerrarLista();
        return;
    }
  }

  cerrarLista(): void {
    this.abierto.set(false);
    this.activo.set(-1);
  }

  /** Vincula el contacto y precarga el cliente con sus datos (el usuario puede corregirlos después). */
  seleccionarContacto(c: Contact): void {
    const cliente = clienteDesdeContacto(c);
    this.form.controls.cliente.patchValue(
      {
        nombre: cliente.nombre,
        tipoId: cliente.tipoId,
        nif: cliente.nif ?? '',
        direccion: cliente.direccion ?? '',
        guardarEnContacto: contactoSinDocumento(c),
      },
      { emitEvent: false },
    );
    this.contacto.set(c);
    this.syncClienteValidators();
    this.formValue.set(this.form.getRawValue());
    this.query.set('');
    this.cerrarLista();
    this.mensajeSeleccion.set(`Contacto ${getContactDisplayName(c)} seleccionado.`);
  }

  onConfirm(): void {
    if (this.form.invalid) {
      this.submitted.set(true);
      this.form.markAllAsTouched();
      this.host.nativeElement
        .querySelector<HTMLElement>('input.ng-invalid, select.ng-invalid, textarea.ng-invalid')
        ?.focus();
      return;
    }
    const val = this.form.getRawValue();
    const globalRate = (val.ivaRate ?? 21) / 100;
    const exentas = this.lineaExenta();

    const lineas: InvoiceLinea[] = val.lineas.map((l, i) => {
      const cantidad = l['cantidad'] ?? 1;
      const precioUnitario = l['precioUnitario'] ?? 0;
      const causa = exentas[i] ? (l['causaExencion'] as CausaExencion | '') : '';
      return {
        concepto: l['concepto'] ?? '',
        descripcion: l['descripcion'] || undefined,
        cantidad,
        precioUnitario,
        base: cantidad * precioUnitario,
        aplicaIva: l['aplicaIva'] ?? false,
        ivaRate: l['ivaRate'] != null ? l['ivaRate'] / 100 : undefined,
        ...(causa ? { causaExencion: causa } : {}),
      };
    });

    const contacto = this.contacto();
    const campos = camposClienteFactura({
      contactoId: contacto?.id,
      nombre: val.cliente.nombre ?? '',
      tipoId: val.cliente.tipoId as TipoIdCliente,
      nif: val.cliente.nif ?? '',
    });
    const cliente: ClienteFactura = {
      contactoId: campos.clienteContactoId,
      nombre: campos.clienteNombre,
      tipoId: campos.clienteTipoId,
      nif: campos.clienteNif,
      direccion: val.cliente.direccion?.trim() || undefined,
    };

    this.confirmed.emit({
      lineas,
      ivaRate: globalRate,
      issueDate: val.issueDate ?? '',
      dueDate: val.dueDate ?? '',
      notes: val.notes ?? '',
      cliente,
      guardarEnContacto: !!val.cliente.guardarEnContacto && contacto !== null && this.puedeGuardarEnContacto(),
    });
  }

  // --- Private helpers ---

  private createLineaGroup(l: InvoiceLinea): FormGroup {
    return this.fb.group({
      concepto: [l.concepto, Validators.required],
      descripcion: [l.descripcion ?? ''],
      cantidad: [l.cantidad, [Validators.required, Validators.min(0.01)]],
      precioUnitario: [l.precioUnitario, Validators.required],
      aplicaIva: [l.aplicaIva],
      ivaRate: [l.ivaRate != null ? Math.round(l.ivaRate * 100) : null],
      causaExencion: [l.causaExencion ?? ''],
    });
  }

  /**
   * Validadores del número de documento según el tipo: NIF español -> validador de NIF (y
   * obligatorio con Verifactu); documento extranjero -> sin validación. Sin emitir eventos.
   */
  private syncClienteValidators(): void {
    const { tipoId, nif } = this.form.controls.cliente.controls;
    const validadores: ValidatorFn[] = [];
    if (tipoId.value === 'nif') {
      validadores.push(nifValidator(() => tipoId.value ?? 'nif'));
      if (this.verifactuEnabled()) validadores.push(Validators.required);
    }
    nif.setValidators(validadores);
    nif.updateValueAndValidity({ emitEvent: false });
  }

  /**
   * Mantiene la causa de exención de cada línea coherente con su tipo de IVA efectivo:
   * exenta -> obligatoria; no exenta -> sin validador y valor vaciado (S10.5).
   * Solo actualiza validez/valor del control de la causa, sin emitir eventos (evita bucles).
   */
  private syncCausasExencion(): void {
    const globalRate = (this.form.controls.ivaRate.value ?? 21) / 100;
    for (const group of this.lineasArray.controls) {
      const causa = group.controls['causaExencion'];
      if (!causa) continue;
      const rate = group.controls['ivaRate'].value;
      const exenta = esLineaExenta(
        { aplicaIva: !!group.controls['aplicaIva'].value, ivaRate: rate != null ? rate / 100 : null },
        globalRate,
      );
      if (exenta && !causa.hasValidator(Validators.required)) {
        causa.addValidators(Validators.required);
        causa.updateValueAndValidity({ emitEvent: false });
      } else if (!exenta && (causa.hasValidator(Validators.required) || causa.value)) {
        causa.removeValidators(Validators.required);
        causa.reset('', { emitEvent: false });
      }
    }
  }
}
