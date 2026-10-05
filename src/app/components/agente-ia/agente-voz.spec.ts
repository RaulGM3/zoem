import { describe, it, expect, beforeEach, vi } from 'vitest';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { NavigationEnd, Router } from '@angular/router';
import { Subject } from 'rxjs';
import { AgentChatService, type ChatMensaje } from '../../core/agent/agent-chat.service';
import { PermissionService } from '../../core/services/permission.service';
import { DictadoService } from '../../core/voz/dictado.service';
import { fakeDictado } from '../../../testing/fake-dictado';
import { AgenteVozComponent, faseVoz } from './agente-voz';

function montar({ soportado = true } = {}) {
  const dictado = fakeDictado(soportado);
  const mensajes = signal<ChatMensaje[]>([]);
  const pensando = signal(false);
  let terminar: () => void = () => {};
  const send = vi.fn(() => {
    pensando.set(true);
    return new Promise<void>((r) => (terminar = r));
  });
  const chat = { mensajes, pensando, error: signal<string | null>(null), send, limpiar: vi.fn() };

  const events = new Subject<unknown>();

  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    imports: [AgenteVozComponent],
    providers: [
      { provide: AgentChatService, useValue: chat },
      { provide: Router, useValue: { url: '/casos', events: events.asObservable() } },
      { provide: PermissionService, useValue: { userRole: signal('admin') } },
    ],
  });
  TestBed.overrideComponent(AgenteVozComponent, {
    set: { providers: [{ provide: DictadoService, useValue: dictado }] },
  });

  const fixture = TestBed.createComponent(AgenteVozComponent);
  fixture.detectChanges();

  /** El agente termina de pensar y deja `texto` como respuesta. */
  const responder = async (texto: string) => {
    mensajes.update((m) => [...m, { id: 'r', texto, entrante: true, hora: '' }]);
    pensando.set(false);
    terminar();
    await fixture.whenStable();
    fixture.detectChanges();
  };

  return { fixture, componente: fixture.componentInstance, dictado, chat, send, events, responder };
}

type Fixture = ReturnType<typeof montar>['fixture'];

const q = <T extends HTMLElement>(f: Fixture, sel: string) =>
  f.nativeElement.querySelector(sel) as T | null;
const textarea = (f: Fixture) => q<HTMLTextAreaElement>(f, 'textarea');
const boton = (f: Fixture, test: string) => q<HTMLButtonElement>(f, `[data-test="${test}"]`);

async function transcribir(f: Fixture, dictado: ReturnType<typeof fakeDictado>, texto: string) {
  dictado.transcribir(texto);
  await f.whenStable();
  f.detectChanges();
}

describe('faseVoz', () => {
  it.each([
    ['permiso', false, false, 'dictando'],
    ['grabando', false, false, 'dictando'],
    ['transcribiendo', false, false, 'dictando'],
    ['inactivo', false, false, 'editando'],
    ['error', false, false, 'editando'],
    ['inactivo', true, false, 'pensando'],
    ['inactivo', false, true, 'respuesta'],
    ['grabando', false, true, 'dictando'],
  ] as const)('%s / pensando=%s / respuesta=%s → %s', (estado, pensando, respuesta, fase) => {
    expect(faseVoz(estado, pensando, respuesta)).toBe(fase);
  });
});

