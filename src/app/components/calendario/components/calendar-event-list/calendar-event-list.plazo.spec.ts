import { describe, it, expect, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { CalendarEventListComponent } from './calendar-event-list';
import { grupos, plazo, evento } from '../../testing/calendario-fixtures';
import type { CalendarItem } from '../../calendario.types';
import { analizarA11y, formatearViolaciones } from '../../../../../testing/axe';

function montar(...items: CalendarItem[]): HTMLElement {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({ imports: [CalendarEventListComponent], providers: [provideRouter([])] });
  const f = TestBed.createComponent(CalendarEventListComponent);
  f.componentRef.setInput('hasSelectedDates', true);
  f.componentRef.setInput('groupedEvents', grupos(...items));
  f.detectChanges();
  return f.nativeElement as HTMLElement;
}

describe('CalendarEventListComponent — plazos procesales', () => {
  beforeEach(() => TestBed.resetTestingModule());

  it('un plazo muestra etiqueta "Plazo" y enlaza al caso', () => {
    const el = montar(plazo());
    const marca = el.querySelector('[data-plazo]')!;
    expect(marca.textContent).toContain('Plazo');
    const link = el.querySelector<HTMLAnchorElement>('a[href="/casos/caso9"]')!;
    expect(link).not.toBeNull();
    expect(link.getAttribute('aria-label')).toContain('Vence plazo: Contestación');
    expect(el.textContent).not.toContain('Requiere revisión');
  });

  it('un plazo con revisión pendiente muestra el badge de advertencia', () => {
    const el = montar(plazo({ plazo: { requiereRevision: true } }));
    expect(el.querySelector('[data-plazo-revision]')?.textContent).toContain('Requiere revisión');
  });

  it('un evento normal no se marca como plazo', () => {
    const el = montar(evento());
    expect(el.querySelector('[data-plazo]')).toBeNull();
    expect(el.querySelector('a[href^="/casos/"]')).toBeNull();
  });

  it('sin violaciones axe', async () => {
    const el = montar(plazo({ plazo: { requiereRevision: true } }));
    const v = await analizarA11y(el);
    expect(v, formatearViolaciones(v)).toEqual([]);
  });
});
