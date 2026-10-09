import { describe, it, expect, vi } from 'vitest';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { LoginComponent } from './login';
import { AuthService } from '../auth.service';

describe('LoginComponent — olvidé la contraseña', () => {
  async function setup(sendPasswordReset = vi.fn().mockResolvedValue(undefined)) {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [LoginComponent],
      providers: [
        {
          provide: AuthService,
          useValue: { isAuthenticated: signal(false), loginWithEmail: vi.fn(), sendPasswordReset },
        },
        { provide: Router, useValue: { navigate: vi.fn() } },
      ],
    });
    await TestBed.compileComponents();
    const fixture = TestBed.createComponent(LoginComponent);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    return { fixture, el, sendPasswordReset };
  }

  function byText(el: HTMLElement, text: string): HTMLButtonElement | undefined {
    return Array.from(el.querySelectorAll('button')).find((b) => b.textContent?.includes(text));
  }

  function typeEmail(el: HTMLElement, value: string): void {
    const input = el.querySelector('#email') as HTMLInputElement;
    input.value = value;
    input.dispatchEvent(new Event('input'));
  }

  it('shows a forgot-password link that switches to the reset view', async () => {
    const { fixture, el } = await setup();
    const link = byText(el, '¿Olvidaste tu contraseña?');
    expect(link).toBeTruthy();

    link!.click();
    fixture.detectChanges();

    expect(el.querySelector('#password')).toBeNull();
    expect(byText(el, 'Enviar enlace')).toBeTruthy();
  });

  it('sends the reset email and shows a generic confirmation', async () => {
    const { fixture, el, sendPasswordReset } = await setup();
    byText(el, '¿Olvidaste tu contraseña?')!.click();
    fixture.detectChanges();

    typeEmail(el, 'ana@example.com');
    byText(el, 'Enviar enlace')!.click();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(sendPasswordReset).toHaveBeenCalledWith('ana@example.com');
    expect(el.querySelector('[role="status"]')?.textContent).toContain('ana@example.com');
  });

  it('does not call the service with an invalid email', async () => {
    const { fixture, el, sendPasswordReset } = await setup();
    byText(el, '¿Olvidaste tu contraseña?')!.click();
    fixture.detectChanges();

    typeEmail(el, 'no-es-un-correo');
    byText(el, 'Enviar enlace')!.click();
    await fixture.whenStable();

    expect(sendPasswordReset).not.toHaveBeenCalled();
    fixture.detectChanges();
    expect(el.querySelector('#email-error')?.textContent).toContain('Ingresá un correo válido');
  });

  it('shows an error when sending fails', async () => {
    const { fixture, el } = await setup(vi.fn().mockRejectedValue(new Error('network')));
    byText(el, '¿Olvidaste tu contraseña?')!.click();
    fixture.detectChanges();

    typeEmail(el, 'ana@example.com');
    byText(el, 'Enviar enlace')!.click();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(el.querySelector('.error-banner')?.textContent).toContain('No se pudo enviar');
  });

  it('returns to the login view', async () => {
    const { fixture, el } = await setup();
    byText(el, '¿Olvidaste tu contraseña?')!.click();
    fixture.detectChanges();

    byText(el, 'Volver a iniciar sesión')!.click();
    fixture.detectChanges();

    expect(el.querySelector('#password')).toBeTruthy();
  });

  it('toggles password visibility with the eye button', async () => {
    const { fixture, el } = await setup();
    const input = el.querySelector('#password') as HTMLInputElement;
    const toggle = el.querySelector('.password-toggle') as HTMLButtonElement;

    expect(input.type).toBe('password');
    expect(toggle.getAttribute('aria-label')).toBe('Mostrar contraseña');
    expect(toggle.getAttribute('aria-pressed')).toBe('false');

    toggle.click();
    fixture.detectChanges();

    expect(input.type).toBe('text');
    expect(toggle.getAttribute('aria-label')).toBe('Ocultar contraseña');
    expect(toggle.getAttribute('aria-pressed')).toBe('true');

    toggle.click();
    fixture.detectChanges();

    expect(input.type).toBe('password');
  });
});

