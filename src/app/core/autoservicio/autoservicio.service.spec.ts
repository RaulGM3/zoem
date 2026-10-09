import { DOCUMENT } from '@angular/common';
import { TestBed } from '@angular/core/testing';
import { Auth } from '@angular/fire/auth';
import { Functions } from '@angular/fire/functions';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ClaimsSyncService } from '../services/claims-sync.service';
import { CompanyService } from '../services/company.service';
import { DemoSeedService } from '../services/demo-seed.service';
import { AutoservicioService, cuentaVerificada, mensajeErrorAlta } from './autoservicio.service';

const m = vi.hoisted(() => ({ httpsCallable: vi.fn(), sendEmailVerification: vi.fn() }));

vi.mock('@angular/fire/auth', () => ({
  Auth: class MockAuth {},
  sendEmailVerification: (...a: unknown[]) => m.sendEmailVerification(...a),
}));
vi.mock('@angular/fire/functions', () => ({
  Functions: class MockFunctions {},
  httpsCallable: (...a: unknown[]) => m.httpsCallable(...a),
}));

describe('cuentaVerificada', () => {
  it('email verificado', () => {
    expect(cuentaVerificada({ emailVerified: true, providerData: [{ providerId: 'password' }] })).toBe(true);
  });
  it('Google cuenta como verificado', () => {
    expect(cuentaVerificada({ emailVerified: false, providerData: [{ providerId: 'google.com' }] })).toBe(true);
  });
  it('password sin verificar no', () => {
    expect(cuentaVerificada({ emailVerified: false, providerData: [{ providerId: 'password' }] })).toBe(false);
  });
  it('sin usuario no', () => {
    expect(cuentaVerificada(null)).toBe(false);
  });
});

describe('mensajeErrorAlta', () => {
  it('traduce los códigos conocidos', () => {
    expect(mensajeErrorAlta({ code: 'functions/failed-precondition' })).toMatch(/verifica tu correo/i);
    expect(mensajeErrorAlta({ code: 'functions/already-exists' })).toMatch(/ya tienes/i);
    expect(mensajeErrorAlta({ code: 'functions/invalid-argument' })).toMatch(/revisa/i);
  });
  it('mensaje genérico para lo desconocido', () => {
    expect(mensajeErrorAlta(new Error('x'))).toMatch(/no se pudo/i);
  });
});

describe('AutoservicioService', () => {
  const getIdToken = vi.fn();
  const reload = vi.fn();
  const user = { emailVerified: false, providerData: [{ providerId: 'password' }], getIdToken, reload };
  const auth = { currentUser: user as unknown };
  const assign = vi.fn();
  const seleccionarEmpresa = vi.fn();
  const sync = vi.fn();
  const cargar = vi.fn();
  const llamar = vi.fn();

  beforeEach(() => {
    [getIdToken, reload, assign, seleccionarEmpresa, sync, cargar, llamar, m.sendEmailVerification].forEach((f) => f.mockReset());
    getIdToken.mockResolvedValue('t');
    reload.mockResolvedValue(undefined);
    sync.mockResolvedValue(undefined);
    cargar.mockResolvedValue({});
    m.httpsCallable.mockReturnValue(llamar);
    user.emailVerified = false;
    auth.currentUser = user;
    TestBed.configureTestingModule({
      providers: [
        { provide: Auth, useValue: auth },
        { provide: Functions, useValue: {} },
        { provide: CompanyService, useValue: { seleccionarEmpresa } },
        { provide: ClaimsSyncService, useValue: { sync } },
        { provide: DemoSeedService, useValue: { cargar } },
        { provide: DOCUMENT, useValue: { location: { assign } } },
      ],
    });
  });

  it('crearEmpresa refresca el token (email_verified) y llama a la callable', async () => {
    llamar.mockResolvedValue({ data: { companyId: 'c9', yaExistia: false } });
    const id = await TestBed.inject(AutoservicioService).crearEmpresa({
      nombre: 'García', tipoPersona: 'fisica', ca: 'madrid',
    });
    expect(getIdToken).toHaveBeenCalledWith(true);
    expect(m.httpsCallable).toHaveBeenCalledWith(expect.anything(), 'crearEmpresaAutoservicio');
    expect(llamar).toHaveBeenCalledWith({ nombre: 'García', tipoPersona: 'fisica', ca: 'madrid' });
    expect(id).toBe('c9');
  });

  it('crearEmpresa traduce el error de la callable', async () => {
    llamar.mockRejectedValue({ code: 'functions/failed-precondition' });
    await expect(
      TestBed.inject(AutoservicioService).crearEmpresa({ nombre: 'G', tipoPersona: 'fisica', ca: 'madrid' }),
    ).rejects.toThrow(/verifica tu correo/i);
  });

  it('crearDemo llama a crearDespachoDemo con el nombre', async () => {
    llamar.mockResolvedValue({ data: { companyId: 'd1', yaExistia: false } });
    expect(await TestBed.inject(AutoservicioService).crearDemo('García')).toBe('d1');
    expect(m.httpsCallable).toHaveBeenCalledWith(expect.anything(), 'crearDespachoDemo');
    expect(llamar).toHaveBeenCalledWith({ nombre: 'García' });
  });

  it('sembrarDemo sincroniza claims ANTES de sembrar y lo hace como miembro, con documentos', async () => {
    const orden: string[] = [];
    sync.mockImplementation(async () => void orden.push('claims'));
    cargar.mockImplementation(async () => void orden.push('seed'));
    const progreso = vi.fn();
    await TestBed.inject(AutoservicioService).sembrarDemo('d1', progreso);
    expect(sync).toHaveBeenCalledWith('d1');
    expect(cargar).toHaveBeenCalledWith('d1', { documentos: true, comoMiembro: true }, progreso);
    expect(orden).toEqual(['claims', 'seed']);
  });

  it('comprobarVerificacion recarga el usuario y refresca el token', async () => {
    reload.mockImplementation(async () => { user.emailVerified = true; });
    expect(await TestBed.inject(AutoservicioService).comprobarVerificacion()).toBe(true);
    expect(getIdToken).toHaveBeenCalledWith(true);
  });

  it('reenviarVerificacion envía el correo al usuario actual', async () => {
    await TestBed.inject(AutoservicioService).reenviarVerificacion();
    expect(m.sendEmailVerification).toHaveBeenCalledWith(user);
  });

  it('entrar guarda el despacho elegido y recarga la app', () => {
    TestBed.inject(AutoservicioService).entrar('c9');
    expect(seleccionarEmpresa).toHaveBeenCalledWith('c9');
    expect(assign).toHaveBeenCalledWith('/');
  });
});
