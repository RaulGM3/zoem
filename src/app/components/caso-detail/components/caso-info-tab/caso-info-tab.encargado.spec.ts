import { describe, it, expect } from 'vitest';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { CasoInfoTabComponent, type CasoInfoFormData } from './caso-info-tab';
import type { Caso, CompanyMember, Contact } from '../../../../interfaces';
import { analizarA11y, formatearViolaciones } from '../../../../../testing/axe';

const CASO = {
  id: 'c1', titulo: 'Caso 1', tipo: 'Legal', estado: 'pendiente', prioridad: 'alta', encargadoId: 'u2',
} as unknown as Caso;

const member = (userId: string, nombre: string, estado: string, apellido?: string): CompanyMember =>
  ({ id: userId, userId, nombre, apellido, estado }) as unknown as CompanyMember;

const MEMBERS = [
  member('u1', 'Ana', 'activo', 'Lopez'),
  member('u2', 'Beto', 'activo'),
  member('u3', 'Carla', 'pendiente'),
  member('u4', 'Dani', 'suspendido'),
];

describe('CasoInfoTabComponent — encargado', () => {
  let fixture: ComponentFixture<CasoInfoTabComponent>;
  const el = (): HTMLElement => fixture.nativeElement;

  async function montar(editing: boolean, caso: Caso = CASO): Promise<void> {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ imports: [CasoInfoTabComponent] });
    fixture = TestBed.createComponent(CasoInfoTabComponent);
    const set = (k: string, v: unknown): void => fixture.componentRef.setInput(k, v);
    set('caso', caso);
    set('editing', editing);
    set('saving', false);
    set('linkedContacts', [] as Contact[]);
    set('searchResults', [] as Contact[]);
    set('contactSearch', '');
    set('members', MEMBERS);
    await fixture.whenStable();
  }

  it('vista: muestra el nombre del encargado', async () => {
    await montar(false);
    expect(el().textContent).toContain('Encargado');
    expect(el().textContent).toContain('Beto');
  });

  it('vista: muestra "Sin asignar" si no hay encargado o no se encuentra', async () => {
    await montar(false, { ...CASO, encargadoId: undefined });
    expect(el().textContent).toContain('Sin asignar');
    await montar(false, { ...CASO, encargadoId: 'zzz' });
    expect(el().textContent).toContain('Sin asignar');
  });

  it('edición: el select lista solo miembros activos + Sin asignar y preselecciona el actual', async () => {
    await montar(true);
    const sel = el().querySelector<HTMLSelectElement>('#caso-encargado')!;
    expect(el().querySelector('label[for="caso-encargado"]')?.textContent).toContain('Encargado');
    const labels = Array.from(sel.options).map(o => o.textContent!.trim());
    expect(labels).toEqual(['Sin asignar', 'Ana Lopez', 'Beto']);
    expect(sel.value).toBe('u2');
  });

  it('edición: guardar envía encargadoId elegido', async () => {
    await montar(true);
    let emitted: CasoInfoFormData | undefined;
    fixture.componentInstance.saveInfo.subscribe(d => (emitted = d));
    const sel = el().querySelector<HTMLSelectElement>('#caso-encargado')!;
    sel.value = 'u1';
    sel.dispatchEvent(new Event('change'));
    fixture.componentInstance.submit();
    expect(emitted?.encargadoId).toBe('u1');
  });

  it('edición: "Sin asignar" envía encargadoId undefined (clave presente)', async () => {
    await montar(true);
    let emitted: CasoInfoFormData | undefined;
    fixture.componentInstance.saveInfo.subscribe(d => (emitted = d));
    const sel = el().querySelector<HTMLSelectElement>('#caso-encargado')!;
    sel.value = '';
    sel.dispatchEvent(new Event('change'));
    fixture.componentInstance.submit();
    expect(emitted).toBeDefined();
    expect('encargadoId' in emitted!).toBe(true);
    expect(emitted!.encargadoId).toBeUndefined();
  });

  it('edición: un encargado actual no activo sigue seleccionado y guardar no lo borra', async () => {
    await montar(true, { ...CASO, encargadoId: 'u4' });
    const sel = el().querySelector<HTMLSelectElement>('#caso-encargado')!;
    const labels = Array.from(sel.options).map(o => o.textContent!.trim());
    expect(labels).toEqual(['Sin asignar', 'Ana Lopez', 'Beto', 'Dani (inactivo)']);
    expect(sel.value).toBe('u4');
    let emitted: CasoInfoFormData | undefined;
    fixture.componentInstance.saveInfo.subscribe(d => (emitted = d));
    fixture.componentInstance.submit();
    expect(emitted?.encargadoId).toBe('u4');
  });

  it('edición: un encargado actual que ya no es miembro no se borra al guardar', async () => {
    await montar(true, { ...CASO, encargadoId: 'zzz' });
    const sel = el().querySelector<HTMLSelectElement>('#caso-encargado')!;
    expect(sel.value).toBe('zzz');
    expect(sel.options[sel.selectedIndex].textContent!.trim()).toBe('Usuario no disponible');
    let emitted: CasoInfoFormData | undefined;
    fixture.componentInstance.saveInfo.subscribe(d => (emitted = d));
    fixture.componentInstance.submit();
    expect(emitted?.encargadoId).toBe('zzz');
  });

  it('edición: sin violaciones axe', async () => {
    await montar(true);
    const v = await analizarA11y(el());
    expect(v, `\n${formatearViolaciones(v)}\n`).toEqual([]);
  });
});