describe('LoginComponent — crear cuenta', () => {
  async function setup(overrides: Record<string, unknown> = {}) {
    TestBed.resetTestingModule();
    const auth = {
      isAuthenticated: signal(false),
      loginWithEmail: vi.fn(),
      loginWithGoogle: vi.fn().mockResolvedValue(undefined),
      registerWithEmail: vi.fn().mockResolvedValue('uid1'),
      sendVerificationEmail: vi.fn().mockResolvedValue(undefined),
      ...overrides,
    };
    const router = { navigate: vi.fn() };
    TestBed.configureTestingModule({
      imports: [LoginComponent],
      providers: [
        { provide: AuthService, useValue: auth },
        { provide: Router, useValue: router },
      ],
    });
    await TestBed.compileComponents();
    const fixture = TestBed.createComponent(LoginComponent);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    return { fixture, el, auth, router };
  }

  const btn = (el: HTMLElement, text: string) =>
    Array.from(el.querySelectorAll('button')).find((b) => b.textContent?.includes(text));

  function escribir(el: HTMLElement, id: string, value: string): void {
    const input = el.querySelector(`#${id}`) as HTMLInputElement;
    input.value = value;
    input.dispatchEvent(new Event('input'));
  }

  async function abrirRegistro(fixture: { detectChanges(): void }, el: HTMLElement) {
    btn(el, 'Crear cuenta')!.click();
    fixture.detectChanges();
  }

  it('ofrece "Crear cuenta" y muestra el formulario de registro', async () => {
    const { fixture, el } = await setup();
    await abrirRegistro(fixture, el);
    expect(el.querySelector('#nombre')).toBeTruthy();
    expect(el.querySelector('#email')).toBeTruthy();
    expect(el.querySelector('#password')).toBeTruthy();
    expect(el.querySelector('.password-toggle')).toBeTruthy();
    expect(el.querySelector('h1')?.textContent).toContain('Crea tu cuenta');
  });

  it('registra, envía la verificación y entra a la app', async () => {
    const { fixture, el, auth, router } = await setup();
    await abrirRegistro(fixture, el);
    escribir(el, 'nombre', 'Ana Pérez');
    escribir(el, 'email', 'ana@example.com');
    escribir(el, 'password', 'secreta123');
    (el.querySelector('form') as HTMLFormElement).dispatchEvent(new Event('submit'));
    await fixture.whenStable();

    expect(auth.registerWithEmail).toHaveBeenCalledWith('ana@example.com', 'secreta123', 'Ana Pérez');
    expect(auth.sendVerificationEmail).toHaveBeenCalled();
    expect(router.navigate).toHaveBeenCalledWith(['/']);
  });

  it('no registra con contraseña corta o campos vacíos', async () => {
    const { fixture, el, auth } = await setup();
    await abrirRegistro(fixture, el);
    escribir(el, 'nombre', 'Ana');
    escribir(el, 'email', 'ana@example.com');
    escribir(el, 'password', '123');
    (el.querySelector('form') as HTMLFormElement).dispatchEvent(new Event('submit'));
    await fixture.whenStable();
    fixture.detectChanges();

    expect(auth.registerWithEmail).not.toHaveBeenCalled();
    expect(el.querySelector('#password-error')?.textContent).toContain('8 caracteres');
  });

  it('un fallo al enviar la verificación no impide entrar', async () => {
    const { fixture, el, router } = await setup({ sendVerificationEmail: vi.fn().mockRejectedValue(new Error('x')) });
    await abrirRegistro(fixture, el);
    escribir(el, 'nombre', 'Ana');
    escribir(el, 'email', 'ana@example.com');
    escribir(el, 'password', 'secreta123');
    (el.querySelector('form') as HTMLFormElement).dispatchEvent(new Event('submit'));
    await fixture.whenStable();
    expect(router.navigate).toHaveBeenCalledWith(['/']);
  });

  it('avisa si el correo ya tiene cuenta', async () => {
    const { fixture, el, router } = await setup({
      registerWithEmail: vi.fn().mockRejectedValue({ code: 'auth/email-already-in-use' }),
    });
    await abrirRegistro(fixture, el);
    escribir(el, 'nombre', 'Ana');
    escribir(el, 'email', 'ana@example.com');
    escribir(el, 'password', 'secreta123');
    (el.querySelector('form') as HTMLFormElement).dispatchEvent(new Event('submit'));
    await fixture.whenStable();
    fixture.detectChanges();

    expect(el.querySelector('.error-banner')?.textContent).toContain('Ya existe una cuenta');
    expect(router.navigate).not.toHaveBeenCalled();
  });

  it('permite registrarse con Google', async () => {
    const { fixture, el, auth, router } = await setup();
    await abrirRegistro(fixture, el);
    btn(el, 'Continuar con Google')!.click();
    await fixture.whenStable();
    expect(auth.loginWithGoogle).toHaveBeenCalled();
    expect(router.navigate).toHaveBeenCalledWith(['/']);
  });

  it('vuelve a iniciar sesión', async () => {
    const { fixture, el } = await setup();
    await abrirRegistro(fixture, el);
    btn(el, 'Ya tengo cuenta')!.click();
    fixture.detectChanges();
    expect(el.querySelector('#nombre')).toBeNull();
    expect(el.querySelector('h1')?.textContent).toContain('Bienvenido');
  });
});
