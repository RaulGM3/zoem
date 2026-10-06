import { describe, it, expect, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { ChangeDetectionStrategy, Component } from '@angular/core';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { ConfiguracionComponent } from './configuracion';
import { SECCIONES_CONFIG } from '../../core/configuracion/secciones';
import { analizarA11y, formatearViolaciones } from '../../../testing/axe';

@Component({ template: '', changeDetection: ChangeDetectionStrategy.OnPush })
class IndexStub {}

@Component({
  template: '<h2 id="config-detalle-titulo" tabindex="-1">Detalle</h2><p>contenido</p>',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class SeccionStub {}

describe('ConfiguracionComponent (shell)', () => {
  let harness: RouterTestingHarness;
  const el = () => harness.routeNativeElement as HTMLElement;
  const nav = () => el().querySelector('nav')!;
  const detalle = () => el().querySelector<HTMLElement>('[data-config-detalle]')!;

  beforeEach(async () => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideRouter([
          {
            path: 'configuracion',
            component: ConfiguracionComponent,
            children: [
              { path: '', component: IndexStub },
              { path: 'empresa', component: SeccionStub },
              { path: 'usuarios', component: SeccionStub },
              { path: 'facturacion', component: SeccionStub },
              { path: 'tesoreria', component: SeccionStub },
            ],
          },
        ]),
      ],
    });
    harness = await RouterTestingHarness.create();
  });

  it('un único h1 "Configuración" que etiqueta la navegación', async () => {
    await harness.navigateByUrl('/configuracion');
    const h1s = el().querySelectorAll('h1');
    expect(h1s).toHaveLength(1);
    expect(h1s[0].textContent).toContain('Configuración');
    expect(nav().getAttribute('aria-labelledby')).toBe(h1s[0].id);
  });

  it('lista las cuatro secciones en orden con su descripción', async () => {
    await harness.navigateByUrl('/configuracion');
    const links = Array.from(nav().querySelectorAll('a'));
    expect(links.map((a) => a.getAttribute('href'))).toEqual(SECCIONES_CONFIG.map((s) => s.ruta));
    SECCIONES_CONFIG.forEach((s, i) => {
      expect(links[i].textContent).toContain(s.label);
      expect(links[i].textContent).toContain(s.descripcion);
    });
  });

  it('marca aria-current="page" solo en la sección activa', async () => {
    await harness.navigateByUrl('/configuracion/usuarios');
    const actuales = Array.from(nav().querySelectorAll('a[aria-current="page"]'));
    expect(actuales).toHaveLength(1);
    expect(actuales[0].getAttribute('href')).toBe('/configuracion/usuarios');
  });

  it('sin sección (móvil): lista visible y detalle oculto, sin enlace Volver', async () => {
    await harness.navigateByUrl('/configuracion');
    expect(nav().className).toContain('block');
    expect(nav().className).not.toContain('hidden');
    expect(detalle().className).toContain('hidden');
    expect(detalle().className).toContain('lg:block');
    expect(el().querySelector('[data-config-volver]')).toBeNull();
  });

  it('con sección: lista oculta en móvil (visible en lg), detalle visible y enlace Volver', async () => {
    await harness.navigateByUrl('/configuracion/empresa');
    expect(nav().className).toContain('hidden');
    expect(nav().className).toContain('lg:block');
    expect(detalle().className).not.toContain('hidden');
    const volver = el().querySelector<HTMLAnchorElement>('[data-config-volver]')!;
    expect(volver.getAttribute('href')).toBe('/configuracion');
    expect(volver.className).toContain('lg:hidden');
    expect(volver.textContent).toContain('Volver a Configuración');
  });

  it('al navegar a una sección mueve el foco al h2 del detalle', async () => {
    await harness.navigateByUrl('/configuracion');
    await harness.navigateByUrl('/configuracion/facturacion');
    harness.fixture.detectChanges();
    await harness.fixture.whenStable();
    expect(document.activeElement?.id).toBe('config-detalle-titulo');
  });

  it('al volver a la lista mueve el foco al h1', async () => {
    await harness.navigateByUrl('/configuracion/empresa');
    await harness.navigateByUrl('/configuracion');
    harness.fixture.detectChanges();
    await harness.fixture.whenStable();
    expect(document.activeElement?.tagName).toBe('H1');
  });

  it('pasa AXE en lista y detalle', async () => {
    await harness.navigateByUrl('/configuracion/empresa');
    let v = await analizarA11y(el());
    expect(v, formatearViolaciones(v)).toEqual([]);
    await harness.navigateByUrl('/configuracion');
    v = await analizarA11y(el());
    expect(v, formatearViolaciones(v)).toEqual([]);
  });
});
