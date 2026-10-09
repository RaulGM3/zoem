import { describe, expect, it, vi } from 'vitest';

// REGLA LEGAL (no negociable): ningún proceso automático borra ni oculta archivos de usuario, ni por cuota,
// ni tras una bajada de plan, ni por subidas de superusuario. Pasarse del cupo solo BLOQUEA SUBIDAS NUEVAS
// (Storage rules + pre-check de cliente); lo ya subido sigue intacto y accesible.
vi.mock('firebase-admin', () => ({ initializeApp: vi.fn(), firestore: Object.assign(vi.fn(), { FieldValue: {} }), storage: vi.fn(), auth: vi.fn(), apps: [1] }));

describe('no existe ruta de borrado automático de archivos', () => {
  it('el índice no exporta ningún trigger de Storage que pueda eliminar objetos por cuota', async () => {
    const indice = await import('../index');
    expect(Object.keys(indice)).not.toContain('limitarCuotaArchivos');
  });

  it('los módulos de cuota de borrado ya no existen', async () => {
    await expect(import('./cuotaStorage' as string)).rejects.toThrow();
    await expect(import('./cuotaArchivos' as string)).rejects.toThrow();
  });
});
