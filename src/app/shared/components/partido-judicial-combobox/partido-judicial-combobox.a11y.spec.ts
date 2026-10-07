import { describe, it, expect } from 'vitest';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { PartidoJudicialComboboxComponent } from './partido-judicial-combobox';
import { CompanyService } from '../../../core/services/company.service';
import { analizarA11y, formatearViolaciones } from '../../../../testing/axe';

async function montar() {
  TestBed.resetTestingModule();
  await TestBed.configureTestingModule({
    imports: [PartidoJudicialComboboxComponent],
    providers: [{ provide: CompanyService, useValue: { activeCompany: signal({ id: 'c1', ca: 'madrid' }) } }],
  }).compileComponents();
  const f = TestBed.createComponent(PartidoJudicialComboboxComponent);
  f.componentRef.setInput('inputId', 'pj');
  f.detectChanges();
  // El label vive en el contenedor del padre: lo simulamos para que axe evalúe el control con nombre accesible.
  const contenedor = document.createElement('div');
  contenedor.innerHTML = '<label for="pj">Partido judicial</label>';
  contenedor.appendChild(f.nativeElement as HTMLElement);
  document.body.appendChild(contenedor);
  return { f, contenedor };
}

describe('PartidoJudicialComboboxComponent — accesibilidad (axe)', () => {
  it('sin violaciones cerrado, con lista abierta y sin resultados', async () => {
    const { f, contenedor } = await montar();
    let v = await analizarA11y(contenedor);
    expect(v, `\n${formatearViolaciones(v)}\n`).toEqual([]);

    const input = contenedor.querySelector<HTMLInputElement>('input')!;
    input.value = 'alcala';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    f.detectChanges();
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    f.detectChanges();
    v = await analizarA11y(contenedor);
    expect(v, `\n${formatearViolaciones(v)}\n`).toEqual([]);

    input.value = 'zzzzqq';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    f.detectChanges();
    v = await analizarA11y(contenedor);
    expect(v, `\n${formatearViolaciones(v)}\n`).toEqual([]);
    contenedor.remove();
  });
});
