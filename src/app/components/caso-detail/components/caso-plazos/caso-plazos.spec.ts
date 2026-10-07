import { describe, expect, it, vi } from 'vitest';
import { of } from 'rxjs';
import { TestBed } from '@angular/core/testing';
import { CasoPlazosComponent } from './caso-plazos';
import { PlazosService } from '../../../../core/services/plazos.service';
import { ToastService } from '../../../../core/services/toast.service';
import type { Evento } from '../../../../interfaces/evento.interface';
import { analizarA11y, formatearViolaciones } from '../../../../../testing/axe';

const plazo = (id: string, fecha: string, estadoPlazo: string, titulo = `Vence plazo: ${id}`): Evento =>
  ({
    id, titulo, fecha,
    origen: {
      tipo: 'plazo_procesal', casoId: 'caso1', capas: { ca: 'ca-madrid' },
      entrada: { fechaNotificacion: '2026-10-01', cantidad: 10, unidad: 'dias', jurisdiccion: 'civil' },
      aceptacion: { diasInhabiles: [], excluidosPorUsuario: [], aceptadoPor: 'u1', aceptadoAt: '', vencimiento: fecha },
      estadoPlazo,
      ...(estadoPlazo === 'requiere_revision' ? { revision: { vencimientoNuevo: '2026-11-03', seAdelanta: false, detectadoAt: '' } } : {}),
    },
  }) as unknown as Evento;

const PLAZOS = [plazo('b', '2026-11-02', 'vigente'), plazo('a', '2026-10-21', 'requiere_revision'), plazo('c', '2026-10-10', 'cumplido')];

async function montar(canEdit = true) {
  const marcarCumplido = vi.fn().mockResolvedValue(undefined);
  TestBed.resetTestingModule();
  await TestBed.configureTestingModule({
    imports: [CasoPlazosComponent],
    providers: [
      { provide: PlazosService, useValue: { plazosDelCaso: vi.fn(() => of(PLAZOS)), marcarCumplido, previsualizar: vi.fn(), guardar: vi.fn(), aceptarRevision: vi.fn() } },
      { provide: ToastService, useValue: { run: async (fn: () => Promise<unknown>) => { await fn(); return true; } } },
    ],
  }).compileComponents();
  const f = TestBed.createComponent(CasoPlazosComponent);
  f.componentRef.setInput('caso', { id: 'caso1', titulo: 'Caso', jurisdiccion: 'civil' });
  f.componentRef.setInput('canEdit', canEdit);
  f.detectChanges();
  await f.whenStable();
  f.detectChanges();
  return { f, el: f.nativeElement as HTMLElement, marcarCumplido };
}

describe('CasoPlazosComponent', () => {
  it('lista los plazos ordenados por vencimiento con su estado', async () => {
    const { el } = await montar();
    const filas = Array.from(el.querySelectorAll('[data-plazo]'));
    expect(filas.map((r) => r.getAttribute('data-plazo'))).toEqual(['c', 'a', 'b']);
    expect(filas[1].textContent).toContain('21/10/2026');
    expect(filas[1].textContent).toContain('Requiere revisión');
    expect(filas[0].textContent).toContain('Cumplido');
    expect(filas[2].textContent).toContain('Vigente');
  });

  it('botón "Nuevo plazo" con distintivo BETA que abre el drawer', async () => {
    const { f, el } = await montar();
    const btn = el.querySelector<HTMLButtonElement>('[data-nuevo-plazo]')!;
    expect(btn.textContent).toContain('Nuevo plazo');
    expect(el.textContent).toContain('BETA');
    btn.click();
    f.detectChanges();
    expect(el.querySelector('[role="dialog"]')).not.toBeNull();
    expect(el.textContent).toContain('Nuevo plazo (BETA)');
  });

  it('"Revisar" abre el drawer en modo revisión solo para plazos que lo requieren', async () => {
    const { f, el } = await montar();
    expect(el.querySelectorAll('[data-revisar]')).toHaveLength(1);
    el.querySelector<HTMLButtonElement>('[data-revisar]')!.click();
    f.detectChanges();
    expect(el.textContent).toContain('Revisar plazo (BETA)');
  });

  it('"Marcar cumplido" solo en plazos no cumplidos y llama al servicio', async () => {
    const { el, marcarCumplido } = await montar();
    const botones = el.querySelectorAll<HTMLButtonElement>('[data-cumplido]');
    expect(botones).toHaveLength(2);
    botones[0].click();
    expect(marcarCumplido).toHaveBeenCalledWith('a');
  });

  it('sin permiso de edición no hay acciones', async () => {
    const { el } = await montar(false);
    expect(el.querySelector('[data-nuevo-plazo]')).toBeNull();
    expect(el.querySelector('[data-revisar]')).toBeNull();
    expect(el.querySelector('[data-cumplido]')).toBeNull();
    expect(el.querySelectorAll('[data-plazo]')).toHaveLength(3);
  });

  it('sin violaciones de accesibilidad', async () => {
    const { el } = await montar();
    const v = await analizarA11y(el);
    expect(v, `\n${formatearViolaciones(v)}\n`).toEqual([]);
  });
});
