import { describe, it, expect } from 'vitest';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { Timestamp } from '@angular/fire/firestore';
import { CasosTableComponent } from './casos-table';
import { analizarA11y, formatearViolaciones } from '../../../../../testing/axe';
import type { Caso } from '../../../../interfaces';

const AHORA = Timestamp.fromDate(new Date('2026-01-15T10:00:00Z'));

const CASO: Caso = {
  id: 'caso-1',
  companyId: 'c-1',
  titulo: 'Divorcio García Rodríguez',
  descripcion: 'Procedimiento contencioso',
  tipo: 'Legal',
  estado: 'en_proceso',
  prioridad: 'alta',
  contactoIds: ['ct-1'],
  hitos: [],
  resumenFinanciero: {
    totalIngresos: 2000,
    totalSuplidos: 0,
    totalHonorarios: 2000,
    totalHonorariosSalida: 0,
    totalEgresos: 749.5,
    saldo: 1250.5,
    ivaRepercutido: 0,
    ivaSoportado: 0,
  },
  hitosResumen: { total: 4, completados: 2 },
  vencimiento: '2026-02-01',
  createdAt: AHORA,
  updatedAt: AHORA,
};

async function montar(casos: Caso[]): Promise<ComponentFixture<CasosTableComponent>> {
  TestBed.resetTestingModule();
  await TestBed.configureTestingModule({ imports: [CasosTableComponent] }).compileComponents();
  const fixture = TestBed.createComponent(CasosTableComponent);
  fixture.componentRef.setInput('casos', casos);
  fixture.componentRef.setInput('loading', false);
  fixture.componentRef.setInput('subtitulos', { 'caso-1': 'Ana Ruiz, Luis Pérez' });
  fixture.componentRef.setInput('canDelete', true);
  fixture.detectChanges();
  await fixture.whenStable();
  return fixture;
}

describe('CasosTableComponent — accesibilidad (axe)', () => {
  it('no tiene violaciones de axe con casos cargados', async () => {
    const fixture = await montar([CASO]);
    const violaciones = await analizarA11y(fixture.nativeElement);
    expect(violaciones, `\n${formatearViolaciones(violaciones)}\n`).toEqual([]);
  });

  it('no tiene violaciones de axe en estado vacío', async () => {
    const fixture = await montar([]);
    const violaciones = await analizarA11y(fixture.nativeElement);
    expect(violaciones, `\n${formatearViolaciones(violaciones)}\n`).toEqual([]);
  });
});
