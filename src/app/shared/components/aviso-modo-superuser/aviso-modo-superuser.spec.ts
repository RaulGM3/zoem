import { computed, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CompanyService, type Company } from '../../../core/services/company.service';
import { AvisoModoSuperuserComponent } from './aviso-modo-superuser';

describe('AvisoModoSuperuserComponent', () => {
  const activeCompany = signal<Company | null>(null);
  const modo = signal(false);
  const salirModoSuperuser = vi.fn();

  beforeEach(() => {
    activeCompany.set({ id: 'c1', name: 'Acme', slug: 'acme', isActive: true });
    modo.set(true);
    salirModoSuperuser.mockReset();
    TestBed.configureTestingModule({
      imports: [AvisoModoSuperuserComponent],
      providers: [
        {
          provide: CompanyService,
          useValue: { activeCompany, modoSuperuser: computed(() => modo()), salirModoSuperuser },
        },
      ],
    });
  });

  function render(): HTMLElement {
    const fixture = TestBed.createComponent(AvisoModoSuperuserComponent);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('anuncia la empresa en la que está el superusuario', () => {
    const el = render();
    const aviso = el.querySelector('[role="status"]');
    expect(aviso?.textContent).toContain('Acme');
  });

  it('no muestra nada fuera del modo superusuario', () => {
    modo.set(false);
    expect(render().querySelector('[role="status"]')).toBeNull();
  });

  it('Salir vuelve al panel de superusuario', () => {
    const boton = render().querySelector('button') as HTMLButtonElement;
    expect(boton.textContent).toContain('Salir');
    boton.click();
    expect(salirModoSuperuser).toHaveBeenCalledOnce();
  });
});
