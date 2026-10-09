import { describe, it, expect } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { analizarA11y, formatearViolaciones } from '../../../../testing/axe';
import { CupoComponent } from './cupo';

describe('CupoComponent — accesibilidad (axe)', () => {
  for (const [usado, nombre] of [[3, 'ok'], [4, 'aviso'], [5, 'agotado']] as const) {
    it(`sin violaciones en estado ${nombre}`, async () => {
      TestBed.resetTestingModule();
      TestBed.configureTestingModule({ imports: [CupoComponent] });
      const f = TestBed.createComponent(CupoComponent);
      f.componentRef.setInput('etiqueta', 'plantillas');
      f.componentRef.setInput('usado', usado);
      f.componentRef.setInput('limite', 5);
      f.detectChanges();
      const v = await analizarA11y(f.nativeElement);
      expect(v.length, formatearViolaciones(v)).toBe(0);
    });
  }
});
