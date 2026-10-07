import { describe, it, expect, beforeEach, vi } from 'vitest';
import { signal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { NuevoCasoDrawerComponent } from './nuevo-caso-drawer';
import { ContactService } from '../../../../core/services/contact.service';
import { UsersService } from '../../../../core/services/users';
import { CompanyService } from '../../../../core/services/company.service';
import type { Contact } from '../../../../interfaces';
import { analizarA11y, formatearViolaciones } from '../../../../../testing/axe';

function mockViewport(mobile: boolean): void {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    writable: true,
    value: (q: string) => ({
      matches: mobile && /max-width/.test(q),
      media: q,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    }),
  });
}

const CONTACTO = {
  id: 'ct-1',
  type: 'persona_fisica',
  nombre: 'Ana',
  apellidos: 'Ruiz',
  email: 'ana@x.es',
} as unknown as Contact;

describe('NuevoCasoDrawerComponent', () => {
  let fixture: ComponentFixture<NuevoCasoDrawerComponent>;
  const el = (): HTMLElement => fixture.nativeElement;

  async function montar(mobile: boolean, visible = true): Promise<void> {
    TestBed.resetTestingModule();
    mockViewport(mobile);
    await TestBed.configureTestingModule({
      imports: [NuevoCasoDrawerComponent],
      providers: [
        { provide: ContactService, useValue: { contacts: signal([CONTACTO]), loadContacts: vi.fn() } },
        { provide: UsersService, useValue: { members: signal([]), loadMembers: vi.fn() } },
        { provide: CompanyService, useValue: { activeCompany: signal(null) } },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(NuevoCasoDrawerComponent);
    fixture.componentRef.setInput('visible', visible);
    fixture.componentRef.setInput('plantillas', []);
    fixture.componentRef.setInput('saving', false);
    fixture.detectChanges();
    await fixture.whenStable();
  }

  beforeEach(() => TestBed.resetTestingModule());

  it('se renderiza dentro de overlay-shell como diálogo accesible', async () => {
    await montar(true);
    expect(el().querySelector('app-overlay-shell')).not.toBeNull();
    const dialog = el().querySelector('[role="dialog"]')!;
    expect(dialog.getAttribute('aria-labelledby')).toBeTruthy();
    expect(dialog.textContent).toContain('Nuevo caso');
  });

  it('no renderiza nada si no es visible', async () => {
    await montar(true, false);
    expect(el().querySelector('[role="dialog"]')).toBeNull();
  });

  it('prioridad/estado: una columna en móvil, dos desde sm', async () => {
    await montar(true);
    const grid = el().querySelector('#form-prioridad')!.closest('.grid')!;
    expect(grid.className).toContain('grid-cols-1');
    expect(grid.className).toContain('sm:grid-cols-2');
    expect(grid.className).not.toMatch(/(^|\s)grid-cols-2/);
  });

  it('no usa handlers inline de hover', async () => {
    await montar(false);
    expect(el().innerHTML).not.toContain('mouseenter');
  });

  it('cerrar emite closed', async () => {
    await montar(true);
    let cerrado = 0;
    fixture.componentInstance.closed.subscribe(() => cerrado++);
    el().querySelector<HTMLButtonElement>('button[aria-label="Cerrar"]')!.click();
    expect(cerrado).toBe(1);
  });

  it('crear sin datos no emite y muestra errores', async () => {
    await montar(true);
    let emitido = 0;
    fixture.componentInstance.saved.subscribe(() => emitido++);
    fixture.componentInstance.submit();
    fixture.detectChanges();
    expect(emitido).toBe(0);
    expect(el().textContent).toContain('Selecciona un cliente');
  });

  it('crear con título y cliente emite saved con los datos', async () => {
    await montar(true);
    const c = fixture.componentInstance;
    const datos: unknown[] = [];
    c.saved.subscribe((d) => datos.push(d));
    c.selectCliente(CONTACTO);
    c.formTitulo.set('Caso nuevo');
    c.submit();
    expect(datos).toHaveLength(1);
    expect(datos[0]).toMatchObject({ titulo: 'Caso nuevo', contactoIds: ['ct-1'], tipo: 'Legal' });
  });

  it('el botón Crear caso vive en el pie y dispara submit', async () => {
    await montar(true);
    const c = fixture.componentInstance;
    c.selectCliente(CONTACTO);
    c.formTitulo.set('Desde botón');
    fixture.detectChanges();
    let emitido = 0;
    c.saved.subscribe(() => emitido++);
    const btn = el().querySelector<HTMLButtonElement>('[data-overlay-footer] button:last-child')!;
    expect(btn.textContent).toContain('Crear caso');
    btn.click();
    expect(emitido).toBe(1);
  });

  describe('datos judiciales (opcional)', () => {
    const toggle = (): HTMLButtonElement => el().querySelector<HTMLButtonElement>('[data-judicial-toggle]')!;

    it('el grupo nace colapsado y se expande con aria-expanded', async () => {
      await montar(true);
      expect(toggle().getAttribute('aria-expanded')).toBe('false');
      expect(el().querySelector('#form-jurisdiccion')).toBeNull();
      toggle().click();
      fixture.detectChanges();
      expect(toggle().getAttribute('aria-expanded')).toBe('true');
      expect(toggle().textContent).toContain('Datos judiciales (opcional)');
      expect(el().querySelector('#form-jurisdiccion')).not.toBeNull();
      expect(el().querySelector('app-partido-judicial-combobox')).not.toBeNull();
      expect(el().querySelector('#form-organo')).not.toBeNull();
      expect(el().querySelector('#form-procedimiento')).not.toBeNull();
    });

    it('sin rellenar, el caso se crea sin campos judiciales', async () => {
      await montar(true);
      const c = fixture.componentInstance;
      const datos: Record<string, unknown>[] = [];
      c.saved.subscribe((d) => datos.push({ ...d }));
      c.selectCliente(CONTACTO);
      c.formTitulo.set('Caso');
      c.submit();
      for (const k of ['jurisdiccion', 'partidoJudicialId', 'organoJudicial', 'numProcedimiento']) {
        expect(datos[0][k]).toBeUndefined();
      }
    });

    it('emite los datos judiciales informados (recortados)', async () => {
      await montar(true);
      const c = fixture.componentInstance;
      const datos: unknown[] = [];
      c.saved.subscribe((d) => datos.push(d));
      c.selectCliente(CONTACTO);
      c.formTitulo.set('Caso');
      c.formJurisdiccion.set('contencioso');
      c.formPartidoJudicialId.set('28-21');
      c.formOrganoJudicial.set('  Juzgado nº 3 ');
      c.formNumProcedimiento.set(' PO 45/2026 ');
      c.submit();
      expect(datos[0]).toMatchObject({
        jurisdiccion: 'contencioso', partidoJudicialId: '28-21',
        organoJudicial: 'Juzgado nº 3', numProcedimiento: 'PO 45/2026',
      });
    });

    it('al reabrir el drawer se limpian los datos judiciales', async () => {
      await montar(true);
      const c = fixture.componentInstance;
      c.formJurisdiccion.set('civil');
      fixture.componentRef.setInput('visible', false);
      fixture.detectChanges();
      fixture.componentRef.setInput('visible', true);
      fixture.detectChanges();
      expect(c.formJurisdiccion()).toBe('');
    });

    it('axe: sin violaciones con el grupo expandido', async () => {
      await montar(true);
      toggle().click();
      fixture.detectChanges();
      const v = await analizarA11y(el());
      expect(v, `\n${formatearViolaciones(v)}\n`).toEqual([]);
    });
  });

  it('axe: sin violaciones en móvil', async () => {
    await montar(true);
    const v = await analizarA11y(el());
    expect(v, `\n${formatearViolaciones(v)}\n`).toEqual([]);
  });
});
