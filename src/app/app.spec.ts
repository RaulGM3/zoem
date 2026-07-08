import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { App } from './app';
import { ErrorService } from './core/services/error.service';

describe('App', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
      // El árbol de App arrastra ToastService → ErrorService → Firestore/Auth:
      // se mockea ErrorService entero para no depender de Firebase en el test.
      providers: [{ provide: ErrorService, useValue: { log: vi.fn() } }],
    }).compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });
});
