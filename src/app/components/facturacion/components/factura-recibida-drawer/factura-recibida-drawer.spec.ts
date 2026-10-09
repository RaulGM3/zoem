import { describe, it, expect, beforeEach, vi } from 'vitest';
import { cupoDePruebas } from '../../../../../testing/cupo-pruebas';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { FacturaRecibidaDrawerComponent, type FacturaRecibidaPayload } from './factura-recibida-drawer';
import { FacturaExtractionService, type DatosExtraidos, type ResultadoExtraccion } from '../../../../core/services/factura-extraction.service';
import { ACCEPT_FACTURA, ACCEPT_FOTO, CapturaArchivoService, type ResultadoCapturaNativa } from '../../../../core/services/captura-archivo.service';
import { QrDecodeService } from '../../../../core/services/qr-decode.service';
import { parseQrVerifactu, type ResultadoParseQr } from '../../../../core/facturas-recibidas/qr-verifactu';

describe('FacturaRecibidaDrawerComponent', () => {
  let fixture: ComponentFixture<FacturaRecibidaDrawerComponent>;
  let emitidos: FacturaRecibidaPayload[];
  let cierres: number;
  let extraer: ReturnType<typeof vi.fn>;
  let leerQr: ReturnType<typeof vi.fn>;
  let cupo: ReturnType<typeof cupoDePruebas>['cupo'];
  const el = (): HTMLElement => fixture.nativeElement;
  const q = <T extends HTMLElement>(sel: string): T => el().querySelector<T>(sel)!;

  async function montar(): Promise<void> {
    TestBed.resetTestingModule();
    const prueba = cupoDePruebas();
    cupo = prueba.cupo;
    extraer = vi.fn().mockResolvedValue({ ok: false, mensaje: 'sin IA' } satisfies ResultadoExtraccion);
    leerQr = vi.fn().mockResolvedValue(null);
    await TestBed.configureTestingModule({
      imports: [FacturaRecibidaDrawerComponent],
      providers: [...prueba.providers, 
        { provide: FacturaExtractionService, useValue: { extraer } },
        { provide: QrDecodeService, useValue: { leer: leerQr } },
      ],
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

    it('sin cupo el selector de archivos de la factura no se abre (click cancelado) y el modal lo explica el servicio', () => {
      cupo.puedeSubir.mockReturnValue(false);
      for (const id of ['fr-archivo', 'fr-foto']) {
        const click = new MouseEvent('click', { cancelable: true, bubbles: true });
        q<HTMLInputElement>(`#${id}`).dispatchEvent(click);
        expect(click.defaultPrevented, id).toBe(true);
      }
      expect(cupo.puedeSubir).toHaveBeenCalled();
    });

    it('con cupo el click abre el selector con normalidad', () => {
      const click = new MouseEvent('click', { cancelable: true, bubbles: true });
      q<HTMLInputElement>('#fr-archivo').dispatchEvent(click);
      expect(click.defaultPrevented).toBe(false);
    });

    it('si el archivo elegido no cabe en el cupo, no se adjunta ni se envía a la IA', async () => {
      cupo.admitir.mockReturnValue([]);
      await elegir('fr-archivo', pdf());
      expect(cupo.admitir).toHaveBeenCalled();
      expect(extraer).not.toHaveBeenCalled();
      expect(el().querySelector('[data-archivo-adjunto]')).toBeNull();
    });

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

  describe('líneas exentas / no sujetas', () => {
    async function marcarExenta(i = 0): Promise<void> {
      const c = q<HTMLInputElement>(`#fr-exenta-${i}`);
      c.checked = true;
      c.dispatchEvent(new Event('change', { bubbles: true }));
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();
    }

    it('cada línea tiene un interruptor "Exenta" accesible y la causa solo aparece al marcarlo', async () => {
      const c = q<HTMLInputElement>('#fr-exenta-0');
      expect(c.type).toBe('checkbox');
      expect(el().querySelector('label[for="fr-exenta-0"]')?.textContent).toMatch(/exenta/i);
      expect(el().querySelector('#fr-causa-0')).toBeNull();
      await marcarExenta();
      const causa = q<HTMLSelectElement>('#fr-causa-0');
      expect(el().querySelector('label[for="fr-causa-0"]')?.textContent).toMatch(/causa/i);
      expect(causa.querySelectorAll('option[value^="E"], option[value^="N"]').length).toBe(8);
      expect(causa.textContent).toContain('E1 · Exenta por el art. 20 LIVA');
    });

    it('al marcar exenta la cuota pasa a 0 y el tipo a 0, aunque haya base', async () => {
      await escribir('fr-base-0', '100');
      await escribir('fr-tipo-0', '21');
      await marcarExenta();
      expect(q<HTMLInputElement>('#fr-cuota-0').value).toBe('0');
      expect(q<HTMLSelectElement>('#fr-tipo-0').value).toBe('0');
      expect(q<HTMLInputElement>('#fr-total').value).toBe('100');
      await escribir('fr-base-0', '50');
      expect(q<HTMLInputElement>('#fr-cuota-0').value).toBe('0');
      expect(q<HTMLInputElement>('#fr-total').value).toBe('50');
    });

    it('sin causa no se emite: error accesible con aria-invalid y describedby', async () => {
      await rellenarValida();
      await marcarExenta();
      confirmar();
      expect(emitidos).toHaveLength(0);
      const causa = q<HTMLSelectElement>('#fr-causa-0');
      expect(causa.getAttribute('aria-invalid')).toBe('true');
      const descr = causa.getAttribute('aria-describedby')!;
      expect(el().querySelector(`#${descr}`)?.getAttribute('role')).toBe('alert');
    });

    it('con causa emite la línea exenta con cuota 0', async () => {
      await rellenarValida();
      await marcarExenta();
      await escribir('fr-causa-0', 'E1');
      confirmar();
      expect(emitidos).toHaveLength(1);
      expect(emitidos[0].datos.lineasIva).toEqual([{ base: 100, tipo: 0, cuota: 0, exento: true, causaExencion: 'E1' }]);
      expect(emitidos[0].datos.total).toBe(100);
    });

    it('desmarcar exenta recupera el cálculo con el tipo elegido y no emite causa', async () => {
      await rellenarValida();
      await marcarExenta();
      await escribir('fr-causa-0', 'E1');
      const c = q<HTMLInputElement>('#fr-exenta-0');
      c.checked = false;
      c.dispatchEvent(new Event('change', { bubbles: true }));
      fixture.detectChanges();
      await escribir('fr-tipo-0', '21');
      confirmar();
      expect(emitidos[0].datos.lineasIva).toEqual([{ base: 100, tipo: 21, cuota: 21 }]);
    });
  });

  describe('QR de Verifactu: contraste con el formulario (avisa, nunca bloquea)', () => {
    const pdf = (): File => new File([new Uint8Array(10)], 'factura.pdf', { type: 'application/pdf' });
    const URL_QR = (importe: string) =>
      `https://prewww2.aeat.es/wlpl/TIKE-CONT/ValidarQR?nif=B12345674&numserie=F-77&fecha=02-04-2026&importe=${importe}`;
    const qr = (importe = '173.50'): ResultadoParseQr => parseQrVerifactu(URL_QR(importe));
    const IA: ResultadoExtraccion = {
      ok: true,
      datos: {
        proveedorNombre: 'Proveedor SL',
        proveedorNif: 'B12345674',
        numero: 'F-77',
        tipoFactura: 'F1',
        fechaExpedicion: '2026-04-02',
        lineasIva: [{ base: 100, tipo: 21, cuota: 21 }, { base: 50, tipo: 5, cuota: 2.5 }],
        total: 173.5,
        concepto: 'Material',
      },
    };

    async function elegir(file: File): Promise<void> {
      const input = q<HTMLInputElement>('#fr-archivo');
      Object.defineProperty(input, 'files', { configurable: true, value: [file] });
      input.dispatchEvent(new Event('change', { bubbles: true }));
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();
    }

    it('QR coincidente: informa que se leyó y no muestra discrepancias', async () => {
      extraer.mockResolvedValue(IA);
      leerQr.mockResolvedValue(qr());
      await elegir(pdf());
      expect(leerQr).toHaveBeenCalledTimes(1);
      expect(q('[data-qr-info]').textContent).toMatch(/QR de Verifactu/);
      expect(el().querySelector('[data-qr-discrepancias]')).toBeNull();
    });

    it('QR con otro importe: banner con la diferencia, y el registro sigue habilitado y emite', async () => {
      extraer.mockResolvedValue(IA);
      leerQr.mockResolvedValue(qr('180.00'));
      await elegir(pdf());
      const banner = q('[data-qr-discrepancias]');
      expect(banner.textContent).toMatch(/180\.00/);
      expect(q<HTMLButtonElement>('[data-confirmar]').disabled).toBe(false);
      confirmar();
      expect(emitidos).toHaveLength(1);
      expect(emitidos[0].datos.extraccion.discrepancias.join(' ')).toMatch(/importe del QR/);
    });

    it('el banner se recalcula al corregir el formulario', async () => {
      extraer.mockResolvedValue(IA);
      leerQr.mockResolvedValue(qr('180.00'));
      await elegir(pdf());
      expect(el().querySelector('[data-qr-discrepancias]')).not.toBeNull();
      await escribir('fr-total', '180');
      expect(el().querySelector('[data-qr-discrepancias]')).toBeNull();
    });

    it('con QR válido el payload lleva qr (url canónica) y se sigue pudiendo registrar', async () => {
      extraer.mockResolvedValue(IA);
      leerQr.mockResolvedValue(qr());
      await elegir(pdf());
      confirmar();
      expect(emitidos[0].datos.qr).toEqual({
        url: URL_QR('173.50'),
        nif: 'B12345674',
        numserie: 'F-77',
        fecha: '02-04-2026',
        importe: 173.5,
      });
    });

    it('sin QR: ni banner ni info, y el payload no lleva qr', async () => {
      extraer.mockResolvedValue(IA);
      await elegir(pdf());
      expect(el().querySelector('[data-qr-info]')).toBeNull();
      expect(el().querySelector('[data-qr-discrepancias]')).toBeNull();
      confirmar();
      expect(emitidos[0].datos.qr).toBeUndefined();
    });

    it('QR que no es de la AEAT: aviso informativo y sin qr en el payload', async () => {
      extraer.mockResolvedValue(IA);
      leerQr.mockResolvedValue(parseQrVerifactu('https://evil.example.com/x'));
      await elegir(pdf());
      expect(q('[data-qr-info]').textContent).toMatch(/no es de validación de la AEAT/i);
      confirmar();
      expect(emitidos[0].datos.qr).toBeUndefined();
    });

    it('quitar el archivo descarta el QR', async () => {
      extraer.mockResolvedValue(IA);
      leerQr.mockResolvedValue(qr('180.00'));
      await elegir(pdf());
      q<HTMLButtonElement>('[data-quitar-archivo]').click();
      fixture.detectChanges();
      expect(el().querySelector('[data-qr-info]')).toBeNull();
      expect(el().querySelector('[data-qr-discrepancias]')).toBeNull();
    });

    it('el QR llega aunque la IA falle (el formulario se rellena a mano)', async () => {
      leerQr.mockResolvedValue(qr());
      await elegir(pdf());
      expect(q('[data-qr-info]')).not.toBeNull();
    });
  });

  describe('vínculo con tesorería (gasto nuevo o movimiento existente)', () => {
    const MOVS = [
      { id: 'm-ok', tipo: 'gasto', esEntrada: false, importe: 121, fecha: '2026-04-03', concepto: 'Pago Proveedor SL' },
      { id: 'm-caso', casoId: 'c1', tipo: 'gasto', esEntrada: false, importe: 121, fecha: '2026-04-05', concepto: 'Gasto del caso' },
      { id: 'm-otro', tipo: 'gasto', esEntrada: false, importe: 500, fecha: '2026-04-03', concepto: 'Otro importe' },
      { id: 'm-ingreso', tipo: 'ingreso', esEntrada: true, importe: 121, fecha: '2026-04-03', concepto: 'Ingreso' },
    ] as const;

    async function elegirVinculo(id: 'ninguno' | 'crear' | 'vincular'): Promise<void> {
      const r = q<HTMLInputElement>(`#fr-vinculo-${id}`);
      r.checked = true;
      r.dispatchEvent(new Event('change', { bubbles: true }));
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();
    }

    beforeEach(() => {
      fixture.componentRef.setInput('movimientos', MOVS);
      fixture.detectChanges();
    });

    it('es un grupo de opciones con leyenda; por defecto no vincula nada', async () => {
      const grupo = q('fieldset[data-tesoreria]');
      expect(grupo.querySelector('legend')?.textContent).toMatch(/Tesorer/);
      expect(q<HTMLInputElement>('#fr-vinculo-ninguno').checked).toBe(true);
      for (const id of ['ninguno', 'crear', 'vincular']) {
        expect(el().querySelector(`label[for="fr-vinculo-${id}"]`)).not.toBeNull();
      }
      await rellenarValida();
      confirmar();
      expect(emitidos[0].movimiento).toBeUndefined();
    });

    it('crear: el payload pide crear un gasto', async () => {
      await rellenarValida();
      await elegirVinculo('crear');
      confirmar();
      expect(emitidos[0].movimiento).toEqual({ modo: 'crear' });
    });

    it('vincular: sugiere solo gastos parecidos en importe y fecha, y emite el elegido', async () => {
      await rellenarValida();
      await elegirVinculo('vincular');
      const ids = Array.from(el().querySelectorAll('[data-sugerencia] input')).map((i) => (i as HTMLInputElement).value);
      expect(ids).toEqual(['m-ok', 'm-caso']);
      const r = q<HTMLInputElement>('#fr-mov-m-ok');
      r.checked = true;
      r.dispatchEvent(new Event('change', { bubbles: true }));
      fixture.detectChanges();
      confirmar();
      expect(emitidos[0].movimiento).toEqual({ modo: 'vincular', id: 'm-ok' });
    });

    it('vincular a un movimiento de un caso incluye su casoId', async () => {
      await rellenarValida();
      await elegirVinculo('vincular');
      const r = q<HTMLInputElement>('#fr-mov-m-caso');
      r.checked = true;
      r.dispatchEvent(new Event('change', { bubbles: true }));
      fixture.detectChanges();
      confirmar();
      expect(emitidos[0].movimiento).toEqual({ modo: 'vincular', id: 'm-caso', casoId: 'c1' });
    });

    it('vincular sin elegir movimiento bloquea con un error accesible', async () => {
      await rellenarValida();
      await elegirVinculo('vincular');
      confirmar();
      expect(emitidos).toHaveLength(0);
      const grupo = q('[data-lista-sugerencias]');
      expect(grupo.getAttribute('aria-invalid')).toBe('true');
      const descr = grupo.getAttribute('aria-describedby')!;
      expect(el().querySelector(`#${descr}`)?.getAttribute('role')).toBe('alert');
    });

    it('sin candidatos parecidos lo dice y permite volver a otra opción', async () => {
      fixture.componentRef.setInput('movimientos', []);
      await rellenarValida();
      await elegirVinculo('vincular');
      expect(q('[data-sin-sugerencias]').textContent).toMatch(/No hay movimientos/i);
      confirmar();
      expect(emitidos).toHaveLength(0);
      expect(q('#fr-error-vinculo').getAttribute('role')).toBe('alert');
      await elegirVinculo('ninguno');
      confirmar();
      expect(emitidos).toHaveLength(1);
    });

    it('cambiar a otra opción descarta la selección anterior', async () => {
      await rellenarValida();
      await elegirVinculo('vincular');
      const r = q<HTMLInputElement>('#fr-mov-m-ok');
      r.checked = true;
      r.dispatchEvent(new Event('change', { bubbles: true }));
      fixture.detectChanges();
      await elegirVinculo('crear');
      await elegirVinculo('vincular');
      confirmar();
      expect(emitidos).toHaveLength(0);
    });
  });
});

describe('FacturaRecibidaDrawerComponent — captura nativa (@capacitor/camera)', () => {
  let fixture: ComponentFixture<FacturaRecibidaDrawerComponent>;
  let capturar: ReturnType<typeof vi.fn>;
  let extraer: ReturnType<typeof vi.fn>;
  const el = (): HTMLElement => fixture.nativeElement;
  const q = <T extends HTMLElement>(sel: string): T | null => el().querySelector<T>(sel);

  async function montar(nativo: boolean): Promise<void> {
    TestBed.resetTestingModule();
    capturar = vi.fn();
    extraer = vi.fn().mockResolvedValue({ ok: false, mensaje: 'sin IA' } satisfies ResultadoExtraccion);
    await TestBed.configureTestingModule({
      imports: [FacturaRecibidaDrawerComponent],
      providers: [...cupoDePruebas().providers, 
        { provide: FacturaExtractionService, useValue: { extraer } },
        { provide: QrDecodeService, useValue: { leer: vi.fn().mockResolvedValue(null) } },
        { provide: CapturaArchivoService, useValue: { esNativo: () => nativo, capturar, validar: (a: File) => ({ ok: true, archivo: a }) } },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(FacturaRecibidaDrawerComponent);
    fixture.componentRef.setInput('fechaHoy', '2026-04-05');
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  async function pulsar(sel: string): Promise<void> {
    q<HTMLButtonElement>(sel)!.click();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  it('en nativo ofrece tres opciones: subir archivo (PDF), elegir foto y hacer foto (sin input de cámara web)', async () => {
    await montar(true);
    expect(q('#fr-archivo')).not.toBeNull();
    expect(q('[data-elegir-foto]')?.textContent).toContain('Elegir foto');
    expect(q('[data-hacer-foto]')?.textContent).toContain('Hacer foto');
    expect(q('#fr-foto')).toBeNull();
  });

  it('en la web mantiene los inputs y no muestra los botones nativos', async () => {
    await montar(false);
    expect(q('#fr-archivo')).not.toBeNull();
    expect(q('#fr-foto')).not.toBeNull();
    expect(q('[data-elegir-foto]')).toBeNull();
    expect(q('[data-hacer-foto]')).toBeNull();
  });

  it.each([
    ['[data-hacer-foto]', 'camara'],
    ['[data-elegir-foto]', 'galeria'],
  ])('%s captura (%s), adjunta el JPEG y lanza la extracción', async (sel, origen) => {
    await montar(true);
    const foto = new File([new Uint8Array(10)], 'factura-1.jpg', { type: 'image/jpeg' });
    capturar.mockResolvedValue({ ok: true, archivo: foto } satisfies ResultadoCapturaNativa);
    await pulsar(sel);
    expect(capturar).toHaveBeenCalledWith(origen);
    expect(q('[data-archivo-adjunto]')?.textContent).toContain('factura-1.jpg');
    expect(extraer).toHaveBeenCalledWith(foto);
  });

  it('si el usuario cancela no muestra error ni adjunta nada', async () => {
    await montar(true);
    capturar.mockResolvedValue({ ok: false, cancelado: true } satisfies ResultadoCapturaNativa);
    await pulsar('[data-hacer-foto]');
    expect(q('[data-error-archivo]')).toBeNull();
    expect(q('[data-archivo-adjunto]')).toBeNull();
    expect(extraer).not.toHaveBeenCalled();
  });

  it('un permiso denegado se anuncia como alerta accesible', async () => {
    await montar(true);
    capturar.mockResolvedValue({ ok: false, mensaje: 'Sin permiso para usar la cámara o las fotos.' } satisfies ResultadoCapturaNativa);
    await pulsar('[data-elegir-foto]');
    const error = q('[data-error-archivo]')!;
    expect(error.getAttribute('role')).toBe('alert');
    expect(error.textContent).toContain('Sin permiso');
    expect(extraer).not.toHaveBeenCalled();
  });
});
