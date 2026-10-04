import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { signal } from '@angular/core';
import { ImportarContactosComponent } from './importar-contactos';
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

describe('ImportarContactosComponent — móvil', () => {
  let fixture: ComponentFixture<ImportarContactosComponent>;
  let cierres: number;
  const el = (): HTMLElement => fixture.nativeElement;

  async function montar(mobile: boolean, visible = true): Promise<void> {
    TestBed.resetTestingModule();
    mockViewport(mobile);
    cierres = 0;
    await TestBed.configureTestingModule({
      imports: [ImportarContactosComponent],
      providers: [
        { provide: ContactService, useValue: { createContact: vi.fn() } },
        { provide: UsersService, useValue: { members: signal([]) } },
        { provide: ToastService, useValue: { run: vi.fn() } },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(ImportarContactosComponent);
    fixture.componentRef.setInput('visible', visible);
    fixture.componentInstance.closed.subscribe(() => cierres++);
    fixture.detectChanges();
    await fixture.whenStable();
  }

  beforeEach(() => TestBed.resetTestingModule());

  it('cerrado: no pinta el diálogo', async () => {
    await montar(true, false);
    expect(el().querySelector('[role="dialog"]')).toBeNull();
  });

  it('móvil: diálogo a pantalla completa vía overlay-shell con título accesible', async () => {
    await montar(true);
    const dialog = el().querySelector('[role="dialog"]')!;
    expect(dialog.className).toContain('h-dvh');
    const titulo = el().querySelector(`#${dialog.getAttribute('aria-labelledby')}`)!;
    expect(titulo.textContent).toContain('Importar contactos desde Excel');
  });

  it('el botón Siguiente vive en el footer del shell', async () => {
    await montar(true);
    expect(el().querySelector('[data-overlay-footer]')!.textContent).toContain('Siguiente');
  });

  it('Cerrar y el fondo emiten closed', async () => {
    await montar(true);
    el().querySelector<HTMLButtonElement>('[aria-label="Cerrar"]')!.click();
    fixture.detectChanges();
    expect(cierres).toBe(1);
  });

  it('paso 2: cada fila de mapeo apila columna y campo en móvil', async () => {
    await montar(true);
    fixture.componentInstance.rawHeaders.set(['Nombre']);
    fixture.componentInstance.step.set(2);
    fixture.detectChanges();
    const select = el().querySelector('select')!;
    expect(select.className).toContain('w-full');
    expect(select.parentElement!.className).toContain('flex-col');
    expect(select.parentElement!.className).toContain('sm:flex-row');
  });
});
