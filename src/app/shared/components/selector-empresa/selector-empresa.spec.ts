import { computed, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CompanyService, type Company, type CompanyMember } from '../../../core/services/company.service';
import { SelectorEmpresaComponent } from './selector-empresa';

const empresa = (id: string, name: string): Company => ({ id, name, slug: id, isActive: true });
const miembro = (c: Company): CompanyMember => ({ id: 'u', companyId: c.id, userId: 'u', role: 'Admin', company: c });

describe('SelectorEmpresaComponent', () => {
  const a = empresa('a', 'García');
  const b = empresa('b', 'Despacho Demo – García');
  const myMemberships = signal<CompanyMember[]>([]);
  const activeCompany = signal<Company | null>(a);
  const modo = signal(false);
  const cambiarEmpresa = vi.fn();

  beforeEach(() => {
    myMemberships.set([miembro(a), miembro(b)]);
    activeCompany.set(a);
    modo.set(false);
    cambiarEmpresa.mockReset();
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [SelectorEmpresaComponent],
      providers: [{
        provide: CompanyService,
        useValue: { myMemberships, activeCompany, modoSuperuser: computed(() => modo()), cambiarEmpresa },
      }],
    });
  });

  function render() {
    const f = TestBed.createComponent(SelectorEmpresaComponent);
    f.detectChanges();
    return f;
  }

  it('lista los despachos del usuario con el activo seleccionado y etiqueta accesible', () => {
    const el = render().nativeElement as HTMLElement;
    const select = el.querySelector('select') as HTMLSelectElement;
    expect(select.getAttribute('aria-label') ?? el.querySelector(`label[for="${select.id}"]`)?.textContent).toMatch(/despacho/i);
    expect(Array.from(select.options).map((o) => o.textContent?.trim())).toEqual(['García', 'Despacho Demo – García']);
    expect(select.value).toBe('a');
  });

  it('al elegir otro despacho cambia de empresa', () => {
    const f = render();
    const select = (f.nativeElement as HTMLElement).querySelector('select') as HTMLSelectElement;
    select.value = 'b';
    select.dispatchEvent(new Event('change'));
    expect(cambiarEmpresa).toHaveBeenCalledWith('b');
  });

  it('elegir el mismo despacho no recarga', () => {
    const f = render();
    const select = (f.nativeElement as HTMLElement).querySelector('select') as HTMLSelectElement;
    select.value = 'a';
    select.dispatchEvent(new Event('change'));
    expect(cambiarEmpresa).not.toHaveBeenCalled();
  });

  it('no aparece con un solo despacho', () => {
    myMemberships.set([miembro(a)]);
    expect((render().nativeElement as HTMLElement).querySelector('select')).toBeNull();
  });

  it('no aparece en modo superusuario', () => {
    modo.set(true);
    expect((render().nativeElement as HTMLElement).querySelector('select')).toBeNull();
  });
});
