import { describe, expect, it, vi } from 'vitest';
import { deltaUso, docUsoDe, sumarUso, type UsoDb } from './uso';

describe('docUsoDe', () => {
  it('los contadores no mensuales viven en `total`', () => {
    for (const t of ['caso', 'contacto', 'plantilla', 'miembro', 'archivo'] as const) {
      expect(docUsoDe(t, new Date('2026-03-05T10:00:00Z'), 'Europe/Madrid')).toBe('total');
    }
  });
  it('las acciones usan el mes de la zona de la empresa, no el UTC', () => {
    const t = new Date('2026-03-31T23:30:00Z'); // 01:30 del 1 de abril en Madrid (UTC+2)
    expect(docUsoDe('accion', t, 'Europe/Madrid')).toBe('2026-04');
    expect(docUsoDe('accion', t, 'America/Bogota')).toBe('2026-03');
    expect(docUsoDe('accion', t, 'UTC')).toBe('2026-03');
  });
});

describe('deltaUso · casos activos', () => {
  const caso = (estado: string) => ({ estado });
  it('crear un caso activo suma 1; uno cerrado no suma', () => {
    expect(deltaUso('caso', 'c1', undefined, caso('pendiente'), false)).toBe(1);
    expect(deltaUso('caso', 'c1', undefined, caso('en_proceso'), false)).toBe(1);
    expect(deltaUso('caso', 'c1', undefined, caso('urgente'), false)).toBe(1);
    expect(deltaUso('caso', 'c1', undefined, caso('cerrado'), false)).toBe(0);
  });
  it('cerrar resta, reabrir suma, borrar resta', () => {
    expect(deltaUso('caso', 'c1', caso('pendiente'), caso('cerrado'), false)).toBe(-1);
    expect(deltaUso('caso', 'c1', caso('cerrado'), caso('urgente'), false)).toBe(1);
    expect(deltaUso('caso', 'c1', caso('pendiente'), undefined, false)).toBe(-1);
    expect(deltaUso('caso', 'c1', caso('pendiente'), caso('urgente'), false)).toBe(0);
  });
});

describe('deltaUso · contactos y plantillas', () => {
  it('contacto: el soft delete resta y restaurar suma', () => {
    expect(deltaUso('contacto', 'x', undefined, { deleted: false }, false)).toBe(1);
    expect(deltaUso('contacto', 'x', { deleted: false }, { deleted: true }, false)).toBe(-1);
    expect(deltaUso('contacto', 'x', { deleted: true }, { deleted: false }, false)).toBe(1);
    expect(deltaUso('contacto', 'x', { a: 1 }, { a: 2 }, false)).toBe(0);
  });
  it('plantilla: crear suma, borrar resta', () => {
    expect(deltaUso('plantilla', 'p', undefined, { nombre: 'a' }, false)).toBe(1);
    expect(deltaUso('plantilla', 'p', { nombre: 'a' }, undefined, false)).toBe(-1);
  });
});

describe('deltaUso · miembros y archivos', () => {
  it('miembro: solo cuentan los activos', () => {
    expect(deltaUso('miembro', 'u', undefined, { estado: 'activo' }, false)).toBe(1);
    expect(deltaUso('miembro', 'u', { estado: 'activo' }, { estado: 'inactivo' }, false)).toBe(-1);
    expect(deltaUso('miembro', 'u', undefined, { estado: 'pendiente' }, false)).toBe(0);
  });
  it('archivo: bytes mientras exista y no esté borrado', () => {
    expect(deltaUso('archivo', 'f', undefined, { sizeBytes: 1000, deleted: false }, false)).toBe(1000);
    expect(deltaUso('archivo', 'f', { sizeBytes: 1000, deleted: false }, { sizeBytes: 1000, deleted: true }, false)).toBe(-1000);
    expect(deltaUso('archivo', 'f', undefined, { deleted: false }, false)).toBe(0);
  });
});

describe('deltaUso · el seed de la demo no cuenta', () => {
  it('en una demo, ids demo-… se ignoran; en una empresa normal cuentan', () => {
    expect(deltaUso('contacto', 'demo-contacto-01', undefined, { deleted: false }, true)).toBe(0);
    expect(deltaUso('contacto', 'abc123', undefined, { deleted: false }, true)).toBe(1);
    expect(deltaUso('contacto', 'demo-contacto-01', undefined, { deleted: false }, false)).toBe(1);
  });
  it('los miembros nunca se ignoran', () => {
    expect(deltaUso('miembro', 'demo-uid', undefined, { estado: 'activo' }, true)).toBe(1);
  });
});

describe('deltaUso · ejecuciones de acción', () => {
  it('cada registro suma 1 al mes, salvo el seed de una demo', () => {
    expect(deltaUso('accion', 'r1', undefined, { canal: 'mail' }, false)).toBe(1);
    expect(deltaUso('accion', 'demo-registro-01', undefined, { canal: 'mail' }, true)).toBe(0);
  });
});

describe('sumarUso', () => {
  it('no hace nada con delta 0', async () => {
    const set = vi.fn();
    const db: UsoDb = { sumar: set };
    await sumarUso(db, 'c1', 'total', 'contactos', 0);
    expect(set).not.toHaveBeenCalled();
  });
  it('delega con la ruta del doc de uso', async () => {
    const sumar = vi.fn();
    await sumarUso({ sumar }, 'c1', '2026-10', 'accionesMes', 1);
    expect(sumar).toHaveBeenCalledWith('companies/c1/uso/2026-10', 'accionesMes', 1);
  });
});
