import { describe, it, expect, beforeEach } from 'vitest';
import { DeferBlockBehavior, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { Subject } from 'rxjs';
import { AgenteLanzadorComponent } from './agente-lanzador';

/**
 * OJO con lo que NO se provee aquí.
 *
 * Estos tests montan el lanzador SIN `AgentChatService`, sin `GRABADOR` y sin
 * `TranscripcionService`. Si alguien hiciera que el lanzador inyectara la
 * cadena pesada del agente, estos tests reventarían con NG0201 — y ese es
 * justamente el punto: el lanzador tiene que ser barato o no sirve de nada.
 */
async function montar(url = '/casos') {
  const events = new Subject<unknown>();
  const router = { url, events: events.asObservable() };

  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    imports: [AgenteLanzadorComponent],
    providers: [{ provide: Router, useValue: router }],
    // Sin esto, TestBed RENDERIZA el bloque diferido y con él todo el agente,
    // que aquí no está provisto a propósito. Lo que se prueba en este archivo
    // es la máquina de estados del lanzador; lo que el panel pinta ya lo cubre
    // `agente-panel.spec.ts`.
    deferBlockBehavior: DeferBlockBehavior.Manual,
  });

  // El bloque `@defer` compila el panel como import dinámico, y eso obliga a
  // compilar de forma asíncrona. Que este `await` haga falta es, de hecho, la
  // señal de que el defer es real y no se ha colapsado en este chunk.
  await TestBed.compileComponents();

  const fixture = TestBed.createComponent(AgenteLanzadorComponent);
  fixture.detectChanges();
  return { fixture, componente: fixture.componentInstance };
}

type Fixture = Awaited<ReturnType<typeof montar>>['fixture'];

const q = (f: Fixture, sel: string) => f.nativeElement.querySelector(sel) as HTMLElement | null;
const fab = (f: Fixture) => q(f, '[data-test="fab"]') as HTMLButtonElement;

describe('AgenteLanzadorComponent', () => {
  beforeEach(() => TestBed.resetTestingModule());

  it('se monta sin la cadena pesada del agente', async () => {
    const { fixture } = await montar();

    expect(fab(fixture)).toBeTruthy();
  });

  it('NO carga el panel hasta que se interactúa', async () => {
    const { fixture } = await montar();

    expect(q(fixture, 'app-agente-panel')).toBeNull();
    expect(q(fixture, 'app-agente-chat')).toBeNull();
  });

  it('el botón flotante tiene nombre accesible y estado de despliegue', async () => {
    const { fixture } = await montar();

    expect(fab(fixture).getAttribute('aria-label')).toBeTruthy();
    expect(fab(fixture).getAttribute('aria-expanded')).toBe('false');
  });

  it('un solo clic abre el chat: sin menú intermedio', async () => {
    const { fixture, componente } = await montar();

    fab(fixture).click();
    fixture.detectChanges();

    expect(componente.abierto()).toBe(true);
    expect(fab(fixture).getAttribute('aria-expanded')).toBe('true');
  });

  it('vuelve a pulsarlo y lo cierra', async () => {
    const { fixture, componente } = await montar();

    fab(fixture).click();
    fixture.detectChanges();
    fab(fixture).click();
    fixture.detectChanges();

    expect(componente.abierto()).toBe(false);
    expect(fab(fixture).getAttribute('aria-expanded')).toBe('false');
  });

  it('la etiqueta dice qué va a pasar al pulsarlo', async () => {
    const { fixture } = await montar();
    const cerrado = fab(fixture).getAttribute('aria-label');

    fab(fixture).click();
    fixture.detectChanges();

    expect(fab(fixture).getAttribute('aria-label')).not.toBe(cerrado);
  });

  it('`cerrar` deja el panel cerrado', async () => {
    const { fixture, componente } = await montar();

    fab(fixture).click();
    fixture.detectChanges();
    componente.cerrar();

    expect(componente.abierto()).toBe(false);
  });

  it('no se pinta en la propia página del agente: sobraría', async () => {
    const { fixture } = await montar('/agente-ia');

    expect(fab(fixture)).toBeNull();
  });
});
