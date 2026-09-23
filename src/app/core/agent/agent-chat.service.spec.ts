import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { AgentChatService, MAX_VUELTAS } from './agent-chat.service';
import { AgentToolRegistry } from './agent-tool-registry';
import { AiService } from '../services/ai.service';

interface Turno {
  text?: string;
  calls?: { name: string; args: Record<string, unknown> }[];
}

/** Resultado que devuelve el registry falso. */
type FakeRun = (name: string, args: Record<string, unknown>) => Promise<{
  ok: boolean;
  data: Record<string, unknown>;
}>;

/** Modelo falso: devuelve los turnos en orden y repite el último si se pasan. */
function fakeAi(turnos: Turno[]) {
  const sendMessage = vi.fn(async (input: unknown) => {
    void input;
    const t = turnos[Math.min(sendMessage.mock.calls.length - 1, turnos.length - 1)];
    return {
      response: { text: () => t.text ?? '', functionCalls: () => t.calls },
    };
  });
  const startChat = vi.fn(() => ({ sendMessage }));
  return { getToolModel: vi.fn(() => ({ startChat })), startChat, sendMessage };
}

function setup(turnos: Turno[], run: ReturnType<typeof vi.fn<FakeRun>> = vi.fn<FakeRun>(async () => ({ ok: true, data: { total: 1 } }))) {
  const ai = fakeAi(turnos);
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      AgentChatService,
      { provide: AiService, useValue: ai },
      { provide: AgentToolRegistry, useValue: { declarations: () => [], run } },
    ],
  });
  return { chat: TestBed.inject(AgentChatService), ai, run };
}

describe('AgentChatService — conversación simple', () => {
  beforeEach(() => TestBed.resetTestingModule());

  it('añade el mensaje del usuario y la respuesta del modelo', async () => {
    const { chat } = setup([{ text: 'Tienes 3 casos abiertos.' }]);
    await chat.send('¿cuántos casos tengo?');

    expect(chat.mensajes().map((m) => [m.entrante, m.texto])).toEqual([
      [false, '¿cuántos casos tengo?'],
      [true, 'Tienes 3 casos abiertos.'],
    ]);
  });

  it('ignora mensajes vacíos o de solo espacios', async () => {
    const { chat, ai } = setup([{ text: 'hola' }]);
    await chat.send('   ');
    expect(chat.mensajes()).toEqual([]);
    expect(ai.sendMessage).not.toHaveBeenCalled();
  });

  it('baja la bandera de "pensando" al terminar', async () => {
    const { chat } = setup([{ text: 'listo' }]);
    await chat.send('hola');
    expect(chat.pensando()).toBe(false);
  });

  it('limpiar() vacía el historial', async () => {
    const { chat } = setup([{ text: 'hola' }]);
    await chat.send('hola');
    chat.limpiar();
    expect(chat.mensajes()).toEqual([]);
  });
});

describe('AgentChatService — herramientas', () => {
  beforeEach(() => TestBed.resetTestingModule());

  it('ejecuta la tool pedida y devuelve el texto final del modelo', async () => {
    const run = vi.fn<FakeRun>(async () => ({ ok: true, data: { resultados: [{ id: 'c-1' }] } }));
    const { chat } = setup(
      [{ calls: [{ name: 'buscar_casos', args: { consulta: 'villa' } }] }, { text: 'Lo encontré.' }],
      run,
    );

    await chat.send('busca villa garrapata');

    expect(run).toHaveBeenCalledWith('buscar_casos', { consulta: 'villa' });
    expect(chat.mensajes().at(-1)?.texto).toBe('Lo encontré.');
  });

  it('reenvía al modelo el resultado como functionResponse', async () => {
    const run = vi.fn<FakeRun>(async () => ({ ok: true, data: { total: 7 } }));
    const { chat, ai } = setup(
      [{ calls: [{ name: 'buscar_casos', args: {} }] }, { text: 'ok' }],
      run,
    );

    await chat.send('busca');

    expect(ai.sendMessage).toHaveBeenNthCalledWith(2, [
      { functionResponse: { name: 'buscar_casos', response: { total: 7 } } },
    ]);
  });

  it('resuelve varias llamadas de un mismo turno', async () => {
    const run = vi.fn<FakeRun>(async () => ({ ok: true, data: {} }));
    const { chat, ai } = setup(
      [
        {
          calls: [
            { name: 'buscar_casos', args: {} },
            { name: 'buscar_contactos', args: {} },
          ],
        },
        { text: 'ok' },
      ],
      run,
    );

    await chat.send('busca todo');

    expect(run).toHaveBeenCalledTimes(2);
    expect((ai.sendMessage.mock.calls[1]![0] as unknown[]).length).toBe(2);
  });

  it('anota en el mensaje qué acciones se ejecutaron, para que la UI las pueda pintar', async () => {
    const { chat } = setup([{ calls: [{ name: 'abrir_caso', args: {} }] }, { text: 'Abriendo.' }]);
    await chat.send('abre el caso');
    expect(chat.mensajes().at(-1)?.acciones).toEqual(['abrir_caso']);
  });

  it('CORTA a las MAX_VUELTAS si el modelo se queda en bucle llamando tools', async () => {
    const run = vi.fn<FakeRun>(async () => ({ ok: true, data: {} }));
    // El modelo pide tool SIEMPRE: sin tope, esto no termina nunca y factura tokens.
    const { chat, ai } = setup([{ calls: [{ name: 'buscar_casos', args: {} }] }], run);

    await chat.send('bucle');

    expect(run).toHaveBeenCalledTimes(MAX_VUELTAS);
    expect(ai.sendMessage).toHaveBeenCalledTimes(MAX_VUELTAS + 1);
    expect(chat.mensajes().at(-1)?.texto).toMatch(/no he podido/i);
  });
});

describe('AgentChatService — errores', () => {
  beforeEach(() => TestBed.resetTestingModule());

  it('un fallo del modelo no rompe la app: queda en el signal de error', async () => {
    const ai = fakeAi([]);
    ai.sendMessage.mockRejectedValue(new Error('429 quota'));
    TestBed.configureTestingModule({
      providers: [
        AgentChatService,
        { provide: AiService, useValue: ai },
        { provide: AgentToolRegistry, useValue: { declarations: () => [], run: vi.fn() } },
      ],
    });
    const chat = TestBed.inject(AgentChatService);

    await chat.send('hola');

    expect(chat.error()).toContain('429 quota');
    expect(chat.pensando()).toBe(false);
    expect(chat.mensajes().at(-1)?.entrante).toBe(true);
  });
});
