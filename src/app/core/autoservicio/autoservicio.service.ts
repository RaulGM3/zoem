import { DOCUMENT } from '@angular/common';
import { inject, Injectable } from '@angular/core';
import { Auth, sendEmailVerification } from '@angular/fire/auth';
import { Functions, httpsCallable } from '@angular/fire/functions';
import type { ComunidadAutonoma, TipoPersona } from '../../interfaces/company';
import { ClaimsSyncService } from '../services/claims-sync.service';
import { CompanyService } from '../services/company.service';
import { DemoSeedService, type ProgresoSeed } from '../services/demo-seed.service';

export interface DatosAlta {
  nombre: string;
  tipoPersona: TipoPersona;
  ca: ComunidadAutonoma;
  /** Libre y opcional (rubro/especialidad principal). */
  especialidad?: string;
  /** IANA; define el mes de los cupos mensuales. */
  zonaHoraria: string;
}

interface RespuestaAlta {
  companyId: string;
  yaExistia: boolean;
}

interface UsuarioVerificable {
  emailVerified: boolean;
  providerData: readonly { providerId: string }[];
}

/** Misma regla que la callable: email verificado o proveedor Google (que ya verifica el correo). */
export function cuentaVerificada(user: UsuarioVerificable | null | undefined): boolean {
  if (!user) return false;
  return user.emailVerified || user.providerData.some((p) => p.providerId === 'google.com');
}

export function mensajeErrorAlta(err: unknown): string {
  const code = typeof err === 'object' && err !== null ? (err as { code?: string }).code : undefined;
  switch (code) {
    case 'functions/failed-precondition':
      return 'Verifica tu correo electrónico para continuar. Revisa tu bandeja de entrada.';
    case 'functions/already-exists':
      return 'Ya tienes un despacho creado con esta cuenta.';
    case 'functions/invalid-argument':
      return 'Revisa los datos del formulario.';
    default:
      return 'No se pudo completar el alta. Inténtalo de nuevo en unos minutos.';
  }
}

/**
 * Alta en autoservicio: las empresas las crea el servidor (las rules no dejan al cliente),
 * aquí solo se orquesta: token fresco -> callable -> claims -> seed del despacho demo -> entrar.
 */
@Injectable({ providedIn: 'root' })
export class AutoservicioService {
  private readonly auth = inject(Auth);
  private readonly functions = inject(Functions);
  private readonly companies = inject(CompanyService);
  private readonly claims = inject(ClaimsSyncService);
  private readonly seed = inject(DemoSeedService);
  private readonly document = inject(DOCUMENT);

  verificada(): boolean {
    return cuentaVerificada(this.auth.currentUser);
  }

  async reenviarVerificacion(): Promise<void> {
    const user = this.auth.currentUser;
    if (user) await sendEmailVerification(user);
  }

  /** Tras pulsar el enlace del correo: recarga el usuario y fuerza un token con `email_verified`. */
  async comprobarVerificacion(): Promise<boolean> {
    const user = this.auth.currentUser;
    if (!user) return false;
    await user.reload();
    await user.getIdToken(true);
    return cuentaVerificada(user);
  }

  async crearEmpresa(datos: DatosAlta): Promise<string> {
    return this.llamar('crearEmpresaAutoservicio', datos);
  }

  async crearDemo(nombre: string, zonaHoraria: string): Promise<string> {
    return this.llamar('crearDespachoDemo', { nombre, zonaHoraria });
  }

  /** Las Storage rules usan claims: se alinean con el despacho demo antes de subir sus documentos. */
  async sembrarDemo(companyId: string, onProgreso: (p: ProgresoSeed) => void): Promise<void> {
    await this.claims.sync(companyId);
    await this.seed.cargar(companyId, { documentos: true, comoMiembro: true }, onProgreso);
  }

  /** Activa el despacho y recarga la app entera (servicios singleton + claims frescos). */
  entrar(companyId: string): void {
    this.companies.seleccionarEmpresa(companyId);
    this.document.location.assign('/');
  }

  private async llamar(nombre: string, datos: unknown): Promise<string> {
    try {
      // El token debe traer email_verified actualizado: la callable lo exige.
      await this.auth.currentUser?.getIdToken(true);
      const { data } = await httpsCallable<unknown, RespuestaAlta>(this.functions, nombre)(datos);
      return data.companyId;
    } catch (err) {
      throw new Error(mensajeErrorAlta(err), { cause: err });
    }
  }
}
