import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { Content } from 'firebase/ai';
import { TestBed } from '@angular/core/testing';
import { AgentChatService, ESPERAS_REINTENTO_MS, MAX_VUELTAS } from './agent-chat.service';
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
  const generateContent = vi.fn(async (req: { contents: Content[] }) => {
    void req;
    const t = turnos[Math.min(generateContent.mock.calls.length - 1, turnos.length - 1)];
    const parts = t.calls?.length
      ? t.calls.map((functionCall) => ({ functionCall }))
      : [{ text: t.text ?? '' }];
    return {
      response: {
        text: () => t.text ?? '',
        functionCalls: () => t.calls,
        candidates: [{ content: { role: 'model', parts } }],
      },
    };
  });
  return { getToolModel: vi.fn(() => ({ generateContent })), generateContent };
}

/** Contenidos que recibió el modelo en la llamada `n` (0-based). */
const contenidosDe = (ai: ReturnType<typeof fakeAi>, n: number) =>
  ai.generateContent.mock.calls[n]![0].contents;

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
    expect(ai.generateContent).not.toHaveBeenCalled();
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

    expect(contenidosDe(ai, 1).at(-1)).toEqual({
      role: 'function',
      parts: [{ functionResponse: { name: 'buscar_casos', response: { total: 7 } } }],
    });
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
    expect(contenidosDe(ai, 1).at(-1)?.parts).toHaveLength(2);
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
    expect(ai.generateContent).toHaveBeenCalledTimes(MAX_VUELTAS + 1);
    expect(chat.mensajes().at(-1)?.texto).toMatch(/no he podido/i);
  });
});

