import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthService } from '../../auth/auth.service';
import { AutoservicioService } from '../../core/autoservicio/autoservicio.service';
import { PlacesService } from '../../core/ubicacion/places.service';
import { BienvenidaComponent } from './bienvenida';

describe('BienvenidaComponent', () => {
  const svc = {
    verificada: vi.fn(),
    comprobarVerificacion: vi.fn(),
    reenviarVerificacion: vi.fn(),
    crearEmpresa: vi.fn(),
    crearDemo: vi.fn(),
    sugerirPais: vi.fn(),
    sembrarDemo: vi.fn(),
    entrar: vi.fn(),
  };
  const logout = vi.fn();
  const placesDisponible = signal(false);
  const places = { disponible: placesDisponible, buscar: vi.fn(), elegir: vi.fn() };

  beforeEach(() => {
    Object.values(svc).forEach((f) => f.mockReset());
    svc.verificada.mockReturnValue(true);
    svc.comprobarVerificacion.mockResolvedValue(true);
    svc.reenviarVerificacion.mockResolvedValue(undefined);
    svc.crearEmpresa.mockResolvedValue('real1');
    svc.crearDemo.mockResolvedValue('demo1');
    svc.sembrarDemo.mockResolvedValue(undefined);
    svc.sugerirPais.mockResolvedValue(null);
    placesDisponible.set(false);
    places.buscar.mockReset();
    places.elegir.mockReset();
    logout.mockReset();
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [BienvenidaComponent],
      providers: [
        { provide: AutoservicioService, useValue: svc },
        { provide: PlacesService, useValue: places },
        { provide: AuthService, useValue: { logout, user: () => ({ email: 'ana@despacho.es' }) } },
      ],
    });
  });

  afterEach(() => vi.restoreAllMocks());

  function zonaDelNavegadorEs(zona: string) {
    vi.spyOn(Intl.DateTimeFormat.prototype, 'resolvedOptions').mockReturnValue({ timeZone: zona } as Intl.ResolvedDateTimeFormatOptions);
  }

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

  function chip(el: HTMLElement, texto: string): HTMLButtonElement {
    return Array.from(el.querySelectorAll<HTMLButtonElement>('.auth-chip')).find((b) => b.textContent?.trim() === texto)!;
  }

  function rellenar(el: HTMLElement): void {
    escribir(el, 'bv-nombre', 'García & Asociados');
    (el.querySelector('input[type="radio"][value="juridica"]') as HTMLInputElement).click();
    escribir(el, 'bv-region', 'madrid');
    escribir(el, 'bv-zona', 'America/Bogota');
  }

  async function enviar(fixture: { whenStable(): Promise<unknown>; detectChanges(): void }, el: HTMLElement) {
    (el.querySelector('form') as HTMLFormElement).dispatchEvent(new Event('submit'));
    await fixture.whenStable();
    fixture.detectChanges();
  }

  it('muestra el formulario con España, las 19 comunidades y el despacho de ejemplo marcado', () => {
    const { el } = render();
    expect(el.querySelector('h1')?.textContent).toContain('Bienvenido');
    expect((el.querySelector('#bv-pais') as HTMLSelectElement).value).toBe('ES');
    expect(el.querySelector('label[for="bv-region"]')?.textContent).toContain('Comunidad autónoma');
    expect(el.querySelectorAll('#bv-region option').length).toBeGreaterThanOrEqual(19);
    expect((el.querySelector('#bv-ejemplo') as HTMLInputElement).checked).toBe(true);
    expect(el.querySelector('[data-testid="aviso-verificacion"]')).toBeNull();
  });

  it('el orden es País, Ciudad, Región, Zona horaria y Moneda, cada uno con su label', () => {
    const { el } = render();
    const ids = ['bv-pais', 'bv-ciudad', 'bv-region', 'bv-zona', 'bv-moneda'];
    const campos = ids.map((id) => el.querySelector(`#${id}`)!);
    campos.forEach((c, i) => {
      expect(c, ids[i]).not.toBeNull();
      expect(el.querySelector(`label[for="${ids[i]}"]`), `label ${ids[i]}`).not.toBeNull();
    });
    for (let i = 1; i < campos.length; i++) {
      expect(campos[i - 1].compareDocumentPosition(campos[i]) & Node.DOCUMENT_POSITION_FOLLOWING, ids[i]).toBeTruthy();
    }
    expect(Array.from((el.querySelector('#bv-pais') as HTMLSelectElement).options).map((o) => o.value)).toEqual(['ES', 'CO', 'CL', 'MX']);
  });

  it('la zona horaria viene precargada con la sugerida del país y se puede cambiar', () => {
    const { el } = render();
    const sel = el.querySelector('#bv-zona') as HTMLSelectElement;
    expect(sel.value).toBe('Europe/Madrid');
    expect(Array.from(sel.options).map((o) => o.value)).toContain('America/Argentina/Buenos_Aires');
  });

  it('la moneda es la local, solo las permitidas, con el aviso de que no se podrá cambiar', () => {
    const { el } = render();
    const m = el.querySelector('#bv-moneda') as HTMLSelectElement;
    expect(Array.from(m.options).map((o) => o.value)).toEqual(['EUR']);
    expect(el.textContent).toContain('No podrás cambiarla después del alta');
  });

  describe('país', () => {
    async function cambiarPais(f: ReturnType<typeof render>, pais: string) {
      escribir(f.el, 'bv-pais', pais);
      f.fixture.detectChanges();
      await f.fixture.whenStable();
      f.fixture.detectChanges();
    }

    it('sugerido por el servidor: viene marcado y avisa, sin decidir por el usuario', async () => {
      svc.sugerirPais.mockResolvedValue('CO');
      const f = render();
      await f.fixture.whenStable();
      f.fixture.detectChanges();
      expect((f.el.querySelector('#bv-pais') as HTMLSelectElement).value).toBe('CO');
      expect(f.el.textContent).toContain('Detectamos que estás en Colombia');
      expect((f.el.querySelector('#bv-moneda') as HTMLSelectElement).value).toBe('COP');
      expect((f.el.querySelector('#bv-zona') as HTMLSelectElement).value).toBe('America/Bogota');
      expect(f.el.querySelector('label[for="bv-region"]')?.textContent).toContain('Departamento');
    });

    it('si el servidor no sabe, usa la zona del navegador', async () => {
      zonaDelNavegadorEs('America/Mexico_City');
      const f = render();
      await f.fixture.whenStable();
      f.fixture.detectChanges();
      expect((f.el.querySelector('#bv-pais') as HTMLSelectElement).value).toBe('MX');
      expect(f.el.textContent).toContain('Detectamos que estás en México');
    });

    it('si la detección falla, se queda en España sin aviso y sin romper', async () => {
      svc.sugerirPais.mockRejectedValue(new Error('x'));
      zonaDelNavegadorEs('Asia/Tokyo');
      const f = render();
      await f.fixture.whenStable();
      f.fixture.detectChanges();
      expect((f.el.querySelector('#bv-pais') as HTMLSelectElement).value).toBe('ES');
      expect(f.el.textContent).not.toContain('Detectamos');
    });

    it('si el usuario ya eligió país, la detección tardía no lo pisa', async () => {
      let resolver!: (v: string) => void;
      svc.sugerirPais.mockReturnValue(new Promise((r) => (resolver = r)));
      const f = render();
      await cambiarPais(f, 'CL');
      resolver('CO');
      await f.fixture.whenStable();
      f.fixture.detectChanges();
      expect((f.el.querySelector('#bv-pais') as HTMLSelectElement).value).toBe('CL');
      expect(f.el.textContent).not.toContain('Detectamos');
    });

    it('al cambiar de país se reinician ciudad, región, zona y moneda', async () => {
      const f = render();
      escribir(f.el, 'bv-ciudad', 'Madrid');
      escribir(f.el, 'bv-region', 'madrid');
      escribir(f.el, 'bv-zona', 'America/Lima');
      f.fixture.detectChanges();
      await cambiarPais(f, 'MX');

      expect((f.el.querySelector('#bv-ciudad') as HTMLInputElement).value).toBe('');
      expect((f.el.querySelector('#bv-region') as HTMLSelectElement).value).toBe('');
      expect((f.el.querySelector('#bv-zona') as HTMLSelectElement).value).toBe('America/Mexico_City');
      const m = f.el.querySelector('#bv-moneda') as HTMLSelectElement;
      expect(Array.from(m.options).map((o) => o.value)).toEqual(['MXN', 'USD']);
      expect(m.value).toBe('MXN');
      expect(f.el.querySelector('label[for="bv-region"]')?.textContent).toContain('Estado');
      expect(f.el.querySelectorAll('#bv-region option').length).toBe(33); // 32 + "Selecciona…"
    });

    it('la región con zona propia ajusta la zona sugerida (Quintana Roo -> Cancún)', async () => {
      const f = render();
      await cambiarPais(f, 'MX');
      escribir(f.el, 'bv-region', 'MX-ROO');
      f.fixture.detectChanges();
      expect((f.el.querySelector('#bv-zona') as HTMLSelectElement).value).toBe('America/Cancun');
    });

    it('no pisa una zona que el usuario cambió a mano', async () => {
      const f = render();
      await cambiarPais(f, 'MX');
      escribir(f.el, 'bv-zona', 'America/Lima');
      escribir(f.el, 'bv-region', 'MX-ROO');
      f.fixture.detectChanges();
      expect((f.el.querySelector('#bv-zona') as HTMLSelectElement).value).toBe('America/Lima');
    });
  });

  describe('ciudad con Google Places', () => {
    it('al elegir una ciudad se rellena la región desde el catálogo y se envía la ubicación', async () => {
      placesDisponible.set(true);
      places.elegir.mockResolvedValue({ placeId: 'ChIJmed', nombre: 'Medellín', lat: 6.24, lng: -75.58, regionNombre: 'Antioquia' });
      places.buscar.mockResolvedValue([{ placeId: 'ChIJmed', principal: 'Medellín', secundario: 'Antioquia, Colombia', texto: 'Medellín, Antioquia, Colombia' }]);
      vi.useFakeTimers();
      try {
        const f = render();
        escribir(f.el, 'bv-pais', 'CO');
        f.fixture.detectChanges();
        escribir(f.el, 'bv-nombre', 'Pérez');
        (f.el.querySelector('input[type="radio"][value="fisica"]') as HTMLInputElement).click();
        escribir(f.el, 'bv-ciudad', 'Medel');
        await vi.advanceTimersByTimeAsync(300);
        f.fixture.detectChanges();
        expect(places.buscar).toHaveBeenCalledWith('Medel', 'CO');
        (f.el.querySelector('[role="option"]') as HTMLElement).click();
        await vi.advanceTimersByTimeAsync(0);
        f.fixture.detectChanges();

        expect((f.el.querySelector('#bv-region') as HTMLSelectElement).value).toBe('CO-ANT');
        expect((f.el.querySelector('#bv-ciudad') as HTMLInputElement).value).toBe('Medellín');
        vi.useRealTimers();
        await enviar(f.fixture, f.el);
        expect(svc.crearEmpresa).toHaveBeenCalledWith({
          nombre: 'Pérez', tipoPersona: 'fisica', pais: 'CO', region: 'CO-ANT', moneda: 'COP',
          ciudad: 'Medellín', ubicacion: { placeId: 'ChIJmed', lat: 6.24, lng: -75.58 }, zonaHoraria: 'America/Bogota',
        });
      } finally {
        vi.useRealTimers();
      }
    });

    it('si Google devuelve una región que no está en el catálogo, no marca ninguna: la elige el usuario', async () => {
      placesDisponible.set(true);
      places.elegir.mockResolvedValue({ placeId: 'x', nombre: 'Ciudad', lat: 1, lng: 2, regionNombre: 'Narnia' });
      places.buscar.mockResolvedValue([{ placeId: 'x', principal: 'Ciudad', secundario: '', texto: 'Ciudad' }]);
      vi.useFakeTimers();
      try {
        const f = render();
        escribir(f.el, 'bv-pais', 'CO');
        f.fixture.detectChanges();
        escribir(f.el, 'bv-ciudad', 'Ciu');
        await vi.advanceTimersByTimeAsync(300);
        f.fixture.detectChanges();
        (f.el.querySelector('[role="option"]') as HTMLElement).click();
        await vi.advanceTimersByTimeAsync(0);
        f.fixture.detectChanges();
        expect((f.el.querySelector('#bv-region') as HTMLSelectElement).value).toBe('');
      } finally {
        vi.useRealTimers();
      }
    });

    it('con Places caído la ciudad es texto libre y el alta funciona igual, sin ubicación', async () => {
      placesDisponible.set(false);
      const f = render();
      rellenar(f.el);
      escribir(f.el, 'bv-ciudad', '  Sevilla ');
      await enviar(f.fixture, f.el);
      const datos = svc.crearEmpresa.mock.calls[0][0];
      expect(datos.ciudad).toBe('Sevilla');
      expect(datos).not.toHaveProperty('ubicacion');
    });

    it('sin ciudad no se envía ciudad', async () => {
      const f = render();
      rellenar(f.el);
      await enviar(f.fixture, f.el);
      expect(svc.crearEmpresa.mock.calls[0][0]).not.toHaveProperty('ciudad');
    });
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
    chip(el, 'Civil').click();
    await enviar(fixture, el);

    expect(svc.crearEmpresa).toHaveBeenCalledWith({
      nombre: 'García & Asociados', tipoPersona: 'juridica', pais: 'ES', region: 'madrid', moneda: 'EUR',
      especialidad: 'Civil', zonaHoraria: 'America/Bogota',
    });
    expect(svc.crearDemo).toHaveBeenCalledWith('García & Asociados', { pais: 'ES', moneda: 'EUR', zonaHoraria: 'America/Bogota' });
    expect(svc.sembrarDemo).toHaveBeenCalledWith('demo1', expect.any(Function));
    expect(svc.entrar).toHaveBeenCalledWith('real1');
  });

  it('la demo hereda país, moneda y zona del usuario', async () => {
    const { fixture, el } = render();
    escribir(el, 'bv-pais', 'CL');
    fixture.detectChanges();
    escribir(el, 'bv-nombre', 'Soto');
    (el.querySelector('input[type="radio"][value="fisica"]') as HTMLInputElement).click();
    escribir(el, 'bv-region', 'CL-RM');
    escribir(el, 'bv-moneda', 'USD');
    fixture.detectChanges();
    await enviar(fixture, el);
    expect(svc.crearEmpresa.mock.calls[0][0]).toMatchObject({ pais: 'CL', region: 'CL-RM', moneda: 'USD', zonaHoraria: 'America/Santiago' });
    expect(svc.crearDemo).toHaveBeenCalledWith('Soto', { pais: 'CL', moneda: 'USD', zonaHoraria: 'America/Santiago' });
  });

  it('exige la región (con la etiqueta del país)', async () => {
    const { fixture, el } = render();
    escribir(el, 'bv-nombre', 'García');
    (el.querySelector('input[type="radio"][value="juridica"]') as HTMLInputElement).click();
    await enviar(fixture, el);
    expect(svc.crearEmpresa).not.toHaveBeenCalled();
    expect(el.querySelector('#bv-region-error')?.textContent).toContain('comunidad autónoma');
  });

  it('sin despacho de ejemplo no llama a la demo', async () => {
    const { fixture, el } = render();
    rellenar(el);
    (el.querySelector('#bv-ejemplo') as HTMLInputElement).click();
    await enviar(fixture, el);
    expect(svc.crearDemo).not.toHaveBeenCalled();
    expect(svc.entrar).toHaveBeenCalledWith('real1');
  });

  it('las especialidades se eligen con chips y se envían juntas', async () => {
    const { fixture, el } = render();
    rellenar(el);
    chip(el, 'Civil').click();
    chip(el, 'Sucesiones').click();
    chip(el, 'Penal').click();
    chip(el, 'Penal').click();
    fixture.detectChanges();
    expect(chip(el, 'Civil').getAttribute('aria-pressed')).toBe('true');
    expect(chip(el, 'Penal').getAttribute('aria-pressed')).toBe('false');
    await enviar(fixture, el);
    expect(svc.crearEmpresa.mock.calls[0][0].especialidad).toBe('Civil, Sucesiones');
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
      const aviso = el.querySelector('[data-testid="aviso-verificacion"]');
      expect(aviso?.textContent).toContain('ana@despacho.es');
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
