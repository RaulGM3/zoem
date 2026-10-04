import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { CalendarEventListComponent } from './calendar-event-list';
import { grupos, hito } from '../../testing/calendario-fixtures';
import { analizarA11y, formatearViolaciones } from '../../../../../testing/axe';

function setup(): ComponentFixture<CalendarEventListComponent> {
  TestBed.configureTestingModule({ imports: [CalendarEventListComponent] });
  const fixture = TestBed.createComponent(CalendarEventListComponent);
  fixture.componentRef.setInput('hasSelectedDates', true);
  fixture.componentRef.setInput('groupedEvents', grupos(hito({ description: 'Texto largo '.repeat(20) })));
  fixture.detectChanges();
  return fixture;
}

describe('CalendarEventListComponent — móvil', () => {
  beforeEach(() => TestBed.resetTestingModule());

  it('la tarjeta usa padding compacto en móvil y amplio desde sm', () => {
    const el: HTMLElement = setup().nativeElement;
    const card = el.querySelector<HTMLElement>('.space-y-3 > div')!;
    expect(card.className).toContain('p-3');
    expect(card.className).toContain('sm:p-5');
  });

  it('las acciones del hito usan hover de Tailwind y área táctil, y emiten el cambio', () => {
    const f = setup();
    const spy = vi.fn();
    f.componentInstance.hitoStatusChanged.subscribe(e => spy(e));
    const el: HTMLElement = f.nativeElement;
    const accion = Array.from(el.querySelectorAll('button')).find(b => b.textContent?.includes('En proceso'))!;
    expect(accion.className).toContain('hover:');
    expect(accion.className).toContain('tap-target');
    accion.click();
    expect(spy).toHaveBeenCalledWith({ id: 'h1', casoId: 'c1', estado: 'en_progreso' });
  });

  it('sin violaciones axe', async () => {
    const f = setup();
    const violaciones = await analizarA11y(f.nativeElement as HTMLElement);
    expect(violaciones, `\n${formatearViolaciones(violaciones)}\n`).toEqual([]);
  });
});
