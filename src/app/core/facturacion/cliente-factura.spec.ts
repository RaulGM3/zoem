import { describe, it, expect, vi } from 'vitest';
import type { PersonaFisica, PersonaJuridica } from '../../interfaces/contact.interface';
import {
  camposClienteFactura,
  clienteDesdeContacto,
  clienteDesdeFactura,
  contactoSinDocumento,
  escribirClienteEnContacto,
  filtrarContactos,
  parcheContacto,
  tipoIdDeContacto,
  type ClienteFactura,
} from './cliente-factura';

function fisica(over: Partial<PersonaFisica> = {}): PersonaFisica {
  return {
    id: 'c1',
    companyId: 'co1',
    type: 'persona_fisica',
    email: 'ana@ejemplo.es',
    status: 'activo',
    nombre: 'Ana',
    apellidos: 'Pérez',
    nifType: 'dni',
    nif: '12345678Z',
    ...over,
  };
}

function juridica(over: Partial<PersonaJuridica> = {}): PersonaJuridica {
  return {
    id: 'c2',
    companyId: 'co1',
    type: 'persona_juridica',
    email: 'info@acme.es',
    status: 'activo',
    razonSocial: 'Acme SL',
    cifType: 'cif',
    cif: 'B12345674',
    ...over,
  };
}

describe('tipoIdDeContacto (S2.7)', () => {
  const casos: [string, PersonaFisica | PersonaJuridica, 'nif' | 'extranjero'][] = [
    ['física dni', fisica({ nifType: 'dni' }), 'nif'],
    ['física nie', fisica({ nifType: 'nie' }), 'nif'],
    ['física pasaporte', fisica({ nifType: 'pasaporte' }), 'extranjero'],
    ['física otro', fisica({ nifType: 'otro' }), 'extranjero'],
    ['jurídica cif', juridica({ cifType: 'cif' }), 'nif'],
    ['jurídica vat', juridica({ cifType: 'vat' }), 'extranjero'],
    ['jurídica otro', juridica({ cifType: 'otro' }), 'extranjero'],
  ];
  it.each(casos)('%s -> %s', (_nombre, contacto, esperado) => {
    expect(tipoIdDeContacto(contacto)).toBe(esperado);
  });
});

describe('clienteDesdeContacto', () => {
  it('física: nombre completo, NIF, tipo y dirección en una línea', () => {
    const c = fisica({
      direccion: { calle: 'Mayor', numero: '1', piso: '2A', codigoPostal: '28001', municipio: 'Madrid', provincia: 'Madrid', pais: 'ES' },
    });
    expect(clienteDesdeContacto(c)).toEqual({
      contactoId: 'c1',
      nombre: 'Ana Pérez',
      tipoId: 'nif',
      nif: '12345678Z',
      direccion: 'Mayor, 1, 2A, 28001, Madrid, Madrid',
    });
  });

  it('jurídica: razón social, CIF y dirección fiscal con prioridad sobre la social', () => {
    const c = juridica({
      direccionSocial: { calle: 'Social', pais: 'ES' },
      direccionFiscal: { calle: 'Fiscal', municipio: 'Sevilla', pais: 'ES' },
    });
    expect(clienteDesdeContacto(c)).toEqual({
      contactoId: 'c2',
      nombre: 'Acme SL',
      tipoId: 'nif',
      nif: 'B12345674',
      direccion: 'Fiscal, Sevilla',
    });
  });

  it('jurídica sin dirección fiscal usa la social; sin ninguna, undefined', () => {
    expect(clienteDesdeContacto(juridica({ direccionSocial: { calle: 'Social', pais: 'ES' } })).direccion).toBe('Social');
    expect(clienteDesdeContacto(juridica()).direccion).toBeUndefined();
  });

  it('pasaporte -> tipo extranjero conservando el número', () => {
    expect(clienteDesdeContacto(fisica({ nifType: 'pasaporte', nif: 'PAA123456' }))).toMatchObject({
      tipoId: 'extranjero',
      nif: 'PAA123456',
    });
  });
});

