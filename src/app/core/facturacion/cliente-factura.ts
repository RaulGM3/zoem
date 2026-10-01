/**
 * Cliente de una factura: copia legal (snapshot) de los datos de identificación en el momento
 * de emitir. Módulo puro, sin dependencias de framework: el contacto solo se usa para precargar
 * y, a petición del usuario, para escribir de vuelta un parche mínimo.
 */

import { getContactDisplayName, type Contact, type Direccion } from '../../interfaces/contact.interface';
import { normalizarNif } from '../fiscal/nif';

/** `nif`: documento español (DNI/NIE/CIF); `extranjero`: pasaporte, VAT u otro (Verifactu aún no lo admite). */
export type TipoIdCliente = 'nif' | 'extranjero';

export interface ClienteFactura {
  contactoId?: string;
  nombre: string;
  tipoId: TipoIdCliente;
  nif?: string;
  direccion?: string;
}

/** Campos del cliente tal como se guardan en la factura. */
export interface CamposClienteFactura {
  clienteNombre: string;
  clienteNif?: string;
  clienteDireccion?: string;
  clienteTipoId: TipoIdCliente;
  clienteContactoId?: string;
}

/** Lo mínimo de una factura que hace falta para reconstruir su cliente. */
export interface FacturaConCliente {
  clienteNombre?: string;
  clienteNif?: string;
  clienteDireccion?: string;
  /** Ausente (facturas antiguas) equivale a 'nif'. */
  clienteTipoId?: TipoIdCliente;
  clienteContactoId?: string;
}

export function tipoIdDeContacto(c: Contact): TipoIdCliente {
  if (c.type === 'persona_fisica') return c.nifType === 'dni' || c.nifType === 'nie' ? 'nif' : 'extranjero';
  return c.cifType === 'cif' ? 'nif' : 'extranjero';
}

function documentoDeContacto(c: Contact): string | undefined {
  return c.type === 'persona_fisica' ? c.nif : c.cif;
}

function direccionDeContacto(c: Contact): string | undefined {
  const d: Direccion | undefined = c.type === 'persona_fisica' ? c.direccion : (c.direccionFiscal ?? c.direccionSocial);
  if (!d) return undefined;
  const linea = [d.calle, d.numero, d.piso, d.codigoPostal, d.municipio, d.provincia].filter(Boolean).join(', ');
  return linea || undefined;
}

export function clienteDesdeContacto(c: Contact): ClienteFactura {
  return {
    contactoId: c.id,
    nombre: getContactDisplayName(c),
    tipoId: tipoIdDeContacto(c),
    nif: documentoDeContacto(c),
    direccion: direccionDeContacto(c),
  };
}

export function clienteDesdeFactura(inv: FacturaConCliente): ClienteFactura {
  return {
    contactoId: inv.clienteContactoId,
    nombre: inv.clienteNombre ?? '',
    tipoId: inv.clienteTipoId ?? 'nif',
    nif: inv.clienteNif,
    direccion: inv.clienteDireccion,
  };
}

function documentoNormalizado(cli: ClienteFactura): string | undefined {
  const valor = cli.tipoId === 'nif' ? normalizarNif(cli.nif ?? '') : (cli.nif ?? '').trim();
  return valor || undefined;
}

export function camposClienteFactura(cli: ClienteFactura): CamposClienteFactura {
  return {
    clienteNombre: cli.nombre.trim(),
    clienteNif: documentoNormalizado(cli),
    clienteDireccion: cli.direccion,
    clienteTipoId: cli.tipoId,
    clienteContactoId: cli.contactoId,
  };
}

export function contactoSinDocumento(c: Contact): boolean {
  return !(documentoDeContacto(c) ?? '').trim();
}

/**
 * Parche mínimo para escribir el documento del cliente en el contacto, o `null` si no cambia
 * nada. Nunca toca dirección, email ni nombre/apellidos (un nombre suelto no se puede partir
 * con seguridad). Con documento vacío no hay nada que guardar: no se borra el del contacto.
 */
export function parcheContacto(c: Contact, cli: ClienteFactura): Record<string, unknown> | null {
  const documento = documentoNormalizado(cli);
  if (!documento) return null;

  if (c.type === 'persona_fisica') {
    const nifType =
      cli.tipoId === 'nif' ? (/^[XYZ]/.test(documento) ? 'nie' : 'dni') : c.nifType === 'pasaporte' ? 'pasaporte' : 'otro';
    if (c.nifType === nifType && c.nif === documento) return null;
    return { nifType, nif: documento };
  }

  const cifType = cli.tipoId === 'nif' ? 'cif' : c.cifType === 'vat' ? 'vat' : 'otro';
  const razonSocial = cli.nombre.trim();
  if (c.cifType === cifType && c.cif === documento && c.razonSocial === razonSocial) return null;
  return { cifType, cif: documento, razonSocial };
}

/** Búsqueda de contactos por nombre, NIF/CIF, email o teléfono. Sin consulta no devuelve nada. */
export function filtrarContactos(contactos: readonly Contact[], consulta: string, max = 8): Contact[] {
  const q = consulta.trim().toLowerCase();
  if (!q) return [];
  return contactos
    .filter((c) => {
      const campos = [getContactDisplayName(c), documentoDeContacto(c) ?? '', c.email, `${c.phone ?? ''} ${c.mobile ?? ''}`];
      return campos.some((campo) => campo.toLowerCase().includes(q));
    })
    .slice(0, max);
}
