import { describe, it, expect } from 'vitest';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { analizarA11y, formatearViolaciones } from '../../../../testing/axe';
import { CompanyService } from '../../../core/services/company.service';
import { MejoraPlanService } from '../../../core/planes/mejora-plan.service';
import { DemoTerminadaComponent } from './demo-terminada';

describe('DemoTerminadaComponent — accesibilidad (axe)', () => {
  it('no tiene violaciones', async () => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [DemoTerminadaComponent],
      providers: [
        {
          provide: CompanyService,
          useValue: {
            activeCompany: signal({ id: 'demo1' }),
            myMemberships: signal([{ companyId: 'demo1', company: { esDemo: true } }, { companyId: 'r1', company: { name: 'García' } }]),
            cambiarEmpresa: () => undefined,
          },
        },
        { provide: MejoraPlanService, useValue: { abrir: () => undefined } },
      ],
    });
    const fixture = TestBed.createComponent(DemoTerminadaComponent);
    fixture.detectChanges();
    const v = await analizarA11y(fixture.nativeElement);
    expect(v.length, formatearViolaciones(v)).toBe(0);
  });
});
