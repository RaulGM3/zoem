import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { signal } from '@angular/core';
import { CompanyLogoUploaderComponent } from './company-logo-uploader';
import { CompanyLogoService } from '../../../core/services/company-logo.service';
import { CompanyService } from '../../../core/services/company.service';
import { ToastService } from '../../../core/services/toast.service';
import { analizarA11y, formatearViolaciones } from '../../../../testing/axe';

const LOGO = { path: 'companies/co/branding/logo', url: 'https://example.com/logo.png', contentType: 'image/png', updatedAt: '2026-01-01T00:00:00.000Z' };

describe('CompanyLogoUploaderComponent', () => {
  const company = signal<Record<string, unknown> | null>({ id: 'co', name: 'Acme SL' });
  const logoSvc = { subir: vi.fn(), quitar: vi.fn(async () => {}) };
  const toast = { run: vi.fn(async (fn: () => Promise<unknown>) => fn()), success: vi.fn() };
  let f: ComponentFixture<CompanyLogoUploaderComponent>;
  const el = () => f.nativeElement as HTMLElement;
  const boton = (t: string) => Array.from(el().querySelectorAll('button')).find((b) => b.textContent?.replace(/\s+/g, ' ').trim() === t);

  async function montar(): Promise<void> {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [CompanyLogoUploaderComponent],
      providers: [
        { provide: CompanyLogoService, useValue: logoSvc },
        { provide: CompanyService, useValue: { activeCompany: company } },
        { provide: ToastService, useValue: toast },
      ],
    });
    f = TestBed.createComponent(CompanyLogoUploaderComponent);
    await f.whenStable();
  }

  function elegir(file: File): Promise<void> {
    const input = el().querySelector<HTMLInputElement>('input[type="file"]')!;
    Object.defineProperty(input, 'files', { configurable: true, value: [file] });
    input.dispatchEvent(new Event('change'));
    return f.whenStable();
  }

  beforeEach(() => {
    vi.clearAllMocks();
    company.set({ id: 'co', name: 'Acme SL' });
  });

  it('sin logo: muestra placeholder y el botón Subir logo; input acepta png y jpeg', async () => {
    await montar();
    expect(el().querySelector('img')).toBeNull();
    expect(boton('Subir logo')).toBeDefined();
    expect(el().querySelector('input[type="file"]')!.getAttribute('accept')).toBe('image/png,image/jpeg');
  });

  it('con logo: preview con alt, Reemplazar y Quitar', async () => {
    company.set({ id: 'co', name: 'Acme SL', logo: LOGO });
    await montar();
    expect(el().querySelector('img')!.getAttribute('alt')).toBe('Logo de Acme SL');
    expect(boton('Reemplazar')).toBeDefined();
    expect(boton('Quitar')).toBeDefined();
  });

  it('archivo inválido: muestra el error y no notifica éxito', async () => {
    logoSvc.subir.mockResolvedValue({ ok: false, error: 'Formato no admitido (PNG o JPG)' });
    await montar();
    await elegir(new File(['x'], 'logo.svg', { type: 'image/svg+xml' }));
    f.detectChanges();
    expect(el().querySelector('[role="alert"]')!.textContent).toContain('Formato no admitido');
    expect(toast.success).not.toHaveBeenCalled();
  });

  it('subida correcta: toast de éxito, sin error', async () => {
    logoSvc.subir.mockResolvedValue({ ok: true, logo: LOGO });
    await montar();
    await elegir(new File(['x'], 'logo.png', { type: 'image/png' }));
    f.detectChanges();
    expect(logoSvc.subir).toHaveBeenCalledTimes(1);
    expect(toast.success).toHaveBeenCalledWith('Logo actualizado');
    expect(el().querySelector('[role="alert"]')).toBeNull();
  });

  it('subiendo: región aria-live polite con el estado y botones deshabilitados', async () => {
    let liberar!: (v: unknown) => void;
    logoSvc.subir.mockReturnValue(new Promise((r) => { liberar = r; }));
    company.set({ id: 'co', name: 'Acme SL', logo: LOGO });
    await montar();
    const p = elegir(new File(['x'], 'logo.png', { type: 'image/png' }));
    f.detectChanges();
    const live = el().querySelector('[aria-live="polite"]')!;
    expect(live.textContent).toContain('Subiendo');
    expect(boton('Reemplazar')!.disabled).toBe(true);
    liberar({ ok: true, logo: LOGO });
    await p;
    f.detectChanges();
    expect(live.textContent).not.toContain('Subiendo');
  });

  it('quitar pide confirmación y solo entonces llama al servicio', async () => {
    company.set({ id: 'co', name: 'Acme SL', logo: LOGO });
    await montar();
    boton('Quitar')!.click();
    f.detectChanges();
    expect(logoSvc.quitar).not.toHaveBeenCalled();
    boton('Confirmar')!.click();
    await f.whenStable();
    expect(logoSvc.quitar).toHaveBeenCalledTimes(1);
  });

  it('cancelar la confirmación no quita el logo', async () => {
    company.set({ id: 'co', name: 'Acme SL', logo: LOGO });
    await montar();
    boton('Quitar')!.click();
    f.detectChanges();
    boton('Cancelar')!.click();
    f.detectChanges();
    expect(logoSvc.quitar).not.toHaveBeenCalled();
    expect(boton('Quitar')).toBeDefined();
  });

  it('pasa AXE (con logo y con error)', async () => {
    logoSvc.subir.mockResolvedValue({ ok: false, error: 'Máximo 1 MB' });
    company.set({ id: 'co', name: 'Acme SL', logo: LOGO });
    await montar();
    await elegir(new File(['x'], 'logo.png', { type: 'image/png' }));
    f.detectChanges();
    const v = await analizarA11y(el());
    expect(v, formatearViolaciones(v)).toEqual([]);
  });
});
