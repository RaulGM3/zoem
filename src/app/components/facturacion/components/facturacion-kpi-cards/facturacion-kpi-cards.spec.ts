import { describe, it, expect } from 'vitest';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { FacturacionKpiCardsComponent } from './facturacion-kpi-cards';
import type { ResumenFacturacion } from '../../../../core/facturacion/resumen-facturacion';
import { analizarA11y, formatearViolaciones } from '../../../../../testing/axe';

const RESUMEN: ResumenFacturacion = {
  verifactuAprobado: { total: 1210, facturas: 3 },
  ivaMes: 210.5,
  ivaTrimestre: 630,
  pendienteCobro: { total: 800, facturas: 2 },
  vencido: { total: 300, facturas: 1 },
  incidenciasVerifactu: 0,
};

describe('FacturacionKpiCardsComponent', () => {
  let fixture: ComponentFixture<FacturacionKpiCardsComponent>;

  const texto = (): string => (fixture.nativeElement as HTMLElement).textContent?.replace(/\s+/g, ' ').trim() ?? '';
  function tarjeta(titulo: string): string {
    const card = Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('.kpi-card')).find((c) =>
      c.textContent?.includes(titulo),
    );
    expect(card, `tarjeta ${titulo}`).toBeTruthy();
    return card!.textContent!.replace(/\s+/g, ' ').trim();
  }

  async function montar(resumen: ResumenFacturacion, verifactuActivo = true): Promise<void> {
    TestBed.configureTestingModule({ imports: [FacturacionKpiCardsComponent] });
    fixture = TestBed.createComponent(FacturacionKpiCardsComponent);
    fixture.componentRef.setInput('resumen', resumen);
    fixture.componentRef.setInput('verifactuActivo', verifactuActivo);
    await fixture.whenStable();
  }

  it('muestra lo aprobado por Verifactu, el IVA del mes, lo pendiente de cobro y lo vencido', async () => {
    await montar(RESUMEN);
    expect(tarjeta('Aprobado por Verifactu')).toContain('1,210.00');
    expect(tarjeta('Aprobado por Verifactu')).toContain('3 facturas este mes');
    expect(tarjeta('IVA del mes')).toContain('210.50');
    expect(tarjeta('IVA del mes')).toContain('Trimestre: 630.00');
    expect(tarjeta('Pendiente de cobro')).toContain('800.00');
    expect(tarjeta('Vencido')).toContain('300.00');
    expect(tarjeta('Vencido')).toContain('1 factura');
  });

  it('ya no muestra saldo, honorarios ni suplidos (están en Tesorería)', async () => {
    await montar(RESUMEN);
    expect(texto()).not.toMatch(/Saldo|Honorarios|Suplidos/);
  });

  it('avisa de las incidencias de Verifactu cuando las hay', async () => {
    await montar({ ...RESUMEN, incidenciasVerifactu: 2 });
    expect(tarjeta('Aprobado por Verifactu')).toContain('2 con error');
  });

  it('con Verifactu desactivado lo indica en lugar de mostrar 0', async () => {
    await montar(RESUMEN, false);
    expect(tarjeta('Aprobado por Verifactu')).toContain('Verifactu no está activado');
    expect(tarjeta('Aprobado por Verifactu')).not.toContain('1,210.00');
  });

  it('pasa axe', async () => {
    await montar({ ...RESUMEN, incidenciasVerifactu: 1 });
    const violaciones = await analizarA11y(fixture.nativeElement);
    expect(violaciones, `\n${formatearViolaciones(violaciones)}\n`).toEqual([]);
  });
});
