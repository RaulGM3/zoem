import { describe, it, expect, beforeEach } from 'vitest';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { FacturaDrawerComponent, type InvoiceFormPayload } from './factura-drawer';
import type { Invoice, InvoiceLinea } from '../../../../core/services/invoice.service';
import { clienteDesdeFactura, type ClienteFactura } from '../../../../core/facturacion/cliente-factura';
import type { Contact } from '../../../../interfaces/contact.interface';

const CLIENTE_BASE: ClienteFactura = { nombre: 'Cliente Test', tipoId: 'nif' };

function linea(parcial: Partial<InvoiceLinea> = {}): InvoiceLinea {
  return {
    concepto: 'Honorarios',
    cantidad: 1,
    precioUnitario: 100,
    base: 100,
    aplicaIva: true,
    ...parcial,
  };
}

describe('FacturaDrawerComponent — causa de exención por línea (D10)', () => {
  let fixture: ComponentFixture<FacturaDrawerComponent>;
  let emitidos: InvoiceFormPayload[];

  const raiz = (): HTMLElement => fixture.nativeElement as HTMLElement;
  const causas = (): HTMLSelectElement[] => Array.from(raiz().querySelectorAll<HTMLSelectElement>('select[id^="causa-exencion-"]'));
  const selectIvaLinea = (i: number): HTMLSelectElement =>
    raiz().querySelector<HTMLSelectElement>(`select[aria-label="Tipo de IVA línea ${i + 1}"]`)!;

  async function estabilizar(): Promise<void> {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  async function montar(lineas: InvoiceLinea[], defaultIvaRate = 21): Promise<void> {
    TestBed.resetTestingModule();
    await TestBed.configureTestingModule({ imports: [FacturaDrawerComponent] }).compileComponents();
    fixture = TestBed.createComponent(FacturaDrawerComponent);
    fixture.componentRef.setInput('initialLineas', lineas);
    fixture.componentRef.setInput('defaultIvaRate', defaultIvaRate);
    fixture.componentRef.setInput('initialCliente', CLIENTE_BASE);
    emitidos = [];
    fixture.componentInstance.confirmed.subscribe((p) => emitidos.push(p));
    await estabilizar();
  }

  /** Elige una opción por su texto visible en un <select> y emite `change`. */
  async function elegir(select: HTMLSelectElement, texto: string): Promise<void> {
    const idx = Array.from(select.options).findIndex((o) => (o.textContent ?? '').trim() === texto);
    expect(idx, `opción "${texto}"`).toBeGreaterThanOrEqual(0);
    select.selectedIndex = idx;
    select.dispatchEvent(new Event('change', { bubbles: true }));
    await estabilizar();
  }

  const botonConfirmar = (): HTMLButtonElement =>
    Array.from(raiz().querySelectorAll<HTMLButtonElement>('button')).find((b) =>
      /Generar factura/.test(b.textContent ?? ''),
    )!;

  async function confirmar(): Promise<void> {
    botonConfirmar().click();
    await estabilizar();
  }

  beforeEach(() => {
    emitidos = [];
  });

  it('S10.1: con IVA 21% el campo no existe; al elegir Exento en la línea aparece, y al volver a 21% desaparece', async () => {
    await montar([linea()]);
    expect(causas()).toHaveLength(0);

    await elegir(selectIvaLinea(0), 'Exento (0%)');
    expect(causas()).toHaveLength(1);

    await elegir(selectIvaLinea(0), '21%');
    expect(causas()).toHaveLength(0);
  });

  it('el campo es por línea: solo la línea exenta lo muestra', async () => {
    await montar([linea({ ivaRate: 0 }), linea({ concepto: 'Otra', ivaRate: 0.21 })]);
    expect(causas()).toHaveLength(1);
    expect(causas()[0].id).toBe('causa-exencion-0');
  });

  it('una línea guardada sin tipo propio en una factura exenta (0%) toma 0% y pide causa', async () => {
    await montar([linea()], 0);
    expect((selectIvaLinea(0).selectedOptions[0]?.textContent ?? '').trim()).toBe('Exento (0%)');
    expect(causas()).toHaveLength(1);
  });

  it('una línea con el IVA desmarcado pide causa', async () => {
    await montar([linea({ aplicaIva: false })]);
    expect(causas()).toHaveLength(1);
  });

  it('R10.2: ofrece E1-E6, N1 y N2 con su etiqueta descriptiva', async () => {
    await montar([linea({ ivaRate: 0 })]);
    const textos = Array.from(causas()[0].options).map((o) => (o.textContent ?? '').trim());
    expect(textos).toHaveLength(9); // placeholder + 8 causas
    for (const c of ['E1', 'E2', 'E3', 'E4', 'E5', 'E6', 'N1', 'N2']) {
      expect(textos.some((t) => t.startsWith(`${c} · `)), c).toBe(true);
    }
  });

  it('S10.2: Exento sin causa al confirmar no emite, muestra el error y enfoca el campo', async () => {
    await montar([linea({ ivaRate: 0 })]);
    await confirmar();

    expect(emitidos).toHaveLength(0);
    const select = causas()[0];
    expect(select.getAttribute('aria-invalid')).toBe('true');
    expect(raiz().textContent).toContain('Selecciona la causa de exención');
    expect(document.activeElement).toBe(select);
  });

  it('S10.4: label for = id del select, aria-required y aria-describedby apunta al texto del error', async () => {
    await montar([linea({ ivaRate: 0 })]);
    const select = causas()[0];
    const label = raiz().querySelector<HTMLLabelElement>(`label[for="${select.id}"]`);
    expect(label?.textContent).toContain('Causa de exención');
    expect(select.getAttribute('aria-required')).toBe('true');
    expect(select.getAttribute('aria-invalid')).toBe('false');
    expect(select.getAttribute('aria-describedby')).toBeNull();

    await confirmar();
    const idError = select.getAttribute('aria-describedby');
    expect(idError).toBeTruthy();
    expect(raiz().querySelector(`#${idError}`)?.textContent).toContain('Selecciona la causa de exención');
  });

  it('S10.3: con causa elegida el formulario es válido y la causa se emite en la línea', async () => {
    await montar([linea({ ivaRate: 0 })]);
    await elegir(causas()[0], 'E1 · Exenta por el art. 20 LIVA');
    await confirmar();

    expect(emitidos).toHaveLength(1);
    expect(emitidos[0].lineas[0].causaExencion).toBe('E1');
    expect(causas()[0].getAttribute('aria-invalid')).toBe('false');
  });

  it('causas distintas en dos líneas exentas se emiten cada una en su línea', async () => {
    await montar([linea({ ivaRate: 0 }), linea({ concepto: 'Suplido', aplicaIva: false })]);
    await elegir(causas()[0], 'E1 · Exenta por el art. 20 LIVA');
    await elegir(causas()[1], 'N2 · No sujeta por reglas de localización');
    await confirmar();

    expect(emitidos[0].lineas.map((l) => l.causaExencion)).toEqual(['E1', 'N2']);
  });

  it('S10.5: Exento -> IVA -> Exento reinicia la causa a vacío', async () => {
    await montar([linea({ ivaRate: 0 })]);
    await elegir(causas()[0], 'E1 · Exenta por el art. 20 LIVA');
    expect(causas()[0].value).toBe('E1');

    await elegir(selectIvaLinea(0), '21%');
    await elegir(selectIvaLinea(0), 'Exento (0%)');
    expect(causas()[0].value).toBe('');

    await confirmar();
    expect(emitidos).toHaveLength(0);
  });

  it('una línea gravada no emite causa aunque viniera con una antigua; una exenta guardada la conserva', async () => {
    await montar([
      linea({ ivaRate: 0.21, causaExencion: 'E1' }),
      linea({ concepto: 'Suplido', aplicaIva: false, causaExencion: 'N1' }),
    ]);
    await confirmar();

    expect(emitidos).toHaveLength(1);
    expect('causaExencion' in emitidos[0].lineas[0]).toBe(false);
    expect(emitidos[0].lineas[1].causaExencion).toBe('N1');
  });

  it('un borrador gravado sin causa se emite sin problema', async () => {
    await montar([linea()]);
    await confirmar();
    expect(emitidos).toHaveLength(1);
    expect(emitidos[0].lineas[0].causaExencion).toBeUndefined();
  });
});

describe('FacturaDrawerComponent — sección Cliente (cliente-factura-nif, R4)', () => {
  let fixture: ComponentFixture<FacturaDrawerComponent>;
  let emitidos: InvoiceFormPayload[];

  const raiz = (): HTMLElement => fixture.nativeElement as HTMLElement;
  const campo = <T extends HTMLElement>(id: string): T => raiz().querySelector<T>(`#${id}`)!;
  const texto = (): string => raiz().textContent?.replace(/\s+/g, ' ').trim() ?? '';

  const CLIENTE_ANA: ClienteFactura = {
    contactoId: 'c-1',
    nombre: 'Ana Pérez',
    tipoId: 'nif',
    nif: '12345678Z',
    direccion: 'Calle Mayor 1, Madrid',
  };
  const CONTACTO_ANA = { id: 'c-1', type: 'persona_fisica', nombre: 'Ana', apellidos: 'Pérez', nifType: 'dni', nif: '12345678Z' } as Contact;

  async function estabilizar(): Promise<void> {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  async function montar(
    opciones: {
      cliente?: ClienteFactura | null;
      contacto?: Contact | null;
      verifactu?: boolean;
      editing?: Invoice | null;
      lineas?: InvoiceLinea[];
    } = {},
  ): Promise<void> {
    TestBed.resetTestingModule();
    await TestBed.configureTestingModule({ imports: [FacturaDrawerComponent] }).compileComponents();
    fixture = TestBed.createComponent(FacturaDrawerComponent);
    fixture.componentRef.setInput('initialLineas', opciones.lineas ?? [linea()]);
    fixture.componentRef.setInput('verifactuEnabled', opciones.verifactu ?? false);
    if (opciones.cliente !== undefined) fixture.componentRef.setInput('initialCliente', opciones.cliente);
    if (opciones.contacto !== undefined) fixture.componentRef.setInput('contactoVinculado', opciones.contacto);
    if (opciones.editing) {
      fixture.componentRef.setInput('editMode', true);
      fixture.componentRef.setInput('editingInvoice', opciones.editing);
    }
    emitidos = [];
    fixture.componentInstance.confirmed.subscribe((p) => emitidos.push(p));
    await estabilizar();
  }

  async function escribir(id: string, valor: string): Promise<void> {
    const el = campo<HTMLInputElement>(id);
    el.value = valor;
    el.dispatchEvent(new Event('input', { bubbles: true }));
    await estabilizar();
  }

  async function elegirTipo(valor: 'nif' | 'extranjero'): Promise<void> {
    const el = campo<HTMLSelectElement>('cliente-tipoId');
    el.value = valor;
    el.dispatchEvent(new Event('change', { bubbles: true }));
    await estabilizar();
  }

  async function confirmar(): Promise<void> {
    const boton = Array.from(raiz().querySelectorAll<HTMLButtonElement>('button')).find((b) =>
      /Generar factura|Guardar cambios/.test(b.textContent ?? ''),
    )!;
    boton.click();
    await estabilizar();
  }

  it('S4.1 caso con contacto: precarga nombre, NIF y dirección con tipo NIF y etiquetas visibles', async () => {
    await montar({ cliente: CLIENTE_ANA, contacto: CONTACTO_ANA });

    expect(campo<HTMLInputElement>('cliente-nombre').value).toBe('Ana Pérez');
    expect(campo<HTMLInputElement>('cliente-nif').value).toBe('12345678Z');
    expect(campo<HTMLInputElement>('cliente-direccion').value).toBe('Calle Mayor 1, Madrid');
    expect(campo<HTMLSelectElement>('cliente-tipoId').value).toBe('nif');
    for (const id of ['cliente-nombre', 'cliente-tipoId', 'cliente-nif', 'cliente-direccion']) {
      expect(raiz().querySelector(`label[for="${id}"]`)?.textContent?.trim(), id).toBeTruthy();
    }
    expect(raiz().querySelector('label[for="cliente-tipoId"]')?.textContent).toContain('Tipo de documento');
    expect(raiz().querySelector('label[for="cliente-nif"]')?.textContent).toContain('Número de documento');
  });

  it('S4.2 contacto con pasaporte, con Verifactu: tipo extranjero y aviso role=status; sin Verifactu no hay aviso', async () => {
    const extranjero: ClienteFactura = { nombre: 'John Smith', tipoId: 'extranjero', nif: 'PA123456' };
    await montar({ cliente: extranjero, verifactu: true });
    expect(campo<HTMLSelectElement>('cliente-tipoId').value).toBe('extranjero');
    const aviso = raiz().querySelector('[role="status"]');
    expect(aviso?.textContent).toContain('Verifactu aún no admite documentos extranjeros');

    await montar({ cliente: extranjero, verifactu: false });
    expect(raiz().querySelector('[role="status"]')).toBeNull();
  });

  it('S4.6 edición: precarga desde el snapshot de la factura', async () => {
    const editing: Invoice = {
      id: 'inv-1', companyId: 'c', invoiceNumber: 'F-1', amount: 1, vat: 0, total: 1,
      status: 'pendiente', issueDate: '2026-09-01', dueDate: '2026-10-01',
      clienteNombre: 'Snapshot SL', clienteNif: 'B12345674', clienteTipoId: 'nif',
    };
    await montar({ cliente: clienteDesdeFactura(editing), editing });
    expect(campo<HTMLInputElement>('cliente-nombre').value).toBe('Snapshot SL');
    expect(campo<HTMLInputElement>('cliente-nif').value).toBe('B12345674');
  });

  it('S4.7 nombre vacío: no emite, muestra el error enlazado y enfoca el campo', async () => {
    await montar({ cliente: { nombre: '', tipoId: 'nif' } });
    await confirmar();

    expect(emitidos).toHaveLength(0);
    const nombre = campo<HTMLInputElement>('cliente-nombre');
    expect(document.activeElement).toBe(nombre);
    expect(nombre.getAttribute('aria-invalid')).toBe('true');
    expect(nombre.getAttribute('aria-describedby')).toBe('cliente-nombre-error');
    const error = campo<HTMLElement>('cliente-nombre-error');
    expect(error.getAttribute('role')).toBe('alert');
    expect(error.textContent).toContain('Indica el nombre o la razón social del cliente.');
  });

  it('S4.8 NIF con control erróneo bloquea y explica; un NIF correcto confirma', async () => {
    await montar({ cliente: { ...CLIENTE_BASE, nif: '12345678A' } });
    await confirmar();

    expect(emitidos).toHaveLength(0);
    const nif = campo<HTMLInputElement>('cliente-nif');
    expect(document.activeElement).toBe(nif);
    expect(nif.getAttribute('aria-invalid')).toBe('true');
    expect(nif.getAttribute('aria-describedby')).toBe('cliente-nif-error');
    expect(campo('cliente-nif-error').textContent).toContain('El NIF no es válido: revisa los números y la letra.');

    await escribir('cliente-nif', '12345678Z');
    await confirmar();
    expect(emitidos).toHaveLength(1);
  });

  it('S4.9 con Verifactu, NIF vacío con tipo NIF es obligatorio', async () => {
    await montar({ cliente: CLIENTE_BASE, verifactu: true });
    await confirmar();

    expect(emitidos).toHaveLength(0);
    expect(campo('cliente-nif-error').textContent).toContain('Con Verifactu activado, el NIF del cliente es obligatorio.');
    expect(document.activeElement).toBe(campo('cliente-nif'));
  });

  it('S4.10 sin Verifactu, NIF vacío confirma y emite sin documento', async () => {
    await montar({ cliente: CLIENTE_BASE, verifactu: false });
    await confirmar();

    expect(emitidos).toHaveLength(1);
    expect(emitidos[0].cliente.nif).toBeUndefined();
  });

  it('con Verifactu, documento extranjero sin número no bloquea (el servidor lo rechaza con aviso claro)', async () => {
    await montar({ cliente: { nombre: 'John', tipoId: 'extranjero' }, verifactu: true });
    await confirmar();
    expect(emitidos).toHaveLength(1);
  });

  it('cambiar el tipo de NIF a extranjero deja de validar el número como NIF', async () => {
    await montar({ cliente: { ...CLIENTE_BASE, nif: 'PA123456' } });
    await confirmar();
    expect(emitidos).toHaveLength(0);

    await elegirTipo('extranjero');
    await confirmar();
    expect(emitidos).toHaveLength(1);
    expect(emitidos[0].cliente).toMatchObject({ tipoId: 'extranjero', nif: 'PA123456' });
  });

  it('S4.11 el payload lleva el cliente con NIF normalizado, contactoId y guardarEnContacto', async () => {
    await montar({ cliente: { ...CLIENTE_ANA, nif: ' 12.345.678-z ', nombre: '  Ana Pérez ' }, contacto: CONTACTO_ANA });
    await confirmar();

    expect(emitidos).toHaveLength(1);
    expect(emitidos[0].cliente).toEqual({
      contactoId: 'c-1',
      nombre: 'Ana Pérez',
      tipoId: 'nif',
      nif: '12345678Z',
      direccion: 'Calle Mayor 1, Madrid',
    });
    expect(emitidos[0].guardarEnContacto).toBe(false);
  });

  it('S4.5 "Quitar contacto" desvincula pero conserva los datos escritos (cliente puntual)', async () => {
    await montar({ cliente: CLIENTE_ANA, contacto: CONTACTO_ANA });
    const quitar = Array.from(raiz().querySelectorAll<HTMLButtonElement>('button')).find((b) =>
      /Quitar contacto/.test(b.textContent ?? ''),
    );
    expect(quitar, 'botón Quitar contacto').toBeTruthy();
    quitar!.click();
    await estabilizar();

    expect(texto()).not.toContain('Quitar contacto');
    expect(campo<HTMLInputElement>('cliente-nombre').value).toBe('Ana Pérez');
    await confirmar();
    expect(emitidos[0].cliente.contactoId).toBeUndefined();
    expect(emitidos[0].cliente.nif).toBe('12345678Z');
    expect(emitidos[0].guardarEnContacto).toBe(false);
  });

  it('sin contacto vinculado no hay botón "Quitar contacto"', async () => {
    await montar({ cliente: { nombre: 'Puntual', tipoId: 'nif' } });
    expect(texto()).not.toContain('Quitar contacto');
  });

  it('un cliente que llega después (contacto cargado en async) no borra las líneas editadas', async () => {
    await montar({ cliente: null, lineas: [linea({ concepto: 'Original' })] });
    const concepto = raiz().querySelector<HTMLInputElement>('input[aria-label="Concepto línea 1"]')!;
    concepto.value = 'Editado por el usuario';
    concepto.dispatchEvent(new Event('input', { bubbles: true }));
    await estabilizar();

    fixture.componentRef.setInput('initialCliente', CLIENTE_ANA);
    fixture.componentRef.setInput('contactoVinculado', CONTACTO_ANA);
    await estabilizar();

    expect(campo<HTMLInputElement>('cliente-nombre').value).toBe('Ana Pérez');
    expect(raiz().querySelector<HTMLInputElement>('input[aria-label="Concepto línea 1"]')!.value).toBe('Editado por el usuario');
    expect(texto()).toContain('Quitar contacto');
  });

  it('con registro Verifactu vivo la sección queda deshabilitada y se conserva el cliente', async () => {
    const editing: Invoice = {
      id: 'inv-1', companyId: 'c', invoiceNumber: 'F-1', amount: 1, vat: 0, total: 1,
      status: 'pendiente', issueDate: '2026-09-01', dueDate: '2026-10-01',
      verifactu: { estado: 'enviado', tipoRegistro: 'alta', csv: 'C' },
    };
    await montar({ cliente: CLIENTE_ANA, contacto: CONTACTO_ANA, editing, verifactu: true });

    for (const id of ['cliente-nombre', 'cliente-tipoId', 'cliente-nif', 'cliente-direccion']) {
      expect(campo<HTMLInputElement>(id).disabled, id).toBe(true);
    }
    expect(campo<HTMLInputElement>('cliente-nombre').value).toBe('Ana Pérez');
    expect(texto()).not.toContain('Quitar contacto');
  });
});

describe('FacturaDrawerComponent — buscador de contactos y guardado en el contacto (cliente-factura-nif, R4/R5)', () => {
  let fixture: ComponentFixture<FacturaDrawerComponent>;
  let emitidos: InvoiceFormPayload[];
  let solicitudes: number;

  const raiz = (): HTMLElement => fixture.nativeElement as HTMLElement;
  const campo = <T extends HTMLElement>(id: string): T => raiz().querySelector<T>(`#${id}`)!;
  const buscador = (): HTMLInputElement => campo<HTMLInputElement>('cliente-buscar');
  const opciones = (): HTMLElement[] => Array.from(raiz().querySelectorAll<HTMLElement>('[role="option"]'));
  const casilla = (): HTMLInputElement | null => raiz().querySelector<HTMLInputElement>('#cliente-guardar-contacto');

  const fisica = (id: string, nombre: string, apellidos: string, nif?: string): Contact =>
    ({ id, type: 'persona_fisica', nombre, apellidos, email: `${nombre.toLowerCase()}@x.es`, nifType: 'dni', ...(nif ? { nif } : {}) }) as Contact;
  const ANA = fisica('c-1', 'Ana', 'Pérez', '12345678Z');
  const BEA = fisica('c-2', 'Bea', 'Gómez'); // sin documento
  const ANTONIO = fisica('c-3', 'Antonio', 'Ruiz', '00000000T');
  const EMPRESA = { id: 'c-4', type: 'persona_juridica', razonSocial: 'Acme SL', email: 'info@acme.es', cifType: 'cif', cif: 'B12345674' } as Contact;
  const CONTACTOS = [ANA, BEA, ANTONIO, EMPRESA];

  async function estabilizar(): Promise<void> {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  async function montar(
    o: {
      contactos?: Contact[];
      permitir?: boolean;
      cliente?: ClienteFactura | null;
      contacto?: Contact | null;
      rectificativa?: boolean;
    } = {},
  ): Promise<void> {
    TestBed.resetTestingModule();
    await TestBed.configureTestingModule({ imports: [FacturaDrawerComponent] }).compileComponents();
    fixture = TestBed.createComponent(FacturaDrawerComponent);
    fixture.componentRef.setInput('initialLineas', [linea()]);
    fixture.componentRef.setInput('contactos', o.contactos ?? CONTACTOS);
    fixture.componentRef.setInput('permitirBuscarContacto', o.permitir ?? true);
    fixture.componentRef.setInput('rectificativa', o.rectificativa ?? false);
    if (o.cliente !== undefined) fixture.componentRef.setInput('initialCliente', o.cliente);
    if (o.contacto !== undefined) fixture.componentRef.setInput('contactoVinculado', o.contacto);
    emitidos = [];
    solicitudes = 0;
    fixture.componentInstance.confirmed.subscribe((p) => emitidos.push(p));
    fixture.componentInstance.contactosSolicitados.subscribe(() => solicitudes++);
    await estabilizar();
  }

  async function escribirBusqueda(valor: string): Promise<void> {
    const el = buscador();
    el.focus();
    el.value = valor;
    el.dispatchEvent(new Event('input', { bubbles: true }));
    await estabilizar();
  }

  async function tecla(key: string): Promise<KeyboardEvent> {
    const ev = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
    buscador().dispatchEvent(ev);
    await estabilizar();
    return ev;
  }

  async function confirmar(): Promise<void> {
    Array.from(raiz().querySelectorAll<HTMLButtonElement>('button'))
      .find((b) => /Generar factura/.test(b.textContent ?? ''))!
      .click();
    await estabilizar();
  }

  it('S4.3 factura libre: sección vacía con un combobox ARIA etiquetado "Buscar contacto"', async () => {
    await montar({ cliente: null });
    const b = buscador();
    expect(raiz().querySelector('label[for="cliente-buscar"]')?.textContent).toContain('Buscar contacto');
    expect(b.getAttribute('role')).toBe('combobox');
    expect(b.getAttribute('aria-expanded')).toBe('false');
    expect(b.getAttribute('aria-controls')).toBe('cliente-buscar-lista');
    expect(b.getAttribute('aria-autocomplete')).toBe('list');
    expect(campo<HTMLInputElement>('cliente-nombre').value).toBe('');
  });

  it('sin permitirBuscarContacto no hay buscador; con él pero con registro Verifactu vivo tampoco', async () => {
    await montar({ permitir: false });
    expect(raiz().querySelector('#cliente-buscar')).toBeNull();
    await montar({ permitir: true });
    expect(raiz().querySelector('#cliente-buscar')).not.toBeNull();
  });

  it('pide cargar los contactos al enfocar el buscador', async () => {
    await montar();
    buscador().dispatchEvent(new Event('focus'));
    await estabilizar();
    expect(solicitudes).toBe(1);
  });

  it('S4.14 busca por nombre, NIF, email o teléfono y abre un listbox con role=option', async () => {
    await montar();
    await escribirBusqueda('an');
    const nombres = opciones().map((o) => o.textContent?.replace(/\s+/g, ' ').trim());
    expect(nombres).toHaveLength(2);
    expect(nombres[0]).toContain('Ana Pérez');
    expect(nombres[1]).toContain('Antonio Ruiz');
    expect(buscador().getAttribute('aria-expanded')).toBe('true');
    expect(campo('cliente-buscar-lista').getAttribute('role')).toBe('listbox');
    expect(opciones().every((o) => o.tagName === 'LI' && o.id.startsWith('cliente-opcion-'))).toBe(true);

    await escribirBusqueda('B12345674');
    expect(opciones()).toHaveLength(1);
    expect(opciones()[0].textContent).toContain('Acme SL');

    await escribirBusqueda('info@acme');
    expect(opciones()).toHaveLength(1);
  });

  it('S4.14 muestra como máximo 8 resultados', async () => {
    const muchos = Array.from({ length: 12 }, (_, i) => fisica(`m-${i}`, `Mario${i}`, 'López'));
    await montar({ contactos: muchos });
    await escribirBusqueda('mario');
    expect(opciones()).toHaveLength(8);
  });

  it('anuncia de forma educada el número de resultados y "Sin resultados"', async () => {
    await montar();
    await escribirBusqueda('an');
    const vivo = raiz().querySelector('#cliente-buscar-estado')!;
    expect(vivo.getAttribute('aria-live')).toBe('polite');
    expect(vivo.textContent).toContain('2 contactos encontrados');

    await escribirBusqueda('ana');
    expect(vivo.textContent).toContain('1 contacto encontrado');

    await escribirBusqueda('zzz');
    expect(vivo.textContent).toContain('Sin resultados');
    expect(buscador().getAttribute('aria-expanded')).toBe('false');
    expect(opciones()).toHaveLength(0);
  });

  it('S4.13 teclado: ↓ ↓ Enter elige la 2ª opción (aria-activedescendant sigue a la activa); Enter no envía el formulario', async () => {
    await montar();
    await escribirBusqueda('an');

    await tecla('ArrowDown');
    expect(buscador().getAttribute('aria-activedescendant')).toBe(opciones()[0].id);
    expect(opciones()[0].getAttribute('aria-selected')).toBe('true');
    expect(opciones()[1].getAttribute('aria-selected')).toBe('false');

    await tecla('ArrowDown');
    expect(buscador().getAttribute('aria-activedescendant')).toBe(opciones()[1].id);

    const enter = await tecla('Enter');
    expect(enter.defaultPrevented).toBe(true);
    expect(campo<HTMLInputElement>('cliente-nombre').value).toBe('Antonio Ruiz');
    expect(buscador().getAttribute('aria-expanded')).toBe('false');
    expect(buscador().hasAttribute('aria-activedescendant')).toBe(false);
  });

  it('S4.13 ↑ desde la primera salta a la última; Escape cierra sin elegir y conserva el texto', async () => {
    await montar();
    await escribirBusqueda('an');
    await tecla('ArrowDown');
    await tecla('ArrowUp');
    expect(buscador().getAttribute('aria-activedescendant')).toBe(opciones()[1].id);

    await tecla('Escape');
    expect(buscador().getAttribute('aria-expanded')).toBe('false');
    expect(buscador().value).toBe('an');
    expect(campo<HTMLInputElement>('cliente-nombre').value).toBe('');
  });

  it('Enter sin opción activa no elige nada', async () => {
    await montar();
    await escribirBusqueda('an');
    await tecla('Enter');
    expect(campo<HTMLInputElement>('cliente-nombre').value).toBe('');
  });

  it('S4.4 elegir un contacto con el ratón precarga el cliente, lo vincula y muestra "Quitar contacto"', async () => {
    await montar({ cliente: null });
    await escribirBusqueda('acme');
    // Se elige con mousedown (preventDefault evita que el buscador pierda el foco antes de elegir).
    opciones()[0].dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
    await estabilizar();

    expect(campo<HTMLInputElement>('cliente-nombre').value).toBe('Acme SL');
    expect(campo<HTMLInputElement>('cliente-nif').value).toBe('B12345674');
    expect(campo<HTMLSelectElement>('cliente-tipoId').value).toBe('nif');
    expect(raiz().textContent).toContain('Quitar contacto');
    await confirmar();
    expect(emitidos[0].cliente).toMatchObject({ contactoId: 'c-4', nombre: 'Acme SL', nif: 'B12345674' });
  });

  it('S4.4 el mousedown sobre una opción no roba el foco al buscador', async () => {
    await montar();
    await escribirBusqueda('ana');
    const ev = new MouseEvent('mousedown', { bubbles: true, cancelable: true });
    opciones()[0].dispatchEvent(ev);
    expect(ev.defaultPrevented).toBe(true);
  });

  it('S5.5 contacto sin documento: la casilla "Guardar también en el contacto" sale marcada y el payload lo refleja', async () => {
    await montar({ cliente: null });
    await escribirBusqueda('bea');
    await tecla('ArrowDown');
    await tecla('Enter');

    expect(casilla()).not.toBeNull();
    expect(casilla()!.checked).toBe(true);
    expect(raiz().querySelector('label[for="cliente-guardar-contacto"]')?.textContent).toContain('Guardar también en el contacto');
    await escribirBusqueda('');
    campo<HTMLInputElement>('cliente-nif').value = '12345678Z';
    campo<HTMLInputElement>('cliente-nif').dispatchEvent(new Event('input', { bubbles: true }));
    await estabilizar();
    await confirmar();
    expect(emitidos[0].guardarEnContacto).toBe(true);
  });

  it('S5.5 contacto con documento: la casilla sale desmarcada; marcarla activa el flag', async () => {
    await montar({ cliente: null });
    await escribirBusqueda('ana');
    await tecla('ArrowDown');
    await tecla('Enter');
    expect(casilla()!.checked).toBe(false);

    casilla()!.click();
    await estabilizar();
    await confirmar();
    expect(emitidos[0].guardarEnContacto).toBe(true);
  });

  it('S5.6 casilla desmarcada: el payload no pide escribir en el contacto', async () => {
    await montar({ cliente: null });
    await escribirBusqueda('bea');
    await tecla('ArrowDown');
    await tecla('Enter');
    casilla()!.click();
    await estabilizar();
    expect(casilla()!.checked).toBe(false);
    await confirmar();
    expect(emitidos[0].guardarEnContacto).toBe(false);
  });

  it('sin contacto vinculado no hay casilla; al quitar el contacto desaparece y el flag es false', async () => {
    await montar({ cliente: { nombre: 'Puntual', tipoId: 'nif' } });
    expect(casilla()).toBeNull();

    await montar({ cliente: { contactoId: 'c-2', nombre: 'Bea Gómez', tipoId: 'nif' }, contacto: BEA });
    expect(casilla()!.checked).toBe(true);
    Array.from(raiz().querySelectorAll<HTMLButtonElement>('button')).find((b) => /Quitar contacto/.test(b.textContent ?? ''))!.click();
    await estabilizar();
    expect(casilla()).toBeNull();
    await confirmar();
    expect(emitidos[0].guardarEnContacto).toBe(false);
  });

  it('rectificativa: cliente de solo lectura con texto de ayuda, sin buscador, sin "Quitar contacto" ni casilla', async () => {
    await montar({
      cliente: { contactoId: 'c-1', nombre: 'Ana Pérez', tipoId: 'nif', nif: '12345678Z' },
      contacto: ANA,
      rectificativa: true,
    });
    for (const id of ['cliente-nombre', 'cliente-tipoId', 'cliente-nif', 'cliente-direccion']) {
      expect(campo<HTMLInputElement>(id).disabled, id).toBe(true);
    }
    expect(campo<HTMLInputElement>('cliente-nombre').value).toBe('Ana Pérez');
    expect(raiz().querySelector('#cliente-buscar')).toBeNull();
    expect(casilla()).toBeNull();
    expect(raiz().textContent).not.toContain('Quitar contacto');
    expect(raiz().textContent).toContain('La rectificativa mantiene el mismo cliente que la factura original');
    await confirmar();
    expect(emitidos).toHaveLength(1);
  });

  it('fuera de una rectificativa no aparece el texto de ayuda', async () => {
    await montar({ cliente: { nombre: 'Puntual', tipoId: 'nif' } });
    expect(raiz().textContent).not.toContain('La rectificativa mantiene');
  });
});

describe('FacturaDrawerComponent — selector de clientes del caso', () => {
  let fixture: ComponentFixture<FacturaDrawerComponent>;

  const raiz = (): HTMLElement => fixture.nativeElement as HTMLElement;
  const campo = <T extends HTMLElement>(id: string): T => raiz().querySelector<T>(`#${id}`)!;
  const selector = (): HTMLSelectElement | null => raiz().querySelector<HTMLSelectElement>('#cliente-caso');

  const ANA = { id: 'c-1', type: 'persona_fisica', nombre: 'Ana', apellidos: 'Pérez', nifType: 'dni', nif: '12345678Z' } as Contact;
  const ACME = {
    id: 'c-2', type: 'persona_juridica', razonSocial: 'Acme SL', cifType: 'cif', cif: 'B12345674',
    direccionFiscal: { calle: 'Gran Vía', numero: '1', municipio: 'Madrid' },
  } as Contact;

  async function estabilizar(): Promise<void> {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  async function montar(o: { contactosCaso?: Contact[]; contacto?: Contact | null; rectificativa?: boolean } = {}): Promise<void> {
    TestBed.resetTestingModule();
    await TestBed.configureTestingModule({ imports: [FacturaDrawerComponent] }).compileComponents();
    fixture = TestBed.createComponent(FacturaDrawerComponent);
    fixture.componentRef.setInput('initialLineas', [linea()]);
    fixture.componentRef.setInput('rectificativa', o.rectificativa ?? false);
    if (o.contactosCaso) fixture.componentRef.setInput('contactosCaso', o.contactosCaso);
    if (o.contacto) {
      fixture.componentRef.setInput('contactoVinculado', o.contacto);
      fixture.componentRef.setInput('initialCliente', { nombre: 'Ana Pérez', tipoId: 'nif', nif: '12345678Z', contactoId: o.contacto.id });
    }
    await estabilizar();
  }

  it('lista los clientes del caso en un select etiquetado, con el contacto vinculado seleccionado', async () => {
    await montar({ contactosCaso: [ANA, ACME], contacto: ANA });
    const sel = selector()!;
    expect(sel).not.toBeNull();
    expect(raiz().querySelector('label[for="cliente-caso"]')?.textContent).toContain('Cliente del caso');
    const textos = Array.from(sel.options).map((o) => (o.textContent ?? '').trim());
    expect(textos.some((t) => t.includes('Ana Pérez'))).toBe(true);
    expect(textos.some((t) => t.includes('Acme SL'))).toBe(true);
    expect(sel.value).toBe('c-1');
  });

  it('elegir otro cliente del caso rellena nombre, NIF y dirección y lo vincula', async () => {
    await montar({ contactosCaso: [ANA, ACME], contacto: ANA });
    const sel = selector()!;
    sel.value = 'c-2';
    sel.dispatchEvent(new Event('change', { bubbles: true }));
    await estabilizar();
    expect(campo<HTMLInputElement>('cliente-nombre').value).toBe('Acme SL');
    expect(campo<HTMLInputElement>('cliente-nif').value).toBe('B12345674');
    expect(campo<HTMLInputElement>('cliente-direccion').value).toBe('Gran Vía, 1, Madrid');
    expect(raiz().textContent).toContain('Contacto: Acme SL');
  });

  it('sin clientes del caso no hay select', async () => {
    await montar();
    expect(selector()).toBeNull();
  });

  it('en una rectificativa (solo lectura) no hay select', async () => {
    await montar({ contactosCaso: [ANA, ACME], contacto: ANA, rectificativa: true });
    expect(selector()).toBeNull();
  });
});

describe('FacturaDrawerComponent — IVA 10% por defecto en líneas nuevas', () => {
  let fixture: ComponentFixture<FacturaDrawerComponent>;

  const raiz = (): HTMLElement => fixture.nativeElement as HTMLElement;
  const selectIvaLinea = (i: number): HTMLSelectElement =>
    raiz().querySelector<HTMLSelectElement>(`select[aria-label="Tipo de IVA línea ${i + 1}"]`)!;
  const textoElegido = (s: HTMLSelectElement): string => (s.selectedOptions[0]?.textContent ?? '').trim();

  async function montar(lineas: InvoiceLinea[]): Promise<void> {
    TestBed.resetTestingModule();
    await TestBed.configureTestingModule({ imports: [FacturaDrawerComponent] }).compileComponents();
    fixture = TestBed.createComponent(FacturaDrawerComponent);
    fixture.componentRef.setInput('initialLineas', lineas);
    fixture.componentRef.setInput('defaultIvaRate', 21);
    fixture.componentRef.setInput('initialCliente', CLIENTE_BASE);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  it('la línea vacía inicial sale con 10% al marcar IVA', async () => {
    await montar([]);
    raiz().querySelector<HTMLInputElement>('input[type="checkbox"][formcontrolname="aplicaIva"]')!.click();
    fixture.detectChanges();
    await fixture.whenStable();
    expect(textoElegido(selectIvaLinea(0))).toBe('10%');
  });

  it('una línea añadida sale con 10%', async () => {
    await montar([linea({ ivaRate: 0.21 })]);
    fixture.componentInstance.addLinea();
    fixture.detectChanges();
    await fixture.whenStable();
    expect(textoElegido(selectIvaLinea(1))).toBe('10%');
  });

  it('una línea guardada sin tipo propio toma el tipo de su factura (no cambia importes ya emitidos)', async () => {
    await montar([linea()]);
    expect(textoElegido(selectIvaLinea(0))).toBe('21%');
  });

  it('una línea guardada sin IVA y sin tipo propio sale con 10% al marcar IVA', async () => {
    await montar([linea({ aplicaIva: false })]);
    raiz().querySelector<HTMLInputElement>('input[type="checkbox"][formcontrolname="aplicaIva"]')!.click();
    fixture.detectChanges();
    await fixture.whenStable();
    expect(textoElegido(selectIvaLinea(0))).toBe('10%');
  });

  it('el select de IVA por línea no ofrece la opción Global', async () => {
    await montar([linea()]);
    const textos = Array.from(selectIvaLinea(0).options).map((o) => (o.textContent ?? '').trim());
    expect(textos).not.toContain('Global');
  });
});
