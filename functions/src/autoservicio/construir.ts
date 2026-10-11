// Constructores PUROS de los documentos que crean los callables de autoservicio.
// Los valores de servidor (serverTimestamp) los añade el callable, no se mezclan acá.
import { derechosParaDoc } from '../planes/derechosDoc';
import { paisPorCodigo, type CodigoPais } from '../paises/catalogo-paises';
import { ZONA_POR_DEFECTO } from '../uso/periodo';
import { suscripcionDemo, suscripcionInicial } from './suscripcion';
import type { AltaEmpresa } from './validar';

export interface ContextoAlta {
  uid: string;
  email: string;
  slug: string;
  ahora: Date;
  /** Solo para la demo; en el alta real la zona viaja en `AltaEmpresa`. */
  zonaHoraria?: string;
  /** Solo para la demo (por defecto España/EUR). */
  pais?: CodigoPais;
  moneda?: string;
}

/** España guarda la comunidad en `ca` (Verifactu y plazos la leen); el resto en `region` (ISO 3166-2). */
function geoDoc(pais: CodigoPais, region: string) {
  return pais === 'ES' ? { ca: region } : { region };
}

export function empresaAutoservicioDoc(alta: AltaEmpresa, ctx: ContextoAlta) {
  const suscripcion = suscripcionInicial(ctx.ahora);
  return {
    name: alta.nombre,
    slug: ctx.slug,
    tipoPersona: alta.tipoPersona,
    pais: alta.pais,
    moneda: alta.moneda,
    ...geoDoc(alta.pais, alta.region),
    ...(alta.ciudad ? { ciudad: alta.ciudad } : {}),
    ...(alta.ubicacion ? { ubicacion: alta.ubicacion } : {}),
    rubro: alta.rubro,
    ...(alta.especialidad ? { especialidad: alta.especialidad } : {}),
    zonaHoraria: alta.zonaHoraria,
    email: ctx.email,
    isActive: true,
    status: 'active' as const,
    createdBy: ctx.uid,
    autoservicio: true,
    suscripcion,
    // Denormalizado para las rules (ver planes/derechosDoc.ts); el trigger lo mantiene al cambiar `suscripcion`.
    derechos: derechosParaDoc(suscripcion, ctx.ahora, alta.zonaHoraria),
  };
}

export function empresaDemoDoc(nombre: string, ctx: ContextoAlta) {
  const suscripcion = suscripcionDemo(ctx.ahora);
  const pais = ctx.pais ?? 'ES';
  const p = paisPorCodigo(pais);
  const zonaHoraria = ctx.zonaHoraria ?? (ctx.pais ? p.zonaPorDefecto : ZONA_POR_DEFECTO);
  return {
    name: `Despacho Demo – ${nombre}`,
    slug: ctx.slug,
    tipoPersona: 'juridica' as const,
    pais,
    moneda: ctx.moneda ?? p.moneda,
    // La capital del país.
    ...geoDoc(pais, p.regionCapital),
    rubro: 'abogados' as const,
    zonaHoraria,
    email: ctx.email,
    isActive: true,
    status: 'active' as const,
    createdBy: ctx.uid,
    esDemo: true,
    suscripcion,
    derechos: derechosParaDoc(suscripcion, ctx.ahora, zonaHoraria),
  };
}

export function partirNombre(nombreCompleto: string | undefined, email: string): { nombre: string; apellido: string } {
  const partes = (nombreCompleto ?? '').trim().split(/\s+/).filter(Boolean);
  if (partes.length === 0) return { nombre: email.split('@')[0] ?? email, apellido: '' };
  return { nombre: partes[0], apellido: partes.slice(1).join(' ') };
}

export function miembroAdminDoc(
  companyId: string,
  u: { uid: string; email: string; nombreCompleto?: string },
) {
  return {
    companyId,
    userId: u.uid,
    email: u.email,
    ...partirNombre(u.nombreCompleto, u.email),
    telefono: '',
    role: 'Admin' as const,
    departamento: '',
    estado: 'activo' as const,
    ultimoLogin: null,
  };
}