describe('clienteDesdeFactura', () => {
  it('lee el snapshot de la factura, no del contacto', () => {
    expect(
      clienteDesdeFactura({
        clienteNombre: 'Cliente SL',
        clienteNif: 'B12345674',
        clienteDireccion: 'Calle 1',
        clienteTipoId: 'nif',
        clienteContactoId: 'c2',
      }),
    ).toEqual({ contactoId: 'c2', nombre: 'Cliente SL', tipoId: 'nif', nif: 'B12345674', direccion: 'Calle 1' });
  });

  it('factura antigua sin tipo -> nif; sin nombre -> cadena vacía', () => {
    expect(clienteDesdeFactura({ clienteNif: '12345678Z' })).toEqual({
      contactoId: undefined,
      nombre: '',
      tipoId: 'nif',
      nif: '12345678Z',
      direccion: undefined,
    });
  });

  it('respeta el tipo extranjero', () => {
    expect(clienteDesdeFactura({ clienteNombre: 'X', clienteTipoId: 'extranjero', clienteNif: 'PAA1' }).tipoId).toBe('extranjero');
  });
});

describe('camposClienteFactura (S2.5)', () => {
  it('tipo nif: normaliza el NIF y copia el resto', () => {
    const cli: ClienteFactura = { contactoId: 'c2', nombre: '  Acme SL ', tipoId: 'nif', nif: ' b-12345674 ', direccion: 'Calle 1' };
    expect(camposClienteFactura(cli)).toEqual({
      clienteNombre: 'Acme SL',
      clienteNif: 'B12345674',
      clienteDireccion: 'Calle 1',
      clienteTipoId: 'nif',
      clienteContactoId: 'c2',
    });
  });

  it('tipo extranjero: solo trim, sin normalizar mayúsculas ni guiones', () => {
    const r = camposClienteFactura({ nombre: 'Foreign', tipoId: 'extranjero', nif: '  pa-a123 456 ' });
    expect(r.clienteNif).toBe('pa-a123 456');
    expect(r.clienteTipoId).toBe('extranjero');
  });

  it('NIF vacío o en blanco -> undefined (no escribe cadena vacía)', () => {
    expect(camposClienteFactura({ nombre: 'A', tipoId: 'nif', nif: '   ' }).clienteNif).toBeUndefined();
    expect(camposClienteFactura({ nombre: 'A', tipoId: 'nif' }).clienteNif).toBeUndefined();
  });

  it('S2.6 nunca incluye `verifactu`', () => {
    expect(Object.keys(camposClienteFactura({ nombre: 'A', tipoId: 'nif', nif: '12345678Z' }))).not.toContain('verifactu');
  });
});

