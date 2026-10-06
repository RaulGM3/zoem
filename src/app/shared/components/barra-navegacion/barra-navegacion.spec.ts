import { describe, it, expect, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { Subject } from 'rxjs';
import {
  Router,
  NavigationStart,
  NavigationEnd,
  NavigationCancel,
  NavigationError,
  NavigationCancellationCode,
  GuardsCheckEnd,
  type Event,
} from '@angular/router';
import { BarraNavegacionComponent, navegandoTras } from './barra-navegacion';

describe('navegandoTras', () => {
  it('empieza a navegar con NavigationStart', () => {
    expect(navegandoTras(new NavigationStart(1, '/casos'), false)).toBe(true);
  });

  it('termina con NavigationEnd, NavigationCancel o NavigationError', () => {
    expect(navegandoTras(new NavigationEnd(1, '/casos', '/casos'), true)).toBe(false);
    expect(
      navegandoTras(new NavigationCancel(1, '/casos', '', NavigationCancellationCode.GuardRejected), true),
    ).toBe(false);
    expect(navegandoTras(new NavigationError(1, '/casos', new Error('x')), true)).toBe(false);
  });

  it('los eventos intermedios mantienen el estado', () => {
    const intermedio = new GuardsCheckEnd(1, '/casos', '/casos', null as never, true);
    expect(navegandoTras(intermedio, true)).toBe(true);
    expect(navegandoTras(intermedio, false)).toBe(false);
  });
});

describe('BarraNavegacionComponent', () => {
  let eventos: Subject<Event>;

  beforeEach(() => {
    eventos = new Subject<Event>();
    TestBed.configureTestingModule({
      imports: [BarraNavegacionComponent],
      providers: [{ provide: Router, useValue: { events: eventos.asObservable() } }],
    });
  });

  function montar() {
    const fixture = TestBed.createComponent(BarraNavegacionComponent);
    fixture.detectChanges();
    const barra = () => fixture.nativeElement.querySelector('[role="progressbar"]') as HTMLElement | null;
    return { fixture, barra };
  }

  it('no muestra nada si no hay navegación en curso', () => {
    expect(montar().barra()).toBeNull();
  });

  it('muestra una barra de progreso accesible mientras se navega y la quita al terminar', () => {
    const { fixture, barra } = montar();

    eventos.next(new NavigationStart(1, '/casos'));
    fixture.detectChanges();
    expect(barra()).not.toBeNull();
    expect(barra()!.getAttribute('aria-label')).toBe('Cargando página');

    eventos.next(new NavigationEnd(1, '/casos', '/casos'));
    fixture.detectChanges();
    expect(barra()).toBeNull();
  });
});
