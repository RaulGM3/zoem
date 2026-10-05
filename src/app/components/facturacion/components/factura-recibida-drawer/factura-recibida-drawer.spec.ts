import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { FacturaRecibidaDrawerComponent, type FacturaRecibidaPayload } from './factura-recibida-drawer';
import { FacturaExtractionService, type DatosExtraidos, type ResultadoExtraccion } from '../../../../core/services/factura-extraction.service';
import { ACCEPT_FACTURA, ACCEPT_FOTO } from '../../../../core/services/captura-archivo.service';

describe('FacturaRecibidaDrawerComponent', () => {
  let fixture: ComponentFixture<FacturaRecibidaDrawerComponent>;
  let emitidos: FacturaRecibidaPayload[];
  let cierres: number;
  let extraer: ReturnType<typeof vi.fn>;
  const el = (): HTMLElement => fixture.nativeElement;
  const q = <T extends HTMLElement>(sel: string): T => el().querySelector<T>(sel)!;

  async function montar(): Promise<void> {
    TestBed.resetTestingModule();
    extraer = vi.fn().mockResolvedValue({ ok: false, mensaje: 'sin IA' } satisfies ResultadoExtraccion);
    await TestBed.configureTestingModule({
      imports: [FacturaRecibidaDrawerComponent],
      providers: [{ provide: FacturaExtractionService, useValue: { extraer } }],
    }).compileComponents();
    fixture = TestBed.createComponent(FacturaRecibidaDrawerComponent);
    fixture.componentRef.setInput('fechaHoy', '2026-04-05');
    emitidos = [];
    cierres = 0;
    fixture.componentInstance.confirmed.subscribe((p) => emitidos.push(p));
    fixture.componentInstance.closed.subscribe(() => cierres++);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  async function escribir(id: string, valor: string): Promise<void> {
    const campo = q<HTMLInputElement | HTMLSelectElement>(`#${id}`);
    campo.value = valor;
    campo.dispatchEvent(new Event(campo instanceof HTMLSelectElement ? 'change' : 'input', { bubbles: true }));
    fixture.detectChanges();
    await fixture.whenStable();
  }

  async function rellenarValida(): Promise<void> {
    await escribir('fr-proveedor-nombre', 'Proveedor SL');
    await escribir('fr-proveedor-nif', 'B12345674');
    await escribir('fr-numero', 'F-001');
    await escribir('fr-fecha-expedicion', '2026-04-02');
    await escribir('fr-concepto', 'Material');
    await escribir('fr-base-0', '100');
    await escribir('fr-tipo-0', '21');
  }

  const confirmar = (): void => {
    q<HTMLButtonElement>('[data-confirmar]').click();
    fixture.detectChanges();
  };

  beforeEach(async () => {
    await montar();
  });

  it('es un diálogo con aviso claro: registro de IVA soportado, no envío a la AEAT', () => {
    const dlg = q('[role="dialog"]');
    expect(dlg.getAttribute('aria-modal')).toBe('true');
    expect(dlg.querySelector('h2')?.textContent).toContain('factura recibida');
    expect(dlg.textContent).toMatch(/IVA soportado/);
    expect(dlg.textContent).toMatch(/no se envía nada a la AEAT/i);
  });

  it('Escape cierra el drawer', () => {
    q('[role="dialog"]').dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(cierres).toBe(1);
  });

  it('vacío: no emite y muestra errores accesibles (aria-invalid + describedby)', () => {
    confirmar();
    expect(emitidos).toHaveLength(0);
    const nif = q<HTMLInputElement>('#fr-proveedor-nif');
    expect(nif.getAttribute('aria-invalid')).toBe('true');
    const descr = nif.getAttribute('aria-describedby')!;
    expect(el().querySelector(`#${descr}`)?.getAttribute('role')).toBe('alert');
  });

  it('la cuota y el total se calculan desde base × tipo', async () => {
    await escribir('fr-base-0', '100');
    await escribir('fr-tipo-0', '21');
    expect(q<HTMLInputElement>('#fr-cuota-0').value).toBe('21');
    expect(q<HTMLInputElement>('#fr-total').value).toBe('121');
  });

  it('porcentaje deducible por defecto 100 y el periodo sale de la fecha de registro', () => {
    expect(q<HTMLInputElement>('#fr-deducible').value).toBe('100');
    expect(q<HTMLInputElement>('#fr-ejercicio').value).toBe('2026');
    expect(q<HTMLSelectElement>('#fr-trimestre').value).toBe('2');
  });

  it('emite datos válidos con periodo por defecto y reactivar=false', async () => {
    await rellenarValida();
    confirmar();
    expect(emitidos).toHaveLength(1);
    const { datos, reactivar } = emitidos[0];
    expect(reactivar).toBe(false);
    expect(datos).toMatchObject({
      tipoFactura: 'F1',
      proveedor: { nombre: 'Proveedor SL', nif: 'B12345674' },
      numero: 'F-001',
      fechaExpedicion: '2026-04-02',
      fechaRegistro: '2026-04-05',
      periodo303: { ejercicio: 2026, trimestre: 2 },
      lineasIva: [{ base: 100, tipo: 21, cuota: 21 }],
      total: 121,
      porcentajeDeducible: 100,
      concepto: 'Material',
      extraccion: { origen: 'manual', discrepancias: [] },
    });
  });

  it('el usuario puede forzar otro trimestre (override)', async () => {
    await escribir('fr-fecha-expedicion', '2026-01-15');
    await escribir('fr-trimestre', '1');
    await escribir('fr-proveedor-nombre', 'P');
    await escribir('fr-proveedor-nif', 'B12345674');
    await escribir('fr-numero', 'F-9');
    await escribir('fr-concepto', 'x');
    await escribir('fr-base-0', '10');
    await escribir('fr-tipo-0', '21');
    confirmar();
    expect(emitidos[0].datos.periodo303).toEqual({ ejercicio: 2026, trimestre: 1 });
  });

  it('cuota incoherente: bloquea y señala el campo', async () => {
    await rellenarValida();
    await escribir('fr-cuota-0', '5');
    confirmar();
    expect(emitidos).toHaveLength(0);
    expect(q('#fr-cuota-0').getAttribute('aria-invalid')).toBe('true');
    expect(el().textContent).toContain('La cuota no coincide con base × tipo');
  });

  it('añade y quita líneas de IVA (siempre queda una)', async () => {
    q<HTMLButtonElement>('[data-add-linea]').click();
    fixture.detectChanges();
    expect(el().querySelectorAll('[data-linea]')).toHaveLength(2);
    q<HTMLButtonElement>('[data-quitar-linea="1"]').click();
    fixture.detectChanges();
    expect(el().querySelectorAll('[data-linea]')).toHaveLength(1);
    expect(el().querySelector('[data-quitar-linea]')).toBeNull();
  });

  it('muestra el error del servidor (duplicado) como alerta', () => {
    fixture.componentRef.setInput('errorServidor', 'Ya existe una factura registrada.');
    fixture.detectChanges();
    expect(q('[data-error-servidor]').getAttribute('role')).toBe('alert');
  });

  it('con una anulada existente ofrece reactivar y emite reactivar=true', async () => {
    await rellenarValida();
    fixture.componentRef.setInput('reactivacionPendiente', true);
    fixture.detectChanges();
    expect(q('[data-reactivar-aviso]').textContent).toMatch(/anulada/);
    q<HTMLButtonElement>('[data-reactivar]').click();
    fixture.detectChanges();
    expect(emitidos).toHaveLength(1);
    expect(emitidos[0].reactivar).toBe(true);
  });

  it('con saving el botón queda deshabilitado', () => {
    fixture.componentRef.setInput('saving', true);
    fixture.detectChanges();
    expect(q<HTMLButtonElement>('[data-confirmar]').disabled).toBe(true);
  });

  it('el aviso de discrepancias/advertencias no bloquea (periodo anterior al registro)', async () => {
    await rellenarValida();
    await escribir('fr-fecha-expedicion', '2026-01-15');
    await escribir('fr-trimestre', '1');
    expect(el().querySelector('[data-advertencias]')?.textContent).toMatch(/anterior al trimestre de la fecha de registro/);
    confirmar();
    expect(emitidos).toHaveLength(1);
  });

  describe('captura de archivo y extracción con IA', () => {
    const pdf = (): File => new File([new Uint8Array(10)], 'factura.pdf', { type: 'application/pdf' });

    async function elegir(id: string, file: File): Promise<void> {
      const input = q<HTMLInputElement>(`#${id}`);
      Object.defineProperty(input, 'files', { configurable: true, value: [file] });
      input.dispatchEvent(new Event('change', { bubbles: true }));
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();
    }

    const DATOS_EXTRAIDOS: DatosExtraidos = {
        proveedorNombre: 'Proveedor SL',
        proveedorNif: 'B12345674',
        numero: 'F-77',
        tipoFactura: 'F1',
        fechaExpedicion: '2026-04-02',
        lineasIva: [
          { base: 100, tipo: 21, cuota: 21 },
          { base: 50, tipo: 5, cuota: 2.5 },
        ],
        total: 173.5,
        concepto: 'Material',
    };
    const EXTRAIDOS: ResultadoExtraccion = { ok: true, datos: DATOS_EXTRAIDOS };

    it('ofrece subir archivo (PDF/imágenes) y hacer foto (capture=environment)', () => {
      expect(q('#fr-archivo').getAttribute('accept')).toBe(ACCEPT_FACTURA);
      expect(q('#fr-archivo').getAttribute('type')).toBe('file');
      expect(q('#fr-foto').getAttribute('accept')).toBe(ACCEPT_FOTO);
      expect(q('#fr-foto').getAttribute('capture')).toBe('environment');
      expect(el().querySelector('label[for="fr-archivo"]')).not.toBeNull();
      expect(el().querySelector('label[for="fr-foto"]')).not.toBeNull();
    });

    it('HEIC: se rechaza con mensaje, no se extrae ni se adjunta', async () => {
      await elegir('fr-archivo', new File([new Uint8Array(5)], 'IMG_1.HEIC', { type: 'image/heic' }));
      expect(q('[data-error-archivo]').getAttribute('role')).toBe('alert');
      expect(q('[data-error-archivo]').textContent).toMatch(/HEIC/);
      expect(extraer).not.toHaveBeenCalled();
      expect(el().querySelector('[data-archivo-adjunto]')).toBeNull();
      await rellenarValida();
      confirmar();
      expect(emitidos[0].archivo).toBeUndefined();
    });

    it('extracción OK: precarga el formulario, anuncia el resultado y el usuario debe confirmar', async () => {
      extraer.mockResolvedValue(EXTRAIDOS);
      await elegir('fr-archivo', pdf());
      expect(extraer).toHaveBeenCalledTimes(1);
      expect(q<HTMLInputElement>('#fr-proveedor-nombre').value).toBe('Proveedor SL');
      expect(q<HTMLInputElement>('#fr-proveedor-nif').value).toBe('B12345674');
      expect(q<HTMLInputElement>('#fr-numero').value).toBe('F-77');
      expect(q<HTMLInputElement>('#fr-fecha-expedicion').value).toBe('2026-04-02');
      expect(q<HTMLInputElement>('#fr-concepto').value).toBe('Material');
      expect(el().querySelectorAll('[data-linea]')).toHaveLength(2);
      expect(q<HTMLInputElement>('#fr-cuota-1').value).toBe('2.5');
      expect(q<HTMLSelectElement>('#fr-tipo-1').value).toBe('5');
      expect(q<HTMLInputElement>('#fr-total').value).toBe('173.5');
      const estado = q('[data-estado-extraccion]');
      expect(estado.getAttribute('role')).toBe('status');
      expect(estado.getAttribute('aria-live')).toBe('polite');
      expect(estado.textContent).toMatch(/rev[ií]salos/i);
      // nada se emite hasta que el usuario confirma
      expect(emitidos).toHaveLength(0);
      confirmar();
      expect(emitidos).toHaveLength(1);
      expect(emitidos[0].datos.extraccion.origen).toBe('ia');
      expect(emitidos[0].archivo?.name).toBe('factura.pdf');
    });

    it('extracción fallida: formulario vacío, mensaje y el archivo sigue adjunto (origen manual)', async () => {
      extraer.mockResolvedValue({ ok: false, mensaje: 'No se pudo leer la factura automáticamente.' });
      await elegir('fr-archivo', pdf());
      expect(q<HTMLInputElement>('#fr-proveedor-nombre').value).toBe('');
      expect(q('[data-estado-extraccion]').textContent).toContain('No se pudo leer la factura');
      expect(q('[data-archivo-adjunto]').textContent).toContain('factura.pdf');
      await rellenarValida();
      confirmar();
      expect(emitidos[0].datos.extraccion.origen).toBe('manual');
      expect(emitidos[0].archivo?.name).toBe('factura.pdf');
    });

    it('mientras lee anuncia "Leyendo…" y bloquea el registro', async () => {
      let resolver!: (r: ResultadoExtraccion) => void;
      extraer.mockReturnValue(new Promise<ResultadoExtraccion>((r) => (resolver = r)));
      await elegir('fr-archivo', pdf());
      expect(q('[data-estado-extraccion]').textContent).toMatch(/Leyendo/);
      expect(q<HTMLButtonElement>('[data-confirmar]').disabled).toBe(true);
      resolver(EXTRAIDOS);
      await fixture.whenStable();
      fixture.detectChanges();
      expect(q<HTMLButtonElement>('[data-confirmar]').disabled).toBe(false);
    });

    it('los datos leídos no pisan con vacíos lo que ya escribió el usuario', async () => {
      await escribir('fr-concepto', 'Mi concepto');
      extraer.mockResolvedValue({ ok: true, datos: { ...DATOS_EXTRAIDOS, concepto: '' } });
      await elegir('fr-archivo', pdf());
      expect(q<HTMLInputElement>('#fr-concepto').value).toBe('Mi concepto');
    });

    it('la foto de la cámara sigue el mismo flujo', async () => {
      extraer.mockResolvedValue(EXTRAIDOS);
      await elegir('fr-foto', new File([new Uint8Array(5)], 'foto.jpg', { type: 'image/jpeg' }));
      expect(extraer).toHaveBeenCalledTimes(1);
      expect(q('[data-archivo-adjunto]').textContent).toContain('foto.jpg');
    });

    it('quitar el archivo lo desvincula', async () => {
      await elegir('fr-archivo', pdf());
      q<HTMLButtonElement>('[data-quitar-archivo]').click();
      fixture.detectChanges();
      expect(el().querySelector('[data-archivo-adjunto]')).toBeNull();
    });
  });
});
