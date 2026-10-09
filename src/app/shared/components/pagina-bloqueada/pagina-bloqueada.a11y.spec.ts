import { describe, it, expect } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { analizarA11y, formatearViolaciones } from '../../../../testing/axe';
import { PaginaBloqueadaComponent } from './pagina-bloqueada';

describe('PaginaBloqueadaComponent — accesibilidad (axe)', () => {
  it('no tiene violaciones', async () => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ imports: [PaginaBloqueadaComponent] });
    const fixture = TestBed.createComponent(PaginaBloqueadaComponent);
    fixture.componentRef.setInput('titulo', 'Tesorería');
    fixture.componentRef.setInput('descripcion', 'Controla tus cobros.');
    fixture.componentRef.setInput('beneficios', ['Cierre de caja', 'Gastos']);
    fixture.detectChanges();
    const v = await analizarA11y(fixture.nativeElement);
    expect(v.length, formatearViolaciones(v)).toBe(0);
  });
});
