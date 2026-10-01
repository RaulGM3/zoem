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
  const selectIvaGlobal = (): HTMLSelectElement => raiz().querySelector<HTMLSelectElement>('#ivaRate')!;

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

  it('una línea que hereda el tipo global exento (0%) también pide causa', async () => {
    await montar([linea()], 21);
    expect(causas()).toHaveLength(0);
    await elegir(selectIvaGlobal(), 'Exento (0%)');
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
