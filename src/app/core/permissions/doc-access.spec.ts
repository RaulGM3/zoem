import { describe, it, expect } from 'vitest';
import { canReadDoc, canSeePlantilla } from './doc-access';

describe('canReadDoc (espejo de las rules de clasificado)', () => {
  it('doc sin campo clasificado (legacy) es visible para cualquier miembro', () => {
    expect(canReadDoc({}, 'user-1', 'Usuario', false)).toBe(true);
  });

  it('doc con clasificado=false es visible', () => {
    expect(canReadDoc({ clasificado: false }, 'user-1', 'Viewer', false)).toBe(true);
  });

  it('clasificado: invisible para un miembro no listado', () => {
    const doc = { clasificado: true, allowedUserIds: ['user-2'] };
    expect(canReadDoc(doc, 'user-1', 'Usuario', false)).toBe(false);
    expect(canReadDoc(doc, 'user-1', 'Gestor', false)).toBe(false);
  });

  it('clasificado: visible para la allowlist', () => {
    const doc = { clasificado: true, allowedUserIds: ['user-1'] };
    expect(canReadDoc(doc, 'user-1', 'Usuario', false)).toBe(true);
  });

  it('clasificado: Admin y superuser siempre lo ven', () => {
    const doc = { clasificado: true, allowedUserIds: [] };
    expect(canReadDoc(doc, 'user-1', 'Admin', false)).toBe(true);
    expect(canReadDoc(doc, 'user-1', 'Viewer', true)).toBe(true);
  });

  it('clasificado sin allowlist: solo Admin/superuser', () => {
    expect(canReadDoc({ clasificado: true }, 'user-1', 'Usuario', false)).toBe(false);
  });
});

describe('canSeePlantilla (espejo de las rules de visibilidad)', () => {
  it('sin visibleTo (legacy) o "all" → visible para cualquiera', () => {
    expect(canSeePlantilla({}, 'user-1', 'Viewer', false)).toBe(true);
    expect(canSeePlantilla({ visibleTo: 'all' }, 'user-1', 'Usuario', false)).toBe(true);
  });

  it('restricted sin listas → solo Admin/superuser', () => {
    const p = { visibleTo: 'restricted' as const };
    expect(canSeePlantilla(p, 'user-1', 'Usuario', false)).toBe(false);
    expect(canSeePlantilla(p, 'user-1', 'Admin', false)).toBe(true);
    expect(canSeePlantilla(p, 'user-1', 'Viewer', true)).toBe(true);
  });

  it('restricted por rol', () => {
    const p = { visibleTo: 'restricted' as const, visibleRoles: ['Gestor' as const] };
    expect(canSeePlantilla(p, 'user-1', 'Gestor', false)).toBe(true);
    expect(canSeePlantilla(p, 'user-1', 'Usuario', false)).toBe(false);
  });

  it('restricted por usuario', () => {
    const p = { visibleTo: 'restricted' as const, visibleUserIds: ['user-1'] };
    expect(canSeePlantilla(p, 'user-1', 'Viewer', false)).toBe(true);
    expect(canSeePlantilla(p, 'user-2', 'Viewer', false)).toBe(false);
  });

  it('sin rol (no miembro) no ve nada restringido', () => {
    const p = { visibleTo: 'restricted' as const, visibleUserIds: ['user-1'] };
    expect(canSeePlantilla(p, 'user-1', null, false)).toBe(true); // allowlist manda
    expect(canSeePlantilla({ visibleTo: 'restricted' as const }, 'user-1', null, false)).toBe(false);
  });
});
