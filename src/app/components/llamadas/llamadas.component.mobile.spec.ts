import { describe, it, expect, beforeEach, vi } from 'vitest';
import { signal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import type { Timestamp } from '@angular/fire/firestore';
import { LlamadasComponent } from './llamadas.component';
import { LlamadasService } from '../../core/services/llamadas.service';
import type { LlamadaResumen } from '../../interfaces/llamada.interface';
import { analizarA11y, formatearViolaciones } from '../../../testing/axe';

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

function llamada(id: string, o: Partial<LlamadaResumen> = {}): LlamadaResumen {
  return {
    conversationId: id,
    agentId: 'a-1',
    estado: 'completada',
    duracionSegundos: 125,
    resumen: `Resumen ${id}`,
    transcripcion: [{ rol: 'agente', mensaje: 'Hola, ¿en qué puedo ayudar?' }],
    exitosa: true,
    datosCapturados: { nombreCliente: 'Ana Pérez', telefono: '+34 600 111 222', nivelUrgencia: 'alta' },
    creadoEn: { toDate: () => new Date(2026, 8, 1, 10, 30) } as unknown as Timestamp,
    ...o,
  };
}

describe('LlamadasComponent — móvil', () => {
  let fixture: ComponentFixture<LlamadasComponent>;
  const llamadas = signal<LlamadaResumen[]>([]);
  const descartarLlamada = vi.fn().mockResolvedValue(undefined);
  const el = (): HTMLElement => fixture.nativeElement;

  async function montar(mobile: boolean, items: LlamadaResumen[]): Promise<void> {
    TestBed.resetTestingModule();
    mockViewport(mobile);
    llamadas.set(items);
    await TestBed.configureTestingModule({
      imports: [LlamadasComponent],
      providers: [
        {
          provide: LlamadasService,
          useValue: { llamadas, loading: signal(false), loadLlamadas: vi.fn(), descartarLlamada },
        },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(LlamadasComponent);
    fixture.detectChanges();
    await fixture.whenStable();
  }

  beforeEach(() => {
    TestBed.resetTestingModule();
    descartarLlamada.mockClear();
  });

  it('móvil: una tarjeta por llamada con cliente, urgencia, duración y estado', async () => {
    await montar(true, [llamada('c1'), llamada('c2', { estado: 'fallida', exitosa: false })]);
    const items = el().querySelectorAll('ul > li');
    expect(items).toHaveLength(2);
    expect(items[0].textContent).toContain('Ana Pérez');
    expect(items[0].textContent).toContain('alta');
    expect(items[0].textContent).toContain('2:05');
    expect(items[0].textContent).toContain('Completada');
    expect(items[1].textContent).toContain('Fallida');
  });

  it('móvil: el teléfono es un enlace tel: con área táctil', async () => {
    await montar(true, [llamada('c1')]);
    const a = el().querySelector<HTMLAnchorElement>('a[href^="tel:"]')!;
    expect(a.getAttribute('href')).toBe('tel:+34600111222');
    expect(a.className).toContain('tap-target');
  });

  it('móvil: sin teléfono no hay enlace', async () => {
    await montar(true, [llamada('c1', { datosCapturados: {} })]);
    expect(el().querySelector('a[href^="tel:"]')).toBeNull();
    expect(el().textContent).toContain('Cliente desconocido');
  });

  it('escritorio: lista expandible original sin tarjetas ni action-menu', async () => {
    await montar(false, [llamada('c1')]);
    expect(el().querySelector('ul > li')).toBeNull();
    expect(el().querySelector('app-action-menu')).toBeNull();
    expect(el().querySelector('button[aria-expanded]')).not.toBeNull();
  });

  describe('accionesLlamada', () => {
    it('ofrece ver detalle y descartar (peligrosa)', async () => {
      await montar(true, [llamada('c1')]);
      const acciones = fixture.componentInstance.accionesLlamada(llamada('c1'));
      expect(acciones.map((a) => a.id)).toEqual(['detalle', 'descartar']);
      expect(acciones[1].danger).toBe(true);
    });
  });

  it('móvil: ver detalle abre el overlay con la transcripción', async () => {
    await montar(true, [llamada('c1')]);
    fixture.componentInstance.ejecutarAccion(llamada('c1'), 'detalle');
    fixture.detectChanges();
    const dialog = el().querySelector('[role="dialog"]')!;
    expect(dialog).not.toBeNull();
    expect(dialog.textContent).toContain('Hola, ¿en qué puedo ayudar?');
  });

  it('descartar delega en el servicio', async () => {
    await montar(true, [llamada('c1')]);
    fixture.componentInstance.ejecutarAccion(llamada('c1'), 'descartar');
    expect(descartarLlamada).toHaveBeenCalledWith('c1');
  });

  it('axe: sin violaciones en móvil', async () => {
    await montar(true, [llamada('c1'), llamada('c2', { datosCapturados: {} })]);
    const v = await analizarA11y(el());
    expect(v, `\n${formatearViolaciones(v)}\n`).toEqual([]);
  });
});
