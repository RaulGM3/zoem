import { describe, it, expect } from 'vitest';
import { resumirEjecuciones } from './resumen-ejecuciones';
import type { AccionRegistro } from '../../interfaces/accion.interface';

const ts = (iso: string) => ({ toDate: () => new Date(iso) }) as AccionRegistro['createdAt'];
const reg = (accionId: string, contactoIds: string[], iso?: string): AccionRegistro => ({
  id: `${accionId}-${iso ?? 'x'}`,
  companyId: 'c',
  accionId,
  accionNombre: accionId,
  contactoIds,
  canal: 'gmail',
  createdBy: 'u1',
  createdAt: (iso ? ts(iso) : undefined) as AccionRegistro['createdAt'],
});

describe('resumirEjecuciones', () => {
  it('acción nunca ejecutada: total 0, sin fecha y 0 por cada contacto', () => {
    const r = resumirEjecuciones(['a1'], [], ['k1', 'k2']).get('a1')!;
    expect(r.total).toBe(0);
    expect(r.ultima).toBeNull();
    expect(r.porContacto).toEqual([
      { contactoId: 'k1', total: 0 },
      { contactoId: 'k2', total: 0 },
    ]);
  });

  it('cuenta ejecuciones por acción y guarda la más reciente', () => {
    const registros = [
      reg('a1', ['k1'], '2026-09-01T10:00:00Z'),
      reg('a1', ['k1', 'k2'], '2026-10-01T10:00:00Z'),
      reg('a2', ['k2'], '2026-08-01T10:00:00Z'),
    ];
    const res = resumirEjecuciones(['a1', 'a2'], registros, ['k1', 'k2']);
    expect(res.get('a1')!.total).toBe(2);
    expect(res.get('a1')!.ultima?.toISOString()).toBe('2026-10-01T10:00:00.000Z');
    expect(res.get('a2')!.total).toBe(1);
  });

  it('desglosa por contacto vinculado (un envío a varios cuenta para cada uno)', () => {
    const registros = [
      reg('a1', ['k1'], '2026-09-01T10:00:00Z'),
      reg('a1', ['k1', 'k2'], '2026-10-01T10:00:00Z'),
    ];
    expect(resumirEjecuciones(['a1'], registros, ['k1', 'k2']).get('a1')!.porContacto).toEqual([
      { contactoId: 'k1', total: 2 },
      { contactoId: 'k2', total: 1 },
    ]);
  });

  it('ignora registros de acciones fuera del catálogo y tolera createdAt pendiente', () => {
    const registros = [reg('borrada', ['k1'], '2026-09-01T10:00:00Z'), reg('a1', ['k1'])];
    const res = resumirEjecuciones(['a1'], registros, ['k1']);
    expect(res.has('borrada')).toBe(false);
    expect(res.get('a1')!.total).toBe(1);
    expect(res.get('a1')!.ultima).toBeNull();
  });
});
