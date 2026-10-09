// Constructores PUROS de los documentos que crean los callables de autoservicio.
// Los valores de servidor (serverTimestamp) los añade el callable, no se mezclan acá.
import { derechosParaDoc } from '../planes/derechosDoc';
import { suscripcionDemo, suscripcionInicial } from './suscripcion';
import type { AltaEmpresa } from './validar';

export interface ContextoAlta {
  uid: string;
  email: string;
  slug: string;
  ahora: Date;
}

export function empresaAutoservicioDoc(alta: AltaEmpresa, ctx: ContextoAlta) {
  const suscripcion = suscripcionInicial(ctx.ahora);
  return {
    name: alta.nombre,
    slug: ctx.slug,
    tipoPersona: alta.tipoPersona,
    ca: alta.ca,
    rubro: alta.rubro,
    ...(alta.especialidad ? { especialidad: alta.especialidad } : {}),
    email: ctx.email,
    isActive: true,
    status: 'active' as const,
    createdBy: ctx.uid,
    autoservicio: true,
    suscripcion,
    // Denormalizado para las rules (ver planes/derechosDoc.ts); el trigger lo mantiene al cambiar `suscripcion`.
    derechos: derechosParaDoc(suscripcion, ctx.ahora),
  };
}

export function empresaDemoDoc(nombre: string, ctx: ContextoAlta) {
  const suscripcion = suscripcionDemo(ctx.ahora);
  return {
    name: `Despacho Demo – ${nombre}`,
    slug: ctx.slug,
    tipoPersona: 'juridica' as const,
    ca: 'madrid' as const,
    rubro: 'abogados' as const,
    email: ctx.email,
    isActive: true,
    status: 'active' as const,
    createdBy: ctx.uid,
    esDemo: true,
    suscripcion,
    derechos: derechosParaDoc(suscripcion, ctx.ahora),
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
