import { describe, it, expect, beforeEach, vi } from 'vitest';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { AgentChatService } from '../../core/agent/agent-chat.service';
import { PermissionService } from '../../core/services/permission.service';
import { GRABADOR, type Grabador } from '../../core/voz/grabador.port';
import { TranscripcionService } from '../../core/voz/transcripcion.service';
import { PlanService } from '../../core/planes/plan.service';
import { UsoService } from '../../core/planes/uso.service';
import { AgenteChatComponent, SUGERENCIAS, estaPegadoAbajo } from './agente-chat';

function montar() {
  const send = vi.fn(async () => {});
  const chat = {
    mensajes: signal([]),
    pensando: signal(false),
    error: signal<string | null>(null),
    puedeReintentar: signal(false),
    send,
    limpiar: vi.fn(),
    reintentar: vi.fn(async () => {}),
  };

  const grabador = { soportado: () => true, iniciar: vi.fn() } as unknown as Grabador;

  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    imports: [AgenteChatComponent],
    providers: [
      { provide: AgentChatService, useValue: chat },
      { provide: Router, useValue: { url: '/casos' } },
      { provide: PermissionService, useValue: { userRole: signal('admin') } },
      { provide: GRABADOR, useValue: grabador },
      { provide: TranscripcionService, useValue: { transcribir: vi.fn() } },
      { provide: PlanService, useValue: { limite: () => 30 } },
      { provide: UsoService, useValue: { usado: () => 12 } },
    ],
  });

  const fixture = TestBed.createComponent(AgenteChatComponent);
  fixture.detectChanges();
  return { fixture, componente: fixture.componentInstance, chat, send };
}

const textarea = (f: ReturnType<typeof montar>['fixture']) =>
  f.nativeElement.querySelector('textarea') as HTMLTextAreaElement;

describe('SUGERENCIAS — preguntas de ayuda', () => {
  const deAyuda = SUGERENCIAS.soporte.filter((s) => /^¿(Cómo|Para qué)/.test(s));

  it('el modo soporte ofrece preguntas de "¿cómo hago…?"', () => {
    expect(deAyuda.length).toBeGreaterThanOrEqual(2);
  });

  it('las preguntas de ayuda no llevan huecos: se envían tal cual', () => {
    // Un hueco es una palabra de 2+ letras en MAYÚSCULAS (ver `huecoRegex`).
    for (const pregunta of deAyuda) expect(pregunta).not.toMatch(/[A-ZÑ]{2,}/);
  });
});

describe('AgenteChatComponent — cupo de IA', () => {
  beforeEach(() => TestBed.resetTestingModule());

  it('muestra cuántos mensajes de IA lleva el mes', () => {
    const { fixture } = montar();
    expect(fixture.nativeElement.querySelector('app-cupo')?.textContent).toContain('12/30 mensajes de IA este mes');
  });
});

describe('AgenteChatComponent — dictado por voz', () => {
  beforeEach(() => TestBed.resetTestingModule());

  it('el dictado NUNCA envía el mensaje: solo lo deja en el input', () => {
    const { fixture, componente, send } = montar();

    componente.onTranscrito('Créame un caso de tipo civil para Juan Pérez');
    fixture.detectChanges();

    expect(send).not.toHaveBeenCalled();
    expect(componente.inputText()).toBe('Créame un caso de tipo civil para Juan Pérez');
    expect(textarea(fixture).value).toBe('Créame un caso de tipo civil para Juan Pérez');
  });

  it('respeta lo que el usuario ya había escrito', () => {
    const { fixture, componente } = montar();
    const el = textarea(fixture);

    el.value = 'Busca el caso';
    el.setSelectionRange(13, 13);
    componente.onInput({ target: el } as unknown as Event);

    componente.onTranscrito('de Juan Pérez');
    fixture.detectChanges();

    expect(componente.inputText()).toBe('Busca el caso de Juan Pérez');
  });

  it('el dictado rellena el hueco seleccionado de una sugerencia', () => {
    const { fixture, componente } = montar();
    const el = textarea(fixture);

    componente.usarSugerencia('Busca el contacto de NOMBRE');
    expect(el.selectionStart).toBe(21);

    componente.onTranscrito('Juan Pérez');
    fixture.detectChanges();

    expect(componente.inputText()).toBe('Busca el contacto de Juan Pérez');
  });

  it('devuelve el foco al textarea con el cursor tras lo dictado', () => {
    const { fixture, componente } = montar();

    componente.onTranscrito('Hola');
    fixture.detectChanges();

    const el = textarea(fixture);
    expect(document.activeElement).toBe(el);
    expect(el.selectionStart).toBe(4);
  });

  it('el botón de micro se bloquea mientras el agente responde', () => {
    const { fixture, chat } = montar();
    const micro = () =>
      fixture.nativeElement.querySelector('app-boton-dictado button') as HTMLButtonElement;

    expect(micro().disabled).toBe(false);

    chat.pensando.set(true);
    fixture.detectChanges();

    expect(micro().disabled).toBe(true);
  });
});

