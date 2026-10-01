import { describe, it, expect, beforeEach } from 'vitest';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { FacturaDrawerComponent, type InvoiceFormPayload } from './factura-drawer';
import type { InvoiceLinea } from '../../../../core/services/invoice.service';

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
