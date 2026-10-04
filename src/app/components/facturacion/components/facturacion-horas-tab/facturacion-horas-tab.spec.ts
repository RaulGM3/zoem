import { describe, it, expect, beforeEach } from 'vitest';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { FacturacionHorasTabComponent, type HoraFlat } from './facturacion-horas-tab';
import { analizarA11y, formatearViolaciones } from '../../../../../testing/axe';

function mockViewport(mobile: boolean): void {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    writable: true,
    value: (q: string) => ({
      matches: mobile && /max-width/.test(q),
      media: q,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    }),
  });
}

const hora = (id: string, facturado: boolean, importe?: number): HoraFlat => ({
  id, casoId: 'k', casoTitulo: `Caso ${id}`, hitoId: 'h', hitoTitulo: `Hito ${id}`, memberName: 'Ana',
  fecha: '2026-10-01', minutos: 90, horas: 1.5, facturado, importe,
});

describe('FacturacionHorasTabComponent', () => {
  let fixture: ComponentFixture<FacturacionHorasTabComponent>;
  const el = (): HTMLElement => fixture.nativeElement;

  async function montar(mobile: boolean, horas: HoraFlat[]): Promise<void> {
    TestBed.resetTestingModule();
    mockViewport(mobile);
    TestBed.configureTestingModule({ imports: [FacturacionHorasTabComponent] });
    fixture = TestBed.createComponent(FacturacionHorasTabComponent);
    fixture.componentRef.setInput('horasFlat', horas);
    fixture.componentRef.setInput('totalHoras', 10);
    fixture.componentRef.setInput('horasPendientes', 4);
    fixture.componentRef.setInput('valorPendiente', 400);
    await fixture.whenStable();
  }

  beforeEach(() => TestBed.resetTestingModule());

  it('las métricas se apilan en móvil y van en 3 columnas desde sm', async () => {
    await montar(true, []);
    const grid = el().querySelector('.grid')!;
    expect(grid.classList.contains('grid-cols-1')).toBe(true);
    expect(grid.classList.contains('sm:grid-cols-3')).toBe(true);
    expect(grid.classList.contains('grid-cols-3')).toBe(false);
  });

  it('móvil: tarjetas con caso, hito, miembro, horas, importe y estado; sin tabla', async () => {
    await montar(true, [hora('a', true, 150), hora('b', false)]);
    expect(el().querySelector('table')).toBeNull();
    const lis = el().querySelectorAll('ul > li');
    expect(lis).toHaveLength(2);
    expect(lis[0].textContent).toContain('Caso a');
    expect(lis[0].textContent).toContain('Hito a');
    expect(lis[0].textContent).toContain('Ana');
    expect(lis[0].textContent).toContain('1.5h');
    expect(lis[0].textContent).toContain('150 €');
    expect(lis[0].textContent).toContain('Facturado');
    expect(lis[1].textContent).toContain('—');
    expect(lis[1].textContent).toContain('Pendiente');
  });

  it('escritorio: tabla', async () => {
    await montar(false, [hora('a', true)]);
    expect(el().querySelectorAll('tbody tr')).toHaveLength(1);
    expect(el().querySelector('ul > li')).toBeNull();
  });

  it('sin registros muestra el texto vacío', async () => {
    for (const mobile of [false, true]) {
      await montar(mobile, []);
      expect(el().textContent).toContain('No hay registros de horas declaradas');
    }
  });

  it('móvil: sin violaciones axe', async () => {
    await montar(true, [hora('a', true, 150), hora('b', false)]);
    const v = await analizarA11y(el());
    expect(v, `\n${formatearViolaciones(v)}\n`).toEqual([]);
  });
});
