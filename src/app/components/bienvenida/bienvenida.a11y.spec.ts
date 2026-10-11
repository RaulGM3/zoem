import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { describe, expect, it, vi } from 'vitest';
import { analizarA11y, formatearViolaciones } from '../../../testing/axe';
import { AuthService } from '../../auth/auth.service';
import { AutoservicioService } from '../../core/autoservicio/autoservicio.service';
import { PlacesService } from '../../core/ubicacion/places.service';
import { BienvenidaComponent } from './bienvenida';

describe('BienvenidaComponent — accesibilidad (axe)', () => {
  for (const verificada of [true, false]) {
    it(`sin violaciones (${verificada ? 'verificada' : 'con aviso de verificación'})`, async () => {
      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        imports: [BienvenidaComponent],
        providers: [
          { provide: AutoservicioService, useValue: { verificada: () => verificada, sugerirPais: () => Promise.resolve(null) } },
          { provide: PlacesService, useValue: { disponible: signal(true), buscar: vi.fn(), elegir: vi.fn() } },
          { provide: AuthService, useValue: { logout: vi.fn(), user: () => ({ email: 'ana@despacho.es' }) } },
        ],
      });
      const f = TestBed.createComponent(BienvenidaComponent);
      f.detectChanges();
      const v = await analizarA11y(f.nativeElement);
      expect(v.length, formatearViolaciones(v)).toBe(0);
    });
  }
});