describe('AgentChatService — errores', () => {
  beforeEach(() => {
    TestBed.resetTestingModule();
    vi.useFakeTimers();
  });
  afterEach(() => vi.useRealTimers());

  const saturado = () =>
    Object.assign(new Error('AI: Error fetching from https://x: [429 ] Resource exhausted. (AI/fetch-error)'), {
      customErrorData: { status: 429 },
    });

  /** `send` espera entre reintentos: hay que avanzar el reloj falso. */
  async function enviar(chat: AgentChatService, texto: string) {
    const p = chat.send(texto);
    await vi.runAllTimersAsync();
    await p;
  }

  it('un fallo del modelo no rompe la app: queda en el signal de error, en lenguaje humano', async () => {
    const { chat, ai } = setup([]);
    ai.generateContent.mockRejectedValue(saturado());

    await enviar(chat, 'hola');

    expect(chat.error()).toMatch(/saturado/i);
    expect(chat.error()).not.toMatch(/https?:\/\//);
    expect(chat.pensando()).toBe(false);
  });

  it('el error se avisa UNA vez: en el banner, sin duplicarlo como burbuja del agente', async () => {
    const { chat, ai } = setup([]);
    ai.generateContent.mockRejectedValue(saturado());

    await enviar(chat, 'hola');

    expect(chat.mensajes().map((m) => m.entrante)).toEqual([false]);
  });

  it('reintenta solo ante saturación (429) y sale adelante si el modelo se recupera', async () => {
    const { chat, ai } = setup([{ text: 'Ya está.' }]);
    ai.generateContent.mockRejectedValueOnce(saturado());

    await enviar(chat, 'hola');

    expect(ai.generateContent).toHaveBeenCalledTimes(2);
    expect(chat.error()).toBeNull();
    expect(chat.mensajes().at(-1)?.texto).toBe('Ya está.');
  });

  it('se rinde tras agotar los reintentos', async () => {
    const { chat, ai } = setup([]);
    ai.generateContent.mockRejectedValue(saturado());

    await enviar(chat, 'hola');

    expect(ai.generateContent).toHaveBeenCalledTimes(ESPERAS_REINTENTO_MS.length + 1);
  });

  it('NO reintenta errores que no son de saturación', async () => {
    const { chat, ai } = setup([]);
    ai.generateContent.mockRejectedValue(new Error('[400 ] Invalid argument'));

    await enviar(chat, 'hola');

    expect(ai.generateContent).toHaveBeenCalledTimes(1);
    expect(chat.error()).toMatch(/no he podido contactar/i);
  });

  it('el reintento tras una tool NO vuelve a ejecutarla: reenvía el mismo resultado', async () => {
    const run = vi.fn<FakeRun>(async () => ({ ok: true, data: { abierto: true } }));
    const { chat, ai } = setup([{ calls: [{ name: 'abrir_contacto', args: {} }] }, { text: 'Abierto.' }], run);
    ai.generateContent
      .mockImplementationOnce(ai.generateContent.getMockImplementation()!)
      .mockRejectedValueOnce(saturado());

    await enviar(chat, 'abre a Juan');

    expect(run).toHaveBeenCalledTimes(1);
    expect(contenidosDe(ai, 2)).toEqual(contenidosDe(ai, 1));
    expect(chat.mensajes().at(-1)?.texto).toBe('Abierto.');
  });

  it('si la acción YA se hizo y luego falla, lo dice sin ofrecer repetirla', async () => {
    const run = vi.fn<FakeRun>(async () => ({ ok: true, data: {} }));
    const { chat, ai } = setup([{ calls: [{ name: 'abrir_contacto', args: {} }] }], run);
    ai.generateContent
      .mockImplementationOnce(ai.generateContent.getMockImplementation()!)
      .mockRejectedValue(saturado());

    await enviar(chat, 'abre a Juan');

    const ultimo = chat.mensajes().at(-1);
    expect(ultimo?.entrante).toBe(true);
    expect(ultimo?.acciones).toEqual(['abrir_contacto']);
    expect(ultimo?.texto).toMatch(/revisa la pantalla/i);
    expect(chat.error()).toBeNull();
    expect(chat.puedeReintentar()).toBe(false);
  });

  it('reintentar() reenvía la última pregunta sin duplicar la burbuja del usuario', async () => {
    const { chat, ai } = setup([{ text: 'Ahora sí.' }]);
    ai.generateContent.mockRejectedValueOnce(new Error('[500 ] Internal'));
    await enviar(chat, 'hola');
    expect(chat.puedeReintentar()).toBe(true);

    const p = chat.reintentar();
    await vi.runAllTimersAsync();
    await p;

    expect(chat.mensajes().map((m) => [m.entrante, m.texto])).toEqual([
      [false, 'hola'],
      [true, 'Ahora sí.'],
    ]);
    expect(chat.error()).toBeNull();
    expect(chat.puedeReintentar()).toBe(false);
  });

  it('limpiar() también olvida el error y la opción de reintentar', async () => {
    const { chat, ai } = setup([]);
    ai.generateContent.mockRejectedValue(new Error('[500 ] Internal'));
    await enviar(chat, 'hola');

    chat.limpiar();

    expect(chat.error()).toBeNull();
    expect(chat.puedeReintentar()).toBe(false);
  });
});

describe('AgentChatService — instrucciones del sistema', () => {
  beforeEach(() => TestBed.resetTestingModule());

  /** El prompt es el segundo argumento de `getToolModel`. */
  const promptDe = (ai: ReturnType<typeof fakeAi>) =>
    String((ai.getToolModel.mock.calls as unknown as unknown[][])[0][1]);

  it('obliga a consultar las guías antes de explicar cómo se usa la aplicación', async () => {
    const { chat, ai } = setup([{ text: 'ok' }]);
    await chat.send('¿cómo creo un caso?');

    const prompt = promptDe(ai);
    expect(prompt).toContain('consultar_ayuda');
    expect(prompt).toMatch(/nunca expliques pasos de memoria/i);
  });

  it('añade el contexto vivo detrás de las reglas', async () => {
    const { chat, ai } = setup([{ text: 'ok' }]);
    await chat.send('hola', { contexto: 'Pantalla: /casos' });

    expect(promptDe(ai)).toContain('Contexto actual:\nPantalla: /casos');
  });
});