describe('AgenteVozComponent', () => {
  beforeEach(() => TestBed.resetTestingModule());

  it('arranca a grabar nada más abrirse', () => {
    const { dictado, fixture } = montar();

    expect(dictado.alternar).toHaveBeenCalledTimes(1);
    expect(boton(fixture, 'micro')?.getAttribute('aria-pressed')).toBe('true');
  });

  it('la transcripción aparece en un input editable y NO se envía sola', async () => {
    const { fixture, dictado, send } = montar();

    await transcribir(fixture, dictado, 'Llévame a facturación');

    expect(textarea(fixture)?.value).toBe('Llévame a facturación');
    expect(textarea(fixture)?.readOnly).toBe(false);
    expect(send).not.toHaveBeenCalled();
  });

  it('"Ejecutar" manda el texto EDITADO en modo acciones con contexto', async () => {
    const { fixture, componente, dictado, send } = montar();
    await transcribir(fixture, dictado, 'Abre el caso de Juan Peres');

    const el = textarea(fixture)!;
    el.value = 'Abre el caso de Juan Pérez';
    el.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    boton(fixture, 'ejecutar')!.click();
    fixture.detectChanges();

    expect(componente.inputText()).toBe('Abre el caso de Juan Pérez');
    expect(send).toHaveBeenCalledWith('Abre el caso de Juan Pérez', {
      soloLectura: false,
      contexto: expect.stringContaining('/casos'),
    });
  });

  it('"Ejecutar" está deshabilitado con el input vacío', async () => {
    const { fixture, dictado } = montar();
    await transcribir(fixture, dictado, '   ');

    expect(boton(fixture, 'ejecutar')?.disabled).toBe(true);
  });

  it('muestra "Pensando…" y después la respuesta del agente', async () => {
    const { fixture, dictado, responder } = montar();
    await transcribir(fixture, dictado, '¿Cuántos casos urgentes hay?');

    boton(fixture, 'ejecutar')!.click();
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Pensando');

    await responder('Tienes 3 casos urgentes abiertos.');
    expect(q(fixture, '[data-test="respuesta"]')?.textContent).toContain('Tienes 3 casos urgentes');
  });

  it('"Ver conversación" pide abrir el chat completo', async () => {
    const { fixture, componente, dictado, responder } = montar();
    const ver = vi.fn();
    componente.verConversacion.subscribe(ver);
    await transcribir(fixture, dictado, 'Hola');
    boton(fixture, 'ejecutar')!.click();
    await responder('Hola, ¿en qué te ayudo?');

    boton(fixture, 'ver-conversacion')!.click();

    expect(ver).toHaveBeenCalled();
  });

  it('"Dictar otra vez" limpia el input y vuelve a grabar', async () => {
    const { fixture, componente, dictado, responder } = montar();
    await transcribir(fixture, dictado, 'Hola');
    boton(fixture, 'ejecutar')!.click();
    await responder('Hola');

    boton(fixture, 'dictar-otra-vez')!.click();
    fixture.detectChanges();

    expect(componente.inputText()).toBe('');
    expect(dictado.alternar).toHaveBeenCalledTimes(2);
    expect(q(fixture, '[data-test="respuesta"]')).toBeNull();
  });

  it('si el agente navega tras ejecutar, la hoja se cierra', async () => {
    const { fixture, componente, dictado, events } = montar();
    const cerrado = vi.fn();
    componente.cerrado.subscribe(cerrado);
    await transcribir(fixture, dictado, 'Llévame a facturación');

    boton(fixture, 'ejecutar')!.click();
    events.next(new NavigationEnd(1, '/facturacion', '/facturacion'));

    expect(cerrado).toHaveBeenCalled();
  });

  it('una navegación ANTES de ejecutar no la cierra', () => {
    const { componente, events } = montar();
    const cerrado = vi.fn();
    componente.cerrado.subscribe(cerrado);

    events.next(new NavigationEnd(1, '/facturacion', '/facturacion'));

    expect(cerrado).not.toHaveBeenCalled();
  });

  it('"Cancelar" corta el dictado y cierra', () => {
    const { fixture, componente, dictado } = montar();
    const cerrado = vi.fn();
    componente.cerrado.subscribe(cerrado);

    boton(fixture, 'cancelar')!.click();

    expect(dictado.cancelar).toHaveBeenCalled();
    expect(cerrado).toHaveBeenCalled();
  });

  it('Escape también cierra', () => {
    const { fixture, componente } = montar();
    const cerrado = vi.fn();
    componente.cerrado.subscribe(cerrado);

    q(fixture, '[role="dialog"]')!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));

    expect(cerrado).toHaveBeenCalled();
  });

  it('al destruirse cancela el dictado: el audio no sale si se cierra a medias', () => {
    const { fixture, dictado } = montar();

    fixture.destroy();

    expect(dictado.cancelar).toHaveBeenCalled();
  });

  it('si falla el micro, se puede escribir y se ve el error', async () => {
    const { fixture, dictado } = montar();

    dictado.fallar('Has denegado el permiso del micrófono.');
    await fixture.whenStable();
    fixture.detectChanges();

    expect(textarea(fixture)).toBeTruthy();
    expect(q(fixture, '[role="alert"]')?.textContent).toContain('denegado');
  });

  it('sin soporte de micro: no graba, no hay botón de micro y el input tiene el foco', async () => {
    const { fixture, dictado } = montar({ soportado: false });
    await fixture.whenStable();

    expect(dictado.alternar).not.toHaveBeenCalled();
    expect(boton(fixture, 'micro')).toBeNull();
    expect(document.activeElement).toBe(textarea(fixture));
  });
});