describe('parcheContacto (S5.1-S5.4)', () => {
  it('S5.1 física sin NIF + NIF que empieza por X -> nie', () => {
    const c = fisica({ nif: undefined, nifType: 'dni' });
    expect(parcheContacto(c, { nombre: 'Ana Pérez', tipoId: 'nif', nif: ' x-1234567l ' })).toEqual({ nifType: 'nie', nif: 'X1234567L' });
  });

  it('S5.1 física: NIF que no empieza por XYZ -> dni', () => {
    const c = fisica({ nif: undefined });
    expect(parcheContacto(c, { nombre: 'Ana', tipoId: 'nif', nif: '12345678z' })).toEqual({ nifType: 'dni', nif: '12345678Z' });
  });

  it('S5.2 jurídica -> cifType cif, cif normalizado y razonSocial del cliente', () => {
    const c = juridica({ cif: undefined });
    expect(parcheContacto(c, { nombre: 'Acme SL', tipoId: 'nif', nif: 'b12345674' })).toEqual({
      cifType: 'cif',
      cif: 'B12345674',
      razonSocial: 'Acme SL',
    });
  });

  it('S5.3 nunca incluye dirección, email, nombre ni apellidos', () => {
    const f = parcheContacto(fisica({ nif: undefined }), { nombre: 'Otro Nombre', tipoId: 'nif', nif: '12345678Z', direccion: 'Calle 9' });
    const j = parcheContacto(juridica({ cif: undefined }), { nombre: 'Otra SL', tipoId: 'nif', nif: 'B12345674', direccion: 'Calle 9' });
    for (const parche of [f, j]) {
      expect(parche).not.toBeNull();
      const claves = Object.keys(parche ?? {});
      for (const prohibida of ['direccion', 'direccionFiscal', 'direccionSocial', 'email', 'nombre', 'apellidos']) {
        expect(claves).not.toContain(prohibida);
      }
    }
  });

  it('S5.4 sin cambios -> null (física y jurídica)', () => {
    expect(parcheContacto(fisica(), { nombre: 'Ana Pérez', tipoId: 'nif', nif: '12345678Z' })).toBeNull();
    expect(parcheContacto(juridica(), { nombre: 'Acme SL', tipoId: 'nif', nif: 'B12345674' })).toBeNull();
  });

  it('un cambio solo en la razón social también genera parche', () => {
    expect(parcheContacto(juridica(), { nombre: 'Acme Holding SL', tipoId: 'nif', nif: 'B12345674' })).toEqual({
      cifType: 'cif',
      cif: 'B12345674',
      razonSocial: 'Acme Holding SL',
    });
  });

  it('extranjero conserva el tipo si ya era extranjero; si no, otro', () => {
    const pasaporte = fisica({ nifType: 'pasaporte', nif: undefined });
    expect(parcheContacto(pasaporte, { nombre: 'Ana', tipoId: 'extranjero', nif: 'PAA123456' })).toEqual({
      nifType: 'pasaporte',
      nif: 'PAA123456',
    });
    expect(parcheContacto(fisica({ nif: undefined }), { nombre: 'Ana', tipoId: 'extranjero', nif: 'PAA123456' })).toEqual({
      nifType: 'otro',
      nif: 'PAA123456',
    });
    expect(parcheContacto(juridica({ cifType: 'vat', cif: undefined }), { nombre: 'Acme SL', tipoId: 'extranjero', nif: 'FR123' })).toEqual({
      cifType: 'vat',
      cif: 'FR123',
      razonSocial: 'Acme SL',
    });
    expect(parcheContacto(juridica({ cif: undefined }), { nombre: 'Acme SL', tipoId: 'extranjero', nif: 'FR123' })).toMatchObject({
      cifType: 'otro',
    });
  });

  it('sin número de documento en el cliente -> null (no borra el del contacto)', () => {
    expect(parcheContacto(fisica(), { nombre: 'Ana Pérez', tipoId: 'nif', nif: '  ' })).toBeNull();
  });
});

describe('contactoSinDocumento (S5.5)', () => {
  it('true sin número o en blanco; false con número', () => {
    expect(contactoSinDocumento(fisica({ nif: undefined }))).toBe(true);
    expect(contactoSinDocumento(fisica({ nif: '  ' }))).toBe(true);
    expect(contactoSinDocumento(juridica({ cif: undefined }))).toBe(true);
    expect(contactoSinDocumento(fisica())).toBe(false);
    expect(contactoSinDocumento(juridica())).toBe(false);
  });
});

describe('filtrarContactos (S4.14)', () => {
  const lista = [
    fisica({ id: 'a', nombre: 'Ana', apellidos: 'Pérez', email: 'ana@ejemplo.es', phone: '600111222', nif: '12345678Z' }),
    juridica({ id: 'b', razonSocial: 'Acme SL', email: 'info@acme.es', mobile: '699888777', cif: 'B12345674' }),
    fisica({ id: 'c', nombre: 'Luis', apellidos: 'Gómez', email: 'luis@otro.es', nif: '87654321X' }),
  ];

  it('consulta vacía o en blanco -> []', () => {
    expect(filtrarContactos(lista, '').map((c) => c.id)).toEqual([]);
    expect(filtrarContactos(lista, '   ').map((c) => c.id)).toEqual([]);
  });

  it('busca por nombre (sin distinguir mayúsculas)', () => {
    expect(filtrarContactos(lista, 'ANA PÉ').map((c) => c.id)).toEqual(['a']);
    expect(filtrarContactos(lista, 'acme').map((c) => c.id)).toEqual(['b']);
  });

  it('busca por NIF/CIF, email y teléfono (phone y mobile)', () => {
    expect(filtrarContactos(lista, 'b12345').map((c) => c.id)).toEqual(['b']);
    expect(filtrarContactos(lista, '87654321').map((c) => c.id)).toEqual(['c']);
    expect(filtrarContactos(lista, 'luis@otro').map((c) => c.id)).toEqual(['c']);
    expect(filtrarContactos(lista, '600111').map((c) => c.id)).toEqual(['a']);
    expect(filtrarContactos(lista, '699888').map((c) => c.id)).toEqual(['b']);
  });

  it('sin coincidencias -> [] y devuelve como máximo 8 por defecto', () => {
    expect(filtrarContactos(lista, 'zzz')).toEqual([]);
    const muchos = Array.from({ length: 12 }, (_, i) => fisica({ id: `m${i}`, nombre: 'Marta', apellidos: `N${i}` }));
    expect(filtrarContactos(muchos, 'marta')).toHaveLength(8);
    expect(filtrarContactos(muchos, 'marta', 3)).toHaveLength(3);
  });
});

