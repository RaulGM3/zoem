import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthService } from '../../auth/auth.service';
import { AutoservicioService } from '../../core/autoservicio/autoservicio.service';
import { BienvenidaComponent } from './bienvenida';

describe('BienvenidaComponent', () => {
  const svc = {
    verificada: vi.fn(),
    comprobarVerificacion: vi.fn(),
    reenviarVerificacion: vi.fn(),
    crearEmpresa: vi.fn(),
    crearDemo: vi.fn(),
    sembrarDemo: vi.fn(),
    entrar: vi.fn(),
  };
  const logout = vi.fn();

  beforeEach(() => {
    Object.values(svc).forEach((f) => f.mockReset());
    svc.verificada.mockReturnValue(true);
    svc.comprobarVerificacion.mockResolvedValue(true);
    svc.reenviarVerificacion.mockResolvedValue(undefined);
    svc.crearEmpresa.mockResolvedValue('real1');
    svc.crearDemo.mockResolvedValue('demo1');
    svc.sembrarDemo.mockResolvedValue(undefined);
    logout.mockReset();
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [BienvenidaComponent],
      providers: [
        { provide: AutoservicioService, useValue: svc },
        { provide: AuthService, useValue: { logout } },
      ],
    });
  });

  function render() {
    const fixture = TestBed.createComponent(BienvenidaComponent);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    return { fixture, el };
  }

  function escribir(el: HTMLElement, id: string, value: string): void {
    const input = el.querySelector(`#${id}`) as HTMLInputElement | HTMLSelectElement;
    input.value = value;
    input.dispatchEvent(new Event(input instanceof HTMLSelectElement ? 'change' : 'input'));
  }

  function rellenar(el: HTMLElement): void {
    escribir(el, 'bv-nombre', 'García & Asociados');
    (el.querySelector('input[type="radio"][value="juridica"]') as HTMLInputElement).click();
    escribir(el, 'bv-ca', 'madrid');
    escribir(el, 'bv-zona', 'America/Bogota');
  }

  async function enviar(fixture: { whenStable(): Promise<unknown>; detectChanges(): void }, el: HTMLElement) {
    (el.querySelector('form') as HTMLFormElement).dispatchEvent(new Event('submit'));
    await fixture.whenStable();
    fixture.detectChanges();
  }

  it('muestra el formulario con las 19 comunidades y el despacho de ejemplo marcado', () => {
    const { el } = render();
    expect(el.querySelector('h1')?.textContent).toContain('Bienvenido');
    expect(el.querySelectorAll('#bv-ca option').length).toBeGreaterThanOrEqual(19);
    expect((el.querySelector('#bv-ejemplo') as HTMLInputElement).checked).toBe(true);
    expect(el.querySelector('[data-testid="aviso-verificacion"]')).toBeNull();
  });

  it('la zona horaria viene precargada con la del navegador y se puede cambiar', () => {
    const { el } = render();
    const sel = el.querySelector('#bv-zona') as HTMLSelectElement;
    expect(sel).not.toBeNull();
    expect(sel.value).toBe(Intl.DateTimeFormat().resolvedOptions().timeZone);
    expect(Array.from(sel.options).map((o) => o.value)).toContain('America/Argentina/Buenos_Aires');
  });

  it('no crea nada si el formulario es inválido y muestra los errores', async () => {
    const { fixture, el } = render();
    await enviar(fixture, el);
    expect(svc.crearEmpresa).not.toHaveBeenCalled();
    expect(el.querySelector('#bv-nombre-error')?.textContent).toContain('nombre');
  });

  it('crea el despacho, el de ejemplo, lo siembra y entra al real', async () => {
    const { fixture, el } = render();
    rellenar(el);
    escribir(el, 'bv-especialidad', 'Civil');
    await enviar(fixture, el);

    expect(svc.crearEmpresa).toHaveBeenCalledWith({
      nombre: 'García & Asociados', tipoPersona: 'juridica', ca: 'madrid', especialidad: 'Civil',
      zonaHoraria: 'America/Bogota',
    });
    expect(svc.crearDemo).toHaveBeenCalledWith('García & Asociados', 'America/Bogota');
    expect(svc.sembrarDemo).toHaveBeenCalledWith('demo1', expect.any(Function));
    expect(svc.entrar).toHaveBeenCalledWith('real1');
  });

  it('sin despacho de ejemplo no llama a la demo', async () => {
    const { fixture, el } = render();
    rellenar(el);
    (el.querySelector('#bv-ejemplo') as HTMLInputElement).click();
    await enviar(fixture, el);
    expect(svc.crearDemo).not.toHaveBeenCalled();
    expect(svc.entrar).toHaveBeenCalledWith('real1');
  });

  it('omite la especialidad vacía', async () => {
    const { fixture, el } = render();
    rellenar(el);
    await enviar(fixture, el);
    expect(svc.crearEmpresa.mock.calls[0][0]).not.toHaveProperty('especialidad');
  });

  it('si la demo falla, no entra solo: avisa y ofrece continuar', async () => {
    svc.sembrarDemo.mockRejectedValue(new Error('boom'));
    const { fixture, el } = render();
    rellenar(el);
    await enviar(fixture, el);

    expect(svc.entrar).not.toHaveBeenCalled();
    const aviso = el.querySelector('[data-testid="aviso-demo"]');
    expect(aviso?.textContent).toContain('ejemplo');
    (aviso!.querySelector('button') as HTMLButtonElement).click();
    expect(svc.entrar).toHaveBeenCalledWith('real1');
  });

  it('muestra el error del alta y permite reintentar', async () => {
    svc.crearEmpresa.mockRejectedValue(new Error('Ya tienes un despacho creado con esta cuenta.'));
    const { fixture, el } = render();
    rellenar(el);
    await enviar(fixture, el);
    expect(el.querySelector('[role="alert"].bv-error')?.textContent).toContain('Ya tienes un despacho');
    expect(svc.entrar).not.toHaveBeenCalled();
    expect((el.querySelector('button[type="submit"]') as HTMLButtonElement).disabled).toBe(false);
  });

  describe('email sin verificar', () => {
    beforeEach(() => svc.verificada.mockReturnValue(false));

    it('muestra el aviso y permite reenviar el correo', async () => {
      const { fixture, el } = render();
      expect(el.querySelector('[data-testid="aviso-verificacion"]')).toBeTruthy();
      (el.querySelector('[data-testid="reenviar"]') as HTMLButtonElement).click();
      await fixture.whenStable();
      expect(svc.reenviarVerificacion).toHaveBeenCalled();
    });

    it('al enviar comprueba la verificación: si sigue sin verificar, no crea nada', async () => {
      svc.comprobarVerificacion.mockResolvedValue(false);
      const { fixture, el } = render();
      rellenar(el);
      await enviar(fixture, el);
      expect(svc.crearEmpresa).not.toHaveBeenCalled();
      expect(el.querySelector('[role="alert"].bv-error')?.textContent).toContain('Verifica tu correo');
    });

    it('si ya la verificó, continúa con el alta', async () => {
      svc.comprobarVerificacion.mockResolvedValue(true);
      const { fixture, el } = render();
      rellenar(el);
      await enviar(fixture, el);
      expect(svc.crearEmpresa).toHaveBeenCalled();
    });
  });

  it('permite cerrar sesión', () => {
    const { el } = render();
    Array.from(el.querySelectorAll('button')).find((b) => b.textContent?.includes('Cerrar sesión'))!.click();
    expect(logout).toHaveBeenCalled();
  });
});
