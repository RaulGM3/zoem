import { describe, expect, it, vi } from 'vitest';
import { deltaUso, docUsoDe, sumarUso, type UsoDb } from './uso';

describe('docUsoDe', () => {
  it('los contadores no mensuales viven en `total`', () => {
    for (const t of ['caso', 'contacto', 'plantilla', 'miembro', 'archivo', 'factura', 'docTemplate'] as const) {
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

describe('deltaUso · bytes de TODAS las versiones almacenadas', () => {
  const v = (n: number, size: number, path = `p/v${n}`) => ({ version: n, storagePath: path, sizeBytes: size });
  it('un archivo con historial cuenta todas sus versiones (los blobs viejos siguen en Storage)', () => {
    const d = { sizeBytes: 300, storagePath: 'p/v3', version: 3, versions: [v(1, 100), v(2, 200), v(3, 300)] };
    expect(deltaUso('archivo', 'f', undefined, d, false)).toBe(600);
  });
  it('subir una versión nueva suma solo la nueva; borrar el archivo libera todas', () => {
    const antes = { sizeBytes: 100, storagePath: 'p/v1', versions: [v(1, 100)] };
    const despues = { sizeBytes: 250, storagePath: 'p/v2', versions: [v(1, 100), v(2, 250)] };
    expect(deltaUso('archivo', 'f', antes, despues, false)).toBe(250);
    expect(deltaUso('archivo', 'f', despues, { ...despues, deleted: true }, false)).toBe(-350);
  });
  it('no cuenta dos veces el blob actual si está en versions y en los campos de primer nivel', () => {
    const d = { sizeBytes: 100, storagePath: 'p/v1', versions: [v(1, 100)] };
    expect(deltaUso('archivo', 'f', undefined, d, false)).toBe(100);
  });
  it('legado sin versions: cuenta sizeBytes', () => {
    expect(deltaUso('archivo', 'f', undefined, { sizeBytes: 70, storagePath: 'p/x' }, false)).toBe(70);
  });
  it('slot subido o generado cuenta; slot retirado (pendiente) o borrado libera', () => {
    const subido = { status: 'subido', sizeBytes: 40, storagePath: 'p/s2', versions: [v(1, 30, 'p/s1'), v(2, 40, 'p/s2')] };
    expect(deltaUso('archivo', 's', undefined, subido, false)).toBe(70);
    expect(deltaUso('archivo', 's', undefined, { status: 'generado', sizeBytes: 55, storagePath: 'p/g' }, false)).toBe(55);
    const retirado = { status: 'pendiente', sizeBytes: null, storagePath: null, versions: [v(1, 30, 'p/s1')] };
    expect(deltaUso('archivo', 's', undefined, retirado, false)).toBe(0);
    expect(deltaUso('archivo', 's', undefined, { status: 'pendiente' }, false)).toBe(0);
    expect(deltaUso('archivo', 's', subido, { ...subido, deleted: true }, false)).toBe(-70);
  });
  it('valores inválidos no cuentan', () => {
    expect(deltaUso('archivo', 'f', undefined, { versions: [{ storagePath: 'a', sizeBytes: -5 }, { storagePath: 'b', sizeBytes: 'x' }] }, false)).toBe(0);
  });
  it('adjunto de factura recibida cuenta su size; fuente de plantilla de documento cuenta sourceSizeBytes', () => {
    expect(deltaUso('factura', 'fr', undefined, { adjunto: { storagePath: 'a', size: 900 } }, false)).toBe(900);
    expect(deltaUso('factura', 'fr', undefined, { estado: 'registrada' }, false)).toBe(0);
    expect(deltaUso('docTemplate', 't', undefined, { sourceSizeBytes: 500 }, false)).toBe(500);
    expect(deltaUso('docTemplate', 't', undefined, { nombre: 'sin fuente' }, false)).toBe(0);
    expect(deltaUso('docTemplate', 't', { sourceSizeBytes: 500 }, { sourceSizeBytes: 500, deleted: true }, false)).toBe(-500);
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
