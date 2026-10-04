import { describe, it, expect, vi } from 'vitest';
import { notifyUsers, type NotifyDb, type NotifyMessaging } from './notify';

interface FakeState {
  users: Record<string, { notificationPrefs?: Record<string, boolean> } | undefined>;
  tokens: Record<string, string[]>;
}

function setup(state: FakeState, sendResponses?: Array<{ success: boolean; code?: string }>) {
  const added: Array<{ path: string; data: Record<string, unknown> }> = [];
  const deleted: string[] = [];

  const db: NotifyDb = {
    doc: (path: string) => ({
      get: async () => {
        const uid = path.replace('users/', '');
        const data = state.users[uid];
        return { exists: data !== undefined, data: () => data };
      },
      delete: async () => {
        deleted.push(path);
      },
    }),
    collection: (path: string) => ({
      add: async (data: Record<string, unknown>) => {
        added.push({ path, data });
      },
      get: async () => {
        const uid = path.split('/')[1];
        return { docs: (state.tokens[uid] ?? []).map((id) => ({ id })) };
      },
    }),
  };

  const send = vi.fn(async (msg: { tokens: string[] }) => ({
    responses: msg.tokens.map((_, i) => {
      const r = sendResponses?.[i] ?? { success: true };
      return r.success
        ? { success: true }
        : { success: false, error: { code: r.code ?? 'messaging/internal-error' } };
    }),
  }));
  const messaging: NotifyMessaging = { sendEachForMulticast: send };
  return { db, messaging, added, deleted, send };
}

const BASE = {
  companyId: 'c1',
  tipo: 'casos' as const,
  titulo: 'T',
  cuerpo: 'C',
  route: '/casos/1',
};

describe('notifyUsers', () => {
  it('deduplica userIds y crea un doc in-app por usuario', async () => {
    const s = setup({ users: { a: {}, b: {} }, tokens: {} });
    await notifyUsers(s.db, s.messaging, { ...BASE, userIds: ['a', 'b', 'a'] });
    expect(s.added).toHaveLength(2);
    expect(s.added[0].path).toBe('companies/c1/notificaciones');
    expect(s.added[0].data).toMatchObject({
      userId: 'a',
      tipo: 'casos',
      titulo: 'T',
      cuerpo: 'C',
      route: '/casos/1',
      leida: false,
    });
    expect(s.added[0].data['createdAt']).toBeDefined();
  });

  it('omite por completo al usuario con prefs[tipo] === false', async () => {
    const s = setup({
      users: { a: { notificationPrefs: { casos: false } }, b: {} },
      tokens: { a: ['ta'], b: ['tb'] },
    });
    await notifyUsers(s.db, s.messaging, { ...BASE, userIds: ['a', 'b'] });
    expect(s.added.map((x) => x.data['userId'])).toEqual(['b']);
    expect(s.send).toHaveBeenCalledTimes(1);
    expect(s.send.mock.calls[0][0].tokens).toEqual(['tb']);
  });

  it('usuario sin doc users/{uid} usa defaults (todo activo)', async () => {
    const s = setup({ users: {}, tokens: { a: ['ta'] } });
    await notifyUsers(s.db, s.messaging, { ...BASE, userIds: ['a'] });
    expect(s.added).toHaveLength(1);
    expect(s.send).toHaveBeenCalledTimes(1);
  });

  it('prefs.push === false guarda in-app pero no envía FCM', async () => {
    const s = setup({
      users: { a: { notificationPrefs: { push: false } } },
      tokens: { a: ['ta'] },
    });
    await notifyUsers(s.db, s.messaging, { ...BASE, userIds: ['a'] });
    expect(s.added).toHaveLength(1);
    expect(s.send).not.toHaveBeenCalled();
  });

  it('envía multicast con data.route y notification', async () => {
    const s = setup({ users: { a: {} }, tokens: { a: ['t1', 't2'] } });
    await notifyUsers(s.db, s.messaging, { ...BASE, userIds: ['a'] });
    const msg = s.send.mock.calls[0][0] as unknown as {
      tokens: string[];
      notification: { title: string; body: string };
      data: { route: string };
    };
    expect(msg.tokens).toEqual(['t1', 't2']);
    expect(msg.notification).toEqual({ title: 'T', body: 'C' });
    expect(msg.data.route).toBe('/casos/1');
  });

  it('sin tokens no llama a FCM', async () => {
    const s = setup({ users: { a: {} }, tokens: {} });
    await notifyUsers(s.db, s.messaging, { ...BASE, userIds: ['a'] });
    expect(s.send).not.toHaveBeenCalled();
    expect(s.added).toHaveLength(1);
  });

  it('borra tokens con not-registered / invalid-argument, conserva el resto', async () => {
    const s = setup(
      { users: { a: {} }, tokens: { a: ['t1', 't2', 't3', 't4'] } },
      [
        { success: false, code: 'messaging/registration-token-not-registered' },
        { success: false, code: 'messaging/invalid-argument' },
        { success: false, code: 'messaging/internal-error' },
        { success: true },
      ],
    );
    await notifyUsers(s.db, s.messaging, { ...BASE, userIds: ['a'] });
    expect(s.deleted.sort()).toEqual([
      'users/a/deviceTokens/t1',
      'users/a/deviceTokens/t2',
    ]);
  });

  it('un fallo de FCM en un usuario no impide notificar al siguiente', async () => {
    const s = setup({ users: { a: {}, b: {} }, tokens: { a: ['ta'], b: ['tb'] } });
    s.send.mockRejectedValueOnce(new Error('boom'));
    await notifyUsers(s.db, s.messaging, { ...BASE, userIds: ['a', 'b'] });
    expect(s.added).toHaveLength(2);
    expect(s.send).toHaveBeenCalledTimes(2);
  });

  it('lista vacía no hace nada', async () => {
    const s = setup({ users: {}, tokens: {} });
    await notifyUsers(s.db, s.messaging, { ...BASE, userIds: [] });
    expect(s.added).toHaveLength(0);
  });
});
