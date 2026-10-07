import { describe, it, expect, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { ItemDetalleDialogComponent } from './item-detalle-dialog';
import { plazo } from '../../testing/calendario-fixtures';
import type { CalendarItem } from '../../calendario.types';

function montar(item: CalendarItem): HTMLElement {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({ imports: [ItemDetalleDialogComponent], providers: [provideRouter([])] });
  const f = TestBed.createComponent(ItemDetalleDialogComponent);
  f.componentRef.setInput('item', item);
  f.detectChanges();
  return f.nativeElement as HTMLElement;
}

describe('ItemDetalleDialogComponent — plazo procesal', () => {
  beforeEach(() => TestBed.resetTestingModule());

  it('muestra "Plazo procesal" y el enlace al caso', () => {
    const el = montar(plazo());
    expect(el.querySelector('[data-plazo]')?.textContent).toContain('Plazo procesal');
    expect(el.querySelector('a[href="/casos/caso9"]')).not.toBeNull();
    expect(el.querySelector('[data-plazo-revision]')).toBeNull();
  });

  it('avisa cuando requiere revisión', () => {
    const el = montar(plazo({ plazo: { requiereRevision: true } }));
    expect(el.querySelector('[data-plazo-revision]')?.textContent).toContain('Requiere revisión');
  });

  it('el resumen del tipo es "Plazo procesal" en vez de "Reunión"', () => {
    const el = montar(plazo());
    expect(el.querySelector('[data-item-resumen]')?.textContent).toContain('Plazo procesal');
    expect(el.querySelector('[data-item-resumen]')?.textContent).not.toContain('Reunión');
  });

  it('un plazo no se puede eliminar ni cambiar de estado desde el calendario', () => {
    const el = montar(plazo());
    expect(el.querySelector('button[aria-label="Eliminar evento"]')).toBeNull();
    expect(el.textContent).not.toContain('Cancelado');
    expect(el.querySelector('[data-plazo-gestionado]')?.textContent).toContain('Este plazo se gestiona desde el caso');
    expect(el.querySelector('[data-plazo-gestionado] a[href="/casos/caso9"]')?.textContent).toContain('Ver caso');
  });

  it('un evento normal conserva el borrado', () => {
    const el = montar({ ...plazo(), plazo: undefined });
    expect(el.querySelector('button[aria-label="Eliminar evento"]')).not.toBeNull();
    expect(el.querySelector('[data-plazo-gestionado]')).toBeNull();
  });
});