describe('escribirClienteEnContacto (glue testeable de "Guardar también en el contacto")', () => {
  const cli: ClienteFactura = { contactoId: 'c1', nombre: 'Ana Pérez', tipoId: 'nif', nif: ' x1234567l ' };

  function deps(contacto: PersonaFisica | PersonaJuridica | null) {
    return {
      getContact: vi.fn(async () => contacto),
      updateContact: vi.fn(async () => undefined),
    };
  }

  it('S5.1/S5.3 con la casilla marcada escribe SOLO el parche (tipo y número) con el contacto fresco', async () => {
    const d = deps(fisica({ nif: undefined }));
    const r = await escribirClienteEnContacto(d, { guardar: true, cliente: cli });
    expect(r).toBe('actualizado');
    expect(d.getContact).toHaveBeenCalledWith('c1');
    expect(d.updateContact).toHaveBeenCalledTimes(1);
    expect(d.updateContact).toHaveBeenCalledWith('c1', { nifType: 'nie', nif: 'X1234567L' });
  });

  it('jurídica: escribe cifType, cif y razonSocial y nada más', async () => {
    const d = deps(juridica({ cif: undefined }));
    await escribirClienteEnContacto(d, { guardar: true, cliente: { contactoId: 'c2', nombre: 'Acme SL', tipoId: 'nif', nif: 'b12345674' } });
    expect(d.updateContact).toHaveBeenCalledWith('c2', { cifType: 'cif', cif: 'B12345674', razonSocial: 'Acme SL' });
  });

  it('S5.6 casilla desmarcada: no lee ni escribe el contacto', async () => {
    const d = deps(fisica());
    expect(await escribirClienteEnContacto(d, { guardar: false, cliente: cli })).toBe('omitido');
    expect(d.getContact).not.toHaveBeenCalled();
    expect(d.updateContact).not.toHaveBeenCalled();
  });

  it('sin contactoId en el cliente: omitido', async () => {
    const d = deps(fisica());
    expect(await escribirClienteEnContacto(d, { guardar: true, cliente: { nombre: 'Puntual', tipoId: 'nif', nif: '12345678Z' } })).toBe('omitido');
    expect(d.updateContact).not.toHaveBeenCalled();
  });

  it('S5.4 sin cambios (mismo documento): no escribe', async () => {
    const d = deps(fisica({ nifType: 'dni', nif: '12345678Z' }));
    const r = await escribirClienteEnContacto(d, { guardar: true, cliente: { contactoId: 'c1', nombre: 'Ana', tipoId: 'nif', nif: '12345678z' } });
    expect(r).toBe('sin-cambios');
    expect(d.updateContact).not.toHaveBeenCalled();
  });

  it('contacto borrado entre medias: omitido sin error', async () => {
    const d = deps(null);
    expect(await escribirClienteEnContacto(d, { guardar: true, cliente: cli })).toBe('omitido');
    expect(d.updateContact).not.toHaveBeenCalled();
  });

  it('S5.6 si falla la escritura el error se propaga (el llamante muestra el aviso)', async () => {
    const d = deps(fisica({ nif: undefined }));
    d.updateContact.mockRejectedValueOnce(new Error('permission-denied'));
    await expect(escribirClienteEnContacto(d, { guardar: true, cliente: cli })).rejects.toThrow('permission-denied');
  });
});