/**
 * jsdom no calcula layout: `scrollHeight` y `clientHeight` valen 0 siempre, así
 * que "¿bajó el scroll?" no se puede afirmar montando el componente. Por eso la
 * decisión vive en una función pura y se prueba aquí, que es donde sí dice algo.
 */
describe('estaPegadoAbajo', () => {
  const medidas = (scrollHeight: number, scrollTop: number, clientHeight: number) =>
    ({ scrollHeight, scrollTop, clientHeight });

  it('exactamente al fondo', () => {
    expect(estaPegadoAbajo(medidas(1000, 600, 400))).toBe(true);
  });

  it('a unos píxeles del fondo sigue contando como estar abajo', () => {
    expect(estaPegadoAbajo(medidas(1000, 560, 400))).toBe(true);
  });

  it('justo en el límite del margen', () => {
    expect(estaPegadoAbajo(medidas(1000, 520, 400))).toBe(true);
  });

  it('un píxel más arriba del margen: el usuario está leyendo, no seguirle', () => {
    expect(estaPegadoAbajo(medidas(1000, 519, 400))).toBe(false);
  });

  it('leyendo el principio de una conversación larga', () => {
    expect(estaPegadoAbajo(medidas(5000, 0, 400))).toBe(false);
  });

  it('si el contenido no desborda, siempre se está abajo', () => {
    expect(estaPegadoAbajo(medidas(400, 0, 400))).toBe(true);
    expect(estaPegadoAbajo(medidas(0, 0, 0))).toBe(true);
  });
});

/**
 * Estos tests miran CLASES, que normalmente sería un olor a test frágil. Van
 * aquí porque el bug ya ocurrió: el composer flotaba en `absolute` y el área de
 * mensajes llevaba `pb-44`, y dentro del panel flotante (640px de alto) eso
 * dejaba el chat SIN scroll posible y con las sugerencias tapadas.
 *
 * jsdom no calcula layout, así que no se puede afirmar "scrollea" de verdad.
 * Lo que sí se puede fijar es la ESTRUCTURA que lo hace posible a cualquier
 * altura, que es justo lo que se rompió.
 */
describe('AgenteChatComponent — estructura de scroll', () => {
  beforeEach(() => TestBed.resetTestingModule());

  const log = (f: ReturnType<typeof montar>['fixture']) =>
    f.nativeElement.querySelector('[role="log"]') as HTMLElement;

  it('el área de mensajes es un contenedor de scroll que absorbe el espacio', () => {
    const { fixture } = montar();

    expect(log(fixture).classList.contains('overflow-y-auto')).toBe(true);
    expect(log(fixture).classList.contains('flex-1')).toBe(true);
    // Sin `min-h-0` un hijo flex no baja de su tamaño de contenido.
    expect(log(fixture).classList.contains('min-h-0')).toBe(true);
  });

  it('el composer va en flujo: NUNCA superpuesto al área de mensajes', () => {
    const { fixture } = montar();
    const composer = fixture.nativeElement
      .querySelector('textarea')
      .closest('div.shrink-0') as HTMLElement;

    expect(composer).toBeTruthy();
    expect(composer.classList.contains('absolute')).toBe(false);
    // El relleno inferior gigante existía solo para dejar hueco al composer
    // flotante. Si vuelve, vuelve el bug.
    expect(log(fixture).className).not.toMatch(/\bpb-(2[0-9]|[3-9][0-9])\b/);
  });
});

describe('AgenteChatComponent — avisos de error', () => {
  beforeEach(() => TestBed.resetTestingModule());

  const banner = (f: ReturnType<typeof montar>['fixture']) =>
    f.nativeElement.querySelector('[role="alert"]') as HTMLElement | null;

  it('muestra el error en un aviso con botón para reintentar', () => {
    const { fixture, chat } = montar();
    chat.error.set('El asistente está saturado ahora mismo.');
    chat.puedeReintentar.set(true);
    fixture.detectChanges();

    const boton = banner(fixture)?.querySelector('button') as HTMLButtonElement;
    expect(banner(fixture)?.textContent).toContain('saturado');
    boton.click();
    expect(chat.reintentar).toHaveBeenCalled();
  });

  it('sin opción de reintento, el aviso no ofrece el botón', () => {
    const { fixture, chat } = montar();
    chat.error.set('Algo ha fallado.');
    fixture.detectChanges();

    expect(banner(fixture)?.querySelector('button')).toBeNull();
  });

  it('un texto larguísimo sin espacios (una URL) parte línea en vez de desbordar', () => {
    const { fixture, chat } = montar();
    (chat.mensajes as ReturnType<typeof signal<unknown[]>>).set([
      { id: '1', texto: 'https://' + 'x'.repeat(300), entrante: true, hora: '17:05' },
    ]);
    fixture.detectChanges();

    const log = fixture.nativeElement.querySelector('[role="log"]') as HTMLElement;
    expect(log.className).toContain('overflow-x-hidden');
    expect(log.querySelector('p')?.className).toContain('[overflow-wrap:anywhere]');
  });
});
