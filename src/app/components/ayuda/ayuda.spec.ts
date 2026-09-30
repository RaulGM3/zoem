import { describe, it, expect } from 'vitest';
import type { PuedeFn } from '../../core/ayuda/guia';
import { buscarEnAyuda as buscar, montarAyuda, type FixtureAyuda } from './ayuda.testing';

type Fixture = FixtureAyuda;

const el = (f: Fixture): HTMLElement => f.nativeElement;
const textos = (f: Fixture, selector: string) =>
  [...el(f).querySelectorAll(selector)].map((n) => n.textContent?.trim() ?? '');

describe('AyudaComponent — guías', () => {
  it('sin guía en la URL muestra la primera', async () => {
    const f = await montarAyuda();
    expect(el(f).querySelector('h1')?.textContent).toContain('Ayuda');
    expect(el(f).querySelector('article h2')?.textContent).toContain('Primeros pasos');
  });

  it('muestra la guía indicada en la URL con sus tareas y pasos numerados', async () => {
    const f = await montarAyuda({ guia: 'casos' });
    expect(el(f).querySelector('article h2')?.textContent).toContain('Casos');
    expect(textos(f, 'article h3')).toEqual(['Buscar un caso', 'Crear un caso nuevo']);
    expect(textos(f, 'article ol li')).toContain('Pulsa "Nuevo caso".');
    expect(el(f).querySelector('article')?.textContent).toContain('Hace falta un cliente.');
  });

  it('enlaza a la pantalla que documenta la guía', async () => {
    const f = await montarAyuda({ guia: 'casos' });
    const enlace = el(f).querySelector('article a[href="/casos"]');
    expect(enlace?.textContent).toContain('Ir a Casos');
  });

  it('marca la guía activa en la navegación', async () => {
    const f = await montarAyuda({ guia: 'casos' });
    const activo = el(f).querySelector('nav[aria-label="Guías"] [aria-current="page"]');
    expect(activo?.textContent).toContain('Casos');
  });
});

describe('AyudaComponent — permisos', () => {
  const sinTesoreria: PuedeFn = (modulo) => modulo !== 'Tesorería';

  it('la navegación solo lista las guías que el usuario puede ver', async () => {
    const f = await montarAyuda({ puede: sinTesoreria });
    expect(textos(f, 'nav[aria-label="Guías"] a')).toEqual(['Primeros pasos', 'Casos']);
  });

  it('oculta las tareas que el usuario no puede ejecutar', async () => {
    const f = await montarAyuda({ guia: 'casos', puede: (_m, cap) => cap === 'ver' });
    expect(textos(f, 'article h3')).toEqual(['Buscar un caso']);
  });

  it('un enlace directo a una guía sin permiso no revela su contenido', async () => {
    const f = await montarAyuda({ guia: 'tesoreria', puede: sinTesoreria });
    expect(el(f).textContent).toContain('No tienes acceso a esta guía');
    expect(el(f).textContent).not.toContain('Cierre de caja');
    expect(el(f).querySelector('article')).toBeNull();
  });

  it('una guía que no existe lo dice con claridad', async () => {
    const f = await montarAyuda({ guia: 'marketing' });
    expect(el(f).textContent).toContain('Esta guía no existe');
  });
});

describe('AyudaComponent — búsqueda', () => {
  it('el buscador tiene una etiqueta visible asociada', async () => {
    const f = await montarAyuda();
    const input = el(f).querySelector('input[type="search"]') as HTMLInputElement;
    const label = el(f).querySelector(`label[for="${input.id}"]`);
    expect(label?.textContent?.trim()).not.toBe('');
  });

  it('muestra solo las tareas que coinciden y anuncia el recuento', async () => {
    const f = await montarAyuda();
    await buscar(f, 'crear caso');
    expect(textos(f, '[data-resultado] h4')).toEqual(['Crear un caso nuevo']);
    expect(el(f).querySelector('[role="status"]')?.textContent).toContain('1 resultado');
  });

  it('ignora acentos', async () => {
    const f = await montarAyuda();
    await buscar(f, 'tesoreria');
    expect(textos(f, '[data-resultado] h3')).toEqual(['Tesorería']);
  });

  it('sin coincidencias lo anuncia y ofrece preguntar al agente', async () => {
    const f = await montarAyuda();
    await buscar(f, 'nóminas');
    expect(el(f).querySelector('[role="status"]')?.textContent).toContain('Sin resultados');
    expect(el(f).querySelector('a[href="/agente-ia"]')).not.toBeNull();
  });

  it('no busca en guías que el usuario no puede ver', async () => {
    const f = await montarAyuda({ puede: (modulo) => modulo !== 'Tesorería' });
    await buscar(f, 'cierre de caja');
    expect(el(f).querySelector('[role="status"]')?.textContent).toContain('Sin resultados');
  });

  it('al vaciar el buscador vuelve a la guía', async () => {
    const f = await montarAyuda({ guia: 'casos' });
    await buscar(f, 'cierre');
    await buscar(f, '');
    expect(el(f).querySelector('article h2')?.textContent).toContain('Casos');
  });
});

describe('AyudaComponent — foco', () => {
  it('al entrar no roba el foco', async () => {
    const f = await montarAyuda({ guia: 'casos' });
    expect(document.activeElement).not.toBe(el(f).querySelector('article h2'));
  });

  it('al cambiar de guía lleva el foco a su título', async () => {
    const f = await montarAyuda({ guia: 'general' });
    document.body.appendChild(el(f));

    f.componentRef.setInput('guia', 'casos');
    f.detectChanges();
    await f.whenStable();

    const titulo = el(f).querySelector('article h2');
    expect(titulo?.textContent).toContain('Casos');
    expect(document.activeElement).toBe(titulo);
    el(f).remove();
  });
});
