import { describe, it, expect, vi, beforeEach } from 'vitest';
import { signal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { Timestamp } from '@angular/fire/firestore';
import { RevisionMovimientosComponent } from './revision-movimientos';
import { GestoriaService } from '../../../../core/services/gestoria.service';
import { CasosService } from '../../../../core/services/casos.service';
import { ToastService } from '../../../../core/services/toast.service';
import { CuentasService } from '../../../../core/services/cuentas.service';
import { UsersService } from '../../../../core/services/users';
import type { MovimientoGestoria } from '../../../../interfaces';
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

const AHORA = Timestamp.fromDate(new Date('2026-01-15T10:00:00Z'));

const MOVS: MovimientoGestoria[] = [
  { id: 'm1', companyId: 'c-1', tipo: 'gasto', concepto: 'Luz', importe: 40, esEntrada: false, fecha: '2026-01-09', createdBy: 'u1', createdAt: AHORA },
];

describe('RevisionMovimientosComponent — móvil', () => {
  let fixture: ComponentFixture<RevisionMovimientosComponent>;
  const el = (): HTMLElement => fixture.nativeElement;

  async function montar(conciliado = true): Promise<void> {
    TestBed.resetTestingModule();
    mockViewport(true);
    await TestBed.configureTestingModule({
      imports: [RevisionMovimientosComponent],
      providers: [
        {
          provide: GestoriaService,
          useValue: { todosMovimientos: signal(MOVS), todosLoading: signal(false), loadTodosMovimientos: vi.fn(), stopTodosMovimientos: vi.fn() },
        },
        { provide: CasosService, useValue: { casos: signal([]) } },
        { provide: ToastService, useValue: { run: vi.fn() } },
        { provide: CuentasService, useValue: { cuentas: signal([]) } },
        { provide: UsersService, useValue: { members: signal([]), loadMembers: vi.fn() } },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(RevisionMovimientosComponent);
    fixture.componentRef.setInput('conciliado', conciliado);
    fixture.detectChanges();
    await fixture.whenStable();
  }

  beforeEach(() => TestBed.resetTestingModule());

  it('el botón de aprobar tiene área táctil mínima', async () => {
    await montar();
    const btn = el().querySelector<HTMLButtonElement>('button[aria-label="Aprobar movimiento"]')!;
    expect(btn.className).toContain('tap-target');
  });

  it('el lápiz de cambiar cuenta es visible sin hover (solo se oculta desde sm)', async () => {
    await montar();
    const btn = el().querySelector<HTMLButtonElement>('button[aria-label="Cambiar cuenta"]')!;
    expect(btn.classList.contains('opacity-0')).toBe(false);
    expect(btn.className).toContain('sm:opacity-0');
    expect(btn.className).toContain('tap-target');
  });

  it('los filtros son botones con aria-pressed y área táctil', async () => {
    await montar();
    const filtros = el().querySelectorAll<HTMLButtonElement>('[data-filtro]');
    expect(filtros).toHaveLength(3);
    expect(filtros[0].getAttribute('aria-pressed')).toBe('true');
    expect(filtros[0].className).toContain('tap-target');
  });

  it('el pie de "Aprobar todos" se apila en móvil', async () => {
    await montar(true);
    const pie = el().querySelector('[data-aprobar-todos]')!;
    expect(pie.className).toContain('flex-col');
    expect(pie.className).toContain('sm:flex-row');
  });

  it('sin violaciones de accesibilidad', async () => {
    await montar();
    const v = await analizarA11y(el());
    expect(v, formatearViolaciones(v)).toEqual([]);
  });
});
