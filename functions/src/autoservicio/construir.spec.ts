import { describe, expect, it } from 'vitest';
import { empresaAutoservicioDoc, empresaDemoDoc, miembroAdminDoc, partirNombre } from './construir';

const ahora = new Date('2026-10-09T12:00:00Z');

describe('empresaAutoservicioDoc', () => {
  it('crea el despacho free en prueba de 14 días, creado por el usuario', () => {
    const d = empresaAutoservicioDoc(
      { nombre: 'García', tipoPersona: 'fisica', ca: 'madrid', rubro: 'abogados', especialidad: 'Civil' },
      { uid: 'u1', email: 'a@b.es', slug: 'garcia-x1', ahora },
    );
    expect(d).toMatchObject({
      name: 'García', slug: 'garcia-x1', tipoPersona: 'fisica', ca: 'madrid', rubro: 'abogados',
      especialidad: 'Civil', email: 'a@b.es', isActive: true, status: 'active', createdBy: 'u1', autoservicio: true,
      suscripcion: { plan: 'free', estado: 'prueba', complementos: [], origen: 'free' },
    });
    expect(d.esDemo).toBeUndefined();
  });

  it('nace con `derechos` denormalizados para que las rules ya apliquen: pro en la prueba, free después', () => {
    const d = empresaAutoservicioDoc(
      { nombre: 'García', tipoPersona: 'fisica', ca: 'madrid', rubro: 'abogados' },
      { uid: 'u1', email: 'a@b.es', slug: 'g', ahora },
    );
    expect(d.derechos).toBeTruthy();
    expect(d.derechos!.funciones.tesoreria).toBe(true);
    expect(d.derechos!.hasta).toEqual(new Date('2026-10-23T12:00:00Z'));
    expect(d.derechos!.despues!.funciones.tesoreria).toBe(false);
  });
});

describe('zonaHoraria en el alta', () => {
  it('se guarda en la empresa y el periodoUso de `derechos` se calcula en esa zona', () => {
    const d = empresaAutoservicioDoc(
      { nombre: 'Pérez', tipoPersona: 'fisica', ca: 'madrid', rubro: 'abogados', zonaHoraria: 'America/Bogota' },
      { uid: 'u1', email: 'a@b.es', slug: 'g', ahora: new Date('2026-11-01T03:00:00Z') },
    );
    expect(d.zonaHoraria).toBe('America/Bogota');
    expect(d.derechos!.periodoUso!.clave).toBe('2026-10');
  });
  it('la demo también', () => {
    const d = empresaDemoDoc('X', { uid: 'u1', email: 'a@b.es', slug: 'd', ahora, zonaHoraria: 'America/Lima' });
    expect(d.zonaHoraria).toBe('America/Lima');
    expect(d.derechos!.periodoUso!.fin).toEqual(new Date('2026-11-01T05:00:00Z'));
  });
});

describe('empresaDemoDoc', () => {
  it('se llama "Despacho Demo – nombre", plan demo y esDemo', () => {
    const d = empresaDemoDoc('García', { uid: 'u1', email: 'a@b.es', slug: 'demo-x', ahora });
    expect(d).toMatchObject({
      name: 'Despacho Demo – García', esDemo: true, createdBy: 'u1', isActive: true,
      suscripcion: { plan: 'demo', estado: 'activa', origen: 'manual' },
    });
    expect(d.autoservicio).toBeUndefined();
  });

  it('la demo dura 14 días y después queda en solo lectura', () => {
    const d = empresaDemoDoc('García', { uid: 'u1', email: 'a@b.es', slug: 'demo-x', ahora });
    expect(d.suscripcion.periodoFin).toEqual(new Date('2026-10-23T12:00:00Z'));
    expect(d.derechos!.soloLectura).toBe(false);
    expect(d.derechos!.limites.usuarios).toBe(1);
    expect(d.derechos!.despues!.soloLectura).toBe(true);
  });
});

describe('miembroAdminDoc', () => {
  it('Admin activo con datos del usuario', () => {
    expect(miembroAdminDoc('c1', { uid: 'u1', email: 'a@b.es', nombreCompleto: 'Ana Pérez López' })).toMatchObject({
      companyId: 'c1', userId: 'u1', email: 'a@b.es', nombre: 'Ana', apellido: 'Pérez López',
      role: 'Admin', estado: 'activo', departamento: '', ultimoLogin: null,
    });
  });
});

describe('partirNombre', () => {
  it('separa nombre y apellidos; sin nombre usa el email', () => {
    expect(partirNombre('Ana Pérez', 'a@b.es')).toEqual({ nombre: 'Ana', apellido: 'Pérez' });
    expect(partirNombre('Ana', 'a@b.es')).toEqual({ nombre: 'Ana', apellido: '' });
    expect(partirNombre(undefined, 'ana@b.es')).toEqual({ nombre: 'ana', apellido: '' });
  });
});
