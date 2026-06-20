import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ToastService } from './toast.service';

describe('ToastService.run (envoltura con reintento)', () => {
  let toast: ToastService;

  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    toast = new ToastService();
  });

  it('acción OK → devuelve el resultado y NO crea toast de error', async () => {
    const result = await toast.run(async () => 42);
    expect(result).toBe(42);
    expect(toast.toasts().some((t) => t.type === 'error')).toBe(false);
  });

  it('acción OK con successMessage → muestra toast verde', async () => {
    await toast.run(async () => 'ok', { successMessage: 'Guardado' });
    const success = toast.toasts().find((t) => t.type === 'success');
    expect(success?.message).toBe('Guardado');
  });

  it('acción que falla → toast de error con botón de reintento y devuelve undefined', async () => {
    const result = await toast.run(async () => {
      throw new Error('boom');
    });
    expect(result).toBeUndefined();
    const err = toast.toasts().find((t) => t.type === 'error');
    expect(err).toBeDefined();
    expect(typeof err?.retry).toBe('function');
  });

  it('el reintento RE-EJECUTA la misma acción', async () => {
    let attempts = 0;
    const action = vi.fn(async () => {
      attempts++;
      if (attempts < 2) throw new Error('fail once');
      return 'recuperado';
    });

    await toast.run(action);
    expect(attempts).toBe(1);

    const errToast = toast.toasts().find((t) => t.type === 'error');
    errToast?.retry?.();
    await vi.waitFor(() => expect(attempts).toBe(2));
    expect(action).toHaveBeenCalledTimes(2);
  });

  it('onSuccess se llama SOLO si la acción termina bien', async () => {
    const onSuccess = vi.fn();
    await toast.run(async () => 'ok', { onSuccess });
    expect(onSuccess).toHaveBeenCalledTimes(1);
  });

  it('onSuccess NO se llama si la acción falla', async () => {
    const onSuccess = vi.fn();
    await toast.run(async () => {
      throw new Error('boom');
    }, { onSuccess });
    expect(onSuccess).not.toHaveBeenCalled();
  });

  it('onSuccess se dispara tras un reintento exitoso', async () => {
    const onSuccess = vi.fn();
    let attempts = 0;
    const action = async () => {
      attempts++;
      if (attempts < 2) throw new Error('fail once');
      return 'ok';
    };
    await toast.run(action, { onSuccess });
    expect(onSuccess).not.toHaveBeenCalled();

    toast.toasts().find((t) => t.type === 'error')?.retry?.();
    await vi.waitFor(() => expect(onSuccess).toHaveBeenCalledTimes(1));
  });

  it('permission-denied → mensaje de permisos en el toast', async () => {
    const fbErr = Object.assign(new Error('Missing or insufficient permissions.'), {
      code: 'permission-denied',
    });
    await toast.run(async () => {
      throw fbErr;
    });
    const err = toast.toasts().find((t) => t.type === 'error');
    expect(err?.message.toLowerCase()).toContain('permiso');
  });

  it('offline (navigator.onLine=false) → NO ejecuta la acción, muestra error de conexión con retry', async () => {
    const original = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
    Object.defineProperty(globalThis, 'navigator', {
      configurable: true,
      value: { onLine: false },
    });
    const action = vi.fn(async () => 'nope');
    try {
      const result = await toast.run(action);

      expect(action).not.toHaveBeenCalled(); // clave: no se encola la escritura
      expect(result).toBeUndefined();
      const err = toast.toasts().find((t) => t.type === 'error');
      expect(err?.message.toLowerCase()).toContain('conexión');
      expect(typeof err?.retry).toBe('function');
    } finally {
      if (original) Object.defineProperty(globalThis, 'navigator', original);
    }
  });

  it('acción colgada (offline que no rechaza) → corta por timeout y muestra error de conexión', async () => {
    vi.useFakeTimers();
    try {
      // Promesa que nunca se resuelve, como un addDoc offline.
      const pending = new Promise<void>(() => {});
      const runPromise = toast.run(() => pending);

      await vi.advanceTimersByTimeAsync(12000);
      await runPromise;

      const err = toast.toasts().find((t) => t.type === 'error');
      expect(err?.message.toLowerCase()).toContain('conexión');
    } finally {
      vi.useRealTimers();
    }
  });

  it('dismiss elimina el toast por id', () => {
    toast.info('hola');
    const id = toast.toasts()[0].id;
    toast.dismiss(id);
    expect(toast.toasts()).toHaveLength(0);
  });
});
