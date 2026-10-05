import { describe, it, expect, vi, beforeEach } from 'vitest';
import { type ComponentFixture } from '@angular/core/testing';
import { FacturacionGastosTabComponent } from './facturacion-gastos-tab';
import {
  FacturaAnuladaExistenteError,
  FacturaDuplicadaError,
} from '../../../../core/services/facturas-recibidas.service';
import { crearFake, montarTab, type FakeSvc } from '../../../../../testing/facturas-recibidas';

describe('FacturacionGastosTabComponent', () => {
  let fake: FakeSvc;
  let fixture: ComponentFixture<FacturacionGastosTabComponent>;
  let toast: { success: ReturnType<typeof vi.fn>; fromError: ReturnType<typeof vi.fn> };
  const el = (): HTMLElement => fixture.nativeElement;
  const q = <T extends HTMLElement>(sel: string): T => el().querySelector<T>(sel)!;

  beforeEach(async () => {
    fake = crearFake();
    ({ fixture, toast } = await montarTab(fake));
  });

  it('carga el ejercicio actual al iniciar', () => {
    expect(fake.cargar).toHaveBeenCalledWith(2026);
  });

  it('el copy deja claro que es un registro y no un envío a la AEAT', () => {
    expect(el().textContent).toMatch(/registro/i);
    expect(el().textContent).toMatch(/no se envía nada a la AEAT/i);
  });

  it('KPIs del trimestre: excluyen anuladas y otros trimestres, aplican % deducible', () => {
    expect(q('[data-kpi="facturas"]').textContent).toContain('2');
    expect(q('[data-kpi="base"]').textContent).toMatch(/200[.,]00/);
    expect(q('[data-kpi="cuota"]').textContent).toMatch(/31[.,]00/);
    // 21 al 100 % + 10 al 50 % = 26
    expect(q('[data-kpi="deducible"]').textContent).toMatch(/26[.,]00/);
  });

  it('lista las facturas del trimestre (incluida la anulada, marcada) y no las de otro', () => {
    const filas = Array.from(el().querySelectorAll('[data-factura-fila]'));
    expect(filas.map((f) => f.getAttribute('data-factura-fila')).sort()).toEqual(['A', 'B', 'D']);
    expect(q('[data-factura-fila="D"]').textContent).toMatch(/Anulada/);
  });

  it('cambiar de trimestre recalcula; cambiar de ejercicio recarga', async () => {
    const sel = q<HTMLSelectElement>('#gastos-trimestre');
    sel.value = '1';
    sel.dispatchEvent(new Event('change', { bubbles: true }));
    fixture.detectChanges();
    expect(q('[data-kpi="facturas"]').textContent).toContain('1');
    const ej = q<HTMLInputElement>('#gastos-ejercicio');
    ej.value = '2025';
    ej.dispatchEvent(new Event('change', { bubbles: true }));
    fixture.detectChanges();
    expect(fake.cargar).toHaveBeenLastCalledWith(2025);
  });

  it('estado vacío cuando el trimestre no tiene facturas', async () => {
    fake.facturas.set([]);
    fixture.detectChanges();
    expect(el().textContent).toMatch(/No hay facturas recibidas/);
  });

  it('anular llama al servicio y avisa', async () => {
    q<HTMLButtonElement>('[data-anular="A"]').click();
    await fixture.whenStable();
    expect(fake.anular).toHaveBeenCalledWith('A');
    expect(toast.success).toHaveBeenCalled();
  });

  it('una anulada no ofrece anular', () => {
    expect(el().querySelector('[data-anular="D"]')).toBeNull();
  });

  describe('registrar desde el drawer', () => {
    const abrirYRellenar = async (): Promise<void> => {
      q<HTMLButtonElement>('[data-registrar]').click();
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();
    };
    const datos = {
      datos: {
        tipoFactura: 'F1' as const,
        proveedor: { nombre: 'P', nif: 'B12345674' },
        numero: 'N1',
        fechaExpedicion: '2026-04-02',
        fechaRegistro: '2026-04-05',
        periodo303: { ejercicio: 2026, trimestre: 2 as const },
        lineasIva: [{ base: 100, tipo: 21, cuota: 21 }],
        total: 121,
        porcentajeDeducible: 100,
        concepto: '',
        extraccion: { origen: 'manual' as const, discrepancias: [] as string[] },
      },
      reactivar: false,
    };
    const drawer = () => fixture.debugElement.query((d) => d.name === 'app-factura-recibida-drawer');

    it('el botón abre el drawer y cerrar lo quita', async () => {
      await abrirYRellenar();
      expect(drawer()).not.toBeNull();
      drawer().componentInstance.closed.emit();
      fixture.detectChanges();
      expect(drawer()).toBeNull();
    });

    it('confirmar registra, avisa, cierra y recarga', async () => {
      await abrirYRellenar();
      fake.cargar.mockClear();
      drawer().componentInstance.confirmed.emit(datos);
      await fixture.whenStable();
      fixture.detectChanges();
      expect(fake.registrar).toHaveBeenCalledWith(datos.datos, { reactivar: false });
      expect(toast.success).toHaveBeenCalled();
      expect(fake.cargar).toHaveBeenCalled();
      expect(drawer()).toBeNull();
    });

    it('pasa el archivo adjunto al servicio (se sube al confirmar)', async () => {
      const archivo = new File([new Uint8Array(4)], 'f.pdf', { type: 'application/pdf' });
      await abrirYRellenar();
      drawer().componentInstance.confirmed.emit({ ...datos, archivo });
      await fixture.whenStable();
      expect(fake.registrar).toHaveBeenCalledWith(datos.datos, { reactivar: false, archivo });
    });

    it('duplicado: el drawer sigue abierto con el error', async () => {
      fake.registrar.mockRejectedValue(new FacturaDuplicadaError('id'));
      await abrirYRellenar();
      drawer().componentInstance.confirmed.emit(datos);
      await fixture.whenStable();
      fixture.detectChanges();
      expect(drawer()).not.toBeNull();
      expect(q('[data-error-servidor]').textContent).toMatch(/Ya existe/);
    });

    it('anulada existente: ofrece reactivar y reintenta con reactivar=true', async () => {
      fake.registrar.mockRejectedValueOnce(new FacturaAnuladaExistenteError('id'));
      await abrirYRellenar();
      drawer().componentInstance.confirmed.emit(datos);
      await fixture.whenStable();
      fixture.detectChanges();
      expect(q('[data-reactivar-aviso]')).not.toBeNull();
      drawer().componentInstance.confirmed.emit({ ...datos, reactivar: true });
      await fixture.whenStable();
      expect(fake.registrar).toHaveBeenLastCalledWith(datos.datos, { reactivar: true });
    });

    it('error genérico: toast de error y el drawer sigue abierto', async () => {
      fake.registrar.mockRejectedValue(new Error('boom'));
      await abrirYRellenar();
      drawer().componentInstance.confirmed.emit(datos);
      await fixture.whenStable();
      fixture.detectChanges();
      expect(toast.fromError).toHaveBeenCalled();
      expect(drawer()).not.toBeNull();
    });
  });
});
