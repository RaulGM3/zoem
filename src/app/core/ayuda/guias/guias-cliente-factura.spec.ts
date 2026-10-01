import { describe, it, expect } from 'vitest';
import { buscarGuias } from '../buscar-guias';
import { GUIAS } from './index';

const tarea = (guiaId: string, tareaId: string) => {
  const t = GUIAS.find(g => g.id === guiaId)?.tareas.find(x => x.id === tareaId);
  if (!t) throw new Error(`Falta la tarea ${guiaId}/${tareaId}`);
  return t;
};

const texto = (guiaId: string, tareaId: string): string => {
  const t = tarea(guiaId, tareaId);
  return [t.titulo, ...t.pasos, t.nota ?? ''].join('\n');
};

/** Ids de tarea (guia/tarea) que devuelve el buscador del agente para una consulta. */
const encuentra = (consulta: string): string[] =>
  buscarGuias(GUIAS, consulta).flatMap(r => r.tareas.map(t => `${r.guia.id}/${t.id}`));

describe('Guías — datos fiscales del cliente de la factura (S7.3)', () => {
  it('facturar-caso describe la sección Cliente, el NIF y el bloqueo por NIF inválido', () => {
    const t = texto('facturacion', 'facturar-caso');
    expect(t).toContain('Cliente');
    expect(t).toContain('Nombre o razón social');
    expect(t).toContain('NIF');
    expect(t).toContain('Guardar también en el contacto');
    expect(t).toMatch(/no es válido|inválido/i);
  });

  it('factura-libre describe "Buscar contacto" y el cliente puntual', () => {
    const t = texto('facturacion', 'factura-libre');
    expect(t).toContain('Buscar contacto');
    expect(t).toContain('Quitar contacto');
    expect(t).toMatch(/cliente puntual/i);
    expect(t).toContain('Guardar también en el contacto');
  });

  it('gestionar-facturas avisa de que la rectificativa mantiene el cliente original', () => {
    const t = texto('facturacion', 'gestionar-facturas');
    expect(t).toMatch(/rectificativa[^.]*mismo cliente|mismo cliente[^.]*rectificativa/i);
  });

  it('avisa de que Verifactu aún no admite documentos extranjeros', () => {
    const t = texto('facturacion', 'facturar-caso') + texto('facturacion', 'factura-libre');
    expect(t).toMatch(/documentos? extranjeros?/i);
    expect(t).toMatch(/Verifactu/);
  });

  it('crear-contacto usa las etiquetas nuevas y valida el NIF, sin "CIF"', () => {
    const t = texto('contactos', 'crear-contacto');
    expect(t).toContain('Tipo de documento');
    expect(t).toContain('Número de documento');
    expect(t).toMatch(/NIF/);
    expect(t).not.toMatch(/\bCIF\b/);
  });

  it('ninguna guía menciona "CIF" como etiqueta de pantalla', () => {
    expect(JSON.stringify(GUIAS)).not.toMatch(/\bCIF\b/);
  });

  it('el agente encuentra las respuestas con las palabras del usuario', () => {
    expect(encuentra('cliente puntual')).toContain('facturacion/factura-libre');
    expect(encuentra('buscar contacto factura')).toContain('facturacion/factura-libre');
    expect(encuentra('nif de la factura')).toContain('facturacion/facturar-caso');
    expect(encuentra('razón social factura')).toContain('facturacion/facturar-caso');
    expect(encuentra('nif inválido contacto')).toContain('contactos/crear-contacto');
  });
});
