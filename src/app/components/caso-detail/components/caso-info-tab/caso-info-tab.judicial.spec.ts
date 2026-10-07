import { describe, it, expect } from 'vitest';
import { signal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { CasoInfoTabComponent, type CasoInfoFormData } from './caso-info-tab';
import { CompanyService } from '../../../../core/services/company.service';
import type { Caso, Contact } from '../../../../interfaces';
import { analizarA11y, formatearViolaciones } from '../../../../../testing/axe';

const CASO = {
  id: 'c1', titulo: 'Caso 1', tipo: 'Legal', estado: 'pendiente', prioridad: 'alta',
  jurisdiccion: 'contencioso', partidoJudicialId: '28-4', organoJudicial: 'Juzgado nº 3', numProcedimiento: 'PO 123/2026',
} as unknown as Caso;

describe('CasoInfoTabComponent — datos procesales', () => {
  let fixture: ComponentFixture<CasoInfoTabComponent>;
  const el = (): HTMLElement => fixture.nativeElement;

  async function montar(editing: boolean, caso: Caso = CASO): Promise<void> {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [CasoInfoTabComponent],
      providers: [{ provide: CompanyService, useValue: { activeCompany: signal({ id: 'c1', ca: 'madrid' }) } }],
    });
    fixture = TestBed.createComponent(CasoInfoTabComponent);
    const set = (k: string, v: unknown): void => fixture.componentRef.setInput(k, v);
    set('caso', caso);
    set('editing', editing);
    set('saving', false);
    set('linkedContacts', [] as Contact[]);
    set('searchResults', [] as Contact[]);
    set('contactSearch', '');
    await fixture.whenStable();
  }

  it('vista: muestra jurisdicción, partido, órgano y nº de procedimiento', async () => {
    await montar(false);
    const t = el().textContent!;
    expect(t).toContain('Contencioso-administrativo');
    expect(t).toContain('Alcalá de Henares (Madrid)');
    expect(t).toContain('Juzgado nº 3');
    expect(t).toContain('PO 123/2026');
  });

  it('vista: sin datos procesales muestra guiones', async () => {
    await montar(false, { ...CASO, jurisdiccion: undefined, partidoJudicialId: undefined, organoJudicial: undefined, numProcedimiento: undefined });
    expect(el().querySelector('[data-testid="dato-jurisdiccion"]')?.textContent?.trim()).toBe('—');
  });

  it('edición: campos etiquetados y precargados', async () => {
    await montar(true);
    expect(el().querySelector('label[for="caso-edit-jurisdiccion"]')?.textContent).toContain('Jurisdicción');
    const sel = el().querySelector<HTMLSelectElement>('#caso-edit-jurisdiccion')!;
    expect(Array.from(sel.options).map(o => o.textContent!.trim())).toEqual(['Sin definir', 'Civil', 'Penal', 'Contencioso-administrativo', 'Laboral']);
    expect(sel.value).toBe('contencioso');
    expect(el().querySelector('label[for="caso-edit-partido"]')?.textContent).toContain('Partido judicial');
    expect(el().querySelector<HTMLInputElement>('#caso-edit-partido')!.value).toBe('Alcalá de Henares (Madrid)');
    expect(el().querySelector<HTMLInputElement>('#caso-edit-organo')!.value).toBe('Juzgado nº 3');
    expect(el().querySelector<HTMLInputElement>('#caso-edit-procedimiento')!.value).toBe('PO 123/2026');
  });

  it('edición: guardar emite los datos procesales; vaciar los deja undefined', async () => {
    await montar(true);
    const emitidos: CasoInfoFormData[] = [];
    fixture.componentInstance.saveInfo.subscribe(d => emitidos.push(d));
    fixture.componentInstance.submit();
    expect(emitidos[0]).toMatchObject({ jurisdiccion: 'contencioso', partidoJudicialId: '28-4', organoJudicial: 'Juzgado nº 3', numProcedimiento: 'PO 123/2026' });

    const sel = el().querySelector<HTMLSelectElement>('#caso-edit-jurisdiccion')!;
    sel.value = '';
    sel.dispatchEvent(new Event('change', { bubbles: true }));
    const organo = el().querySelector<HTMLInputElement>('#caso-edit-organo')!;
    organo.value = '  ';
    organo.dispatchEvent(new Event('input', { bubbles: true }));
    fixture.componentInstance.editPartidoJudicialId.set('');
    fixture.componentInstance.submit();
    expect(emitidos[1].jurisdiccion).toBeUndefined();
    expect(emitidos[1].organoJudicial).toBeUndefined();
    expect(emitidos[1].partidoJudicialId).toBeUndefined();
    expect('jurisdiccion' in emitidos[1]).toBe(true);
  });

  it('sin violaciones de accesibilidad (vista y edición)', async () => {
    await montar(false);
    let v = await analizarA11y(el());
    expect(v, `\n${formatearViolaciones(v)}\n`).toEqual([]);
    await montar(true);
    v = await analizarA11y(el());
    expect(v, `\n${formatearViolaciones(v)}\n`).toEqual([]);
  });
});
