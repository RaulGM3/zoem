import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { describe, expect, it, vi } from 'vitest';
import { analizarA11y, formatearViolaciones } from '../../../testing/axe';
import { AuthService } from '../auth.service';
import { LoginComponent } from './login';

describe('LoginComponent — accesibilidad (axe)', () => {
  for (const modo of ['login', 'registro', 'reset'] as const) {
    it(`sin violaciones (${modo})`, async () => {
      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        imports: [LoginComponent],
        providers: [
          { provide: AuthService, useValue: { isAuthenticated: signal(false) } },
          { provide: Router, useValue: { navigate: vi.fn() } },
        ],
      });
      const f = TestBed.createComponent(LoginComponent);
      f.componentInstance.mode.set(modo);
      f.detectChanges();
      const v = await analizarA11y(f.nativeElement);
      expect(v.length, formatearViolaciones(v)).toBe(0);
    });
  }
});
