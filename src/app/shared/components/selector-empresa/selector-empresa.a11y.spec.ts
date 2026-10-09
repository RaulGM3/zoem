import { computed, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { analizarA11y, formatearViolaciones } from '../../../../testing/axe';
import { CompanyService } from '../../../core/services/company.service';
import { SelectorEmpresaComponent } from './selector-empresa';

describe('SelectorEmpresaComponent — accesibilidad (axe)', () => {
  it('sin violaciones', async () => {
    const a = { id: 'a', name: 'García', slug: 'a', isActive: true };
    const b = { id: 'b', name: 'Demo', slug: 'b', isActive: true };
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [SelectorEmpresaComponent],
      providers: [{
        provide: CompanyService,
        useValue: {
          myMemberships: signal([a, b].map((c) => ({ id: 'u', companyId: c.id, userId: 'u', role: 'Admin', company: c }))),
          activeCompany: signal(a),
          modoSuperuser: computed(() => false),
          cambiarEmpresa: () => undefined,
        },
      }],
    });
    const f = TestBed.createComponent(SelectorEmpresaComponent);
    f.detectChanges();
    const v = await analizarA11y(f.nativeElement);
    expect(v.length, formatearViolaciones(v)).toBe(0);
  });
});
