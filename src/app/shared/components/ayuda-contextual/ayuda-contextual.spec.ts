import { describe, it, expect, vi } from 'vitest';
import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { CARGADOR_GUIAS } from '../../../core/ayuda/cargador-guias.token';
import type { Guia, PuedeFn } from '../../../core/ayuda/guia';
import { PermissionService } from '../../../core/services/permission.service';
import { AyudaContextualComponent } from './ayuda-contextual';

@Component({ template: '' })
class Vacia {}

const guia = (id: string, ruta: string, modulo: Guia['modulo'] = null): Guia => ({
  id: id as Guia['id'],
  titulo: `Guía ${id}`,
  modulo,
  ruta,
  resumen: `Resumen ${id}`,
  paraQue: 'x',
  aSaber: ['y'],
  claves: [],
  tareas: [],
});

const GUIAS = [guia('general', '/'), guia('dashboard', '/'), guia('casos', '/casos', 'Casos')];

async function montar(url: string, opts: { puede?: PuedeFn; cargar?: () => Promise<readonly Guia[]> } = {}) {
  TestBed.configureTestingModule({
    imports: [AyudaContextualComponent],
    providers: [
      provideRouter([{ path: '**', component: Vacia }]),
      { provide: CARGADOR_GUIAS, useValue: opts.cargar ?? (async () => GUIAS) },
      { provide: PermissionService, useValue: { can: opts.puede ?? (() => true) } },
    ],
  });
  const f = TestBed.createComponent(AyudaContextualComponent);
  await TestBed.inject(Router).navigateByUrl(url);
  f.detectChanges();
  await f.whenStable();
  f.detectChanges();
  return f;
}

const boton = (f: { nativeElement: HTMLElement }) =>
  f.nativeElement.querySelector<HTMLButtonElement>('button[aria-label="Ayuda de esta pantalla"]');

async function abrir(f: Awaited<ReturnType<typeof montar>>) {
  boton(f)?.click();
  f.detectChanges();
  await f.whenStable();
  f.detectChanges();
}

describe('AyudaContextualComponent', () => {
  it('pinta un botón accesible que anuncia que abre un diálogo', async () => {
    const f = await montar('/casos');
    expect(boton(f)?.getAttribute('aria-haspopup')).toBe('dialog');
    expect(f.nativeElement.querySelector('[role="dialog"]')).toBeNull();
  });

  it('abre el modal con la guía de la pantalla actual', async () => {
    const f = await montar('/casos/123');
    await abrir(f);
    expect(f.nativeElement.querySelector('[role="dialog"]')?.textContent).toContain('Guía casos');
  });

  it('sigue a la navegación: la siguiente apertura muestra la pantalla nueva', async () => {
    const f = await montar('/casos');
    await TestBed.inject(Router).navigateByUrl('/');
    await abrir(f);
    expect(f.nativeElement.querySelector('[role="dialog"]')?.textContent).toContain('Guía dashboard');
  });

  it('sin permiso sobre el módulo de la pantalla muestra la guía general', async () => {
    const f = await montar('/casos', { puede: (m) => m !== 'Casos' });
    await abrir(f);
    expect(f.nativeElement.querySelector('[role="dialog"]')?.textContent).toContain('Guía general');
  });

  it('carga las guías solo al abrir el modal por primera vez', async () => {
    const cargar = vi.fn(async () => GUIAS);
    const f = await montar('/casos', { cargar });
    expect(cargar).not.toHaveBeenCalled();
    await abrir(f);
    (f.nativeElement as HTMLElement).querySelector<HTMLButtonElement>('[role="dialog"] button[aria-label="Cerrar"]')?.click();
    f.detectChanges();
    await abrir(f);
    expect(cargar).toHaveBeenCalledTimes(1);
  });

  it('no aparece en la propia página de ayuda', async () => {
    const f = await montar('/ayuda/casos');
    expect(boton(f)).toBeNull();
  });
});
