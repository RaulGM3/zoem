import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { signal } from '@angular/core';
import { ContactoDrawerComponent } from './contacto-drawer';
import { ContactService } from '../../../../core/services/contact.service';
import { UsersService } from '../../../../core/services/users';
import { ToastService } from '../../../../core/services/toast.service';

function mockViewport(mobile: boolean): void {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    writable: true,
    value: (q: string) => ({
      matches: mobile && /max-width/.test(q),
      media: q,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    }),
  });
}

describe('ContactoDrawerComponent — móvil', () => {
  let fixture: ComponentFixture<ContactoDrawerComponent>;
  const el = (): HTMLElement => fixture.nativeElement;

  async function montar(mobile: boolean): Promise<void> {
    TestBed.resetTestingModule();
    mockViewport(mobile);
    await TestBed.configureTestingModule({
      imports: [ContactoDrawerComponent],
      providers: [
        { provide: ContactService, useValue: { createContact: vi.fn(), updateContact: vi.fn() } },
        { provide: UsersService, useValue: { members: signal([]) } },
        { provide: ToastService, useValue: { run: vi.fn() } },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(ContactoDrawerComponent);
    fixture.detectChanges();
    await fixture.whenStable();
  }

  beforeEach(() => TestBed.resetTestingModule());

  it('usa overlay-shell: diálogo a pantalla completa en móvil', async () => {
    await montar(true);
    expect(el().querySelector('app-overlay-shell')).not.toBeNull();
    expect(el().querySelector('[role="dialog"]')!.className).toContain('h-dvh');
  });

  it('los botones de acción están en el footer sticky del shell', async () => {
    await montar(true);
    const footer = el().querySelector('[data-overlay-footer]')!;
    expect(footer.textContent).toContain('Cancelar');
    expect(footer.textContent).toContain('Continuar');
  });

  it('las rejillas de dos columnas colapsan a una en móvil', async () => {
    await montar(true);
    const dosCols = Array.from(el().querySelectorAll('form .grid')).filter((g) => g.className.includes('sm:grid-cols-2'));
    expect(dosCols.length).toBeGreaterThan(0);
    for (const g of dosCols) expect(g.className).toContain('grid-cols-1');
    expect(el().querySelector('form .grid.grid-cols-2')).toBeNull();
  });
});
