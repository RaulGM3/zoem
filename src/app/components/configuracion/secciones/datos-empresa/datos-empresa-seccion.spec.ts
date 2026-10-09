import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { signal } from '@angular/core';
import { DatosEmpresaSeccionComponent } from './datos-empresa-seccion';
import { CompanyService } from '../../../../core/services/company.service';
import { CompanyLogoService } from '../../../../core/services/company-logo.service';
import { ToastService } from '../../../../core/services/toast.service';
import { analizarA11y, formatearViolaciones } from '../../../../../testing/axe';

describe('DatosEmpresaSeccionComponent', () => {
  const company = signal<Record<string, unknown> | null>(null);
  const updateCompany = vi.fn(async () => {});
  const toast = { run: vi.fn(async (fn: () => Promise<unknown>, o?: { onSuccess?: () => void }) => { await fn(); o?.onSuccess?.(); return true as boolean | undefined; }), success: vi.fn() };
  let f: ComponentFixture<DatosEmpresaSeccionComponent>;
  const el = () => f.nativeElement as HTMLElement;
  const q = <T extends HTMLElement>(s: string) => el().querySelector<T>(s)!;

  async function montar(): Promise<void> {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [DatosEmpresaSeccionComponent],
      providers: [
        { provide: CompanyService, useValue: { activeCompany: company, updateCompany } },
        { provide: CompanyLogoService, useValue: { subir: vi.fn(), quitar: vi.fn() } },
        { provide: ToastService, useValue: toast },
      ],
    });
    f = TestBed.createComponent(DatosEmpresaSeccionComponent);
    await f.whenStable();
  }

  function escribir(id: string, valor: string): void {
    const i = q<HTMLInputElement>(`#${id}`);
    i.value = valor;
    i.dispatchEvent(new Event('input'));
    i.dispatchEvent(new Event('blur'));
    f.detectChanges();
  }

  const guardar = () => Array.from(el().querySelectorAll('button')).find((b) => b.textContent?.trim() === 'Guardar cambios')!;

  beforeEach(() => {
    vi.clearAllMocks();
    company.set({
      id: 'co', name: 'Acme SL', tipoPersona: 'juridica', cif: 'B12345674', email: 'a@acme.es',
      telefono: '600', direccion: 'Calle 1', codigoPostal: '28001', ciudad: 'Madrid', website: 'https://acme.es',
    });
  });

  it('muestra h2#config-detalle-titulo enfocable', async () => {
    await montar();
    const h = q('h2#config-detalle-titulo');
    expect(h.textContent).toContain('Datos de la empresa');
    expect(h.getAttribute('tabindex')).toBe('-1');
    expect(el().querySelector('h1')).toBeNull();
  });

  it('precarga el formulario desde la empresa activa', async () => {
    await montar();
    expect(q<HTMLInputElement>('#empresa-name').value).toBe('Acme SL');
    expect(q<HTMLInputElement>('#empresa-cif').value).toBe('B12345674');
    expect(q<HTMLInputElement>('#empresa-cp').value).toBe('28001');
    expect(q<HTMLInputElement>('#empresa-web').value).toBe('https://acme.es');
  });

  it('zona horaria: precarga la de la empresa (Europe/Madrid si es legada) y se guarda al cambiarla', async () => {
    await montar();
    expect(q<HTMLSelectElement>('#empresa-zona').value).toBe('Europe/Madrid');
    const sel = q<HTMLSelectElement>('#empresa-zona');
    sel.value = 'America/Santiago';
    sel.dispatchEvent(new Event('change'));
    f.detectChanges();
    await f.componentInstance.guardar();
    expect(updateCompany).toHaveBeenCalledWith('co', expect.objectContaining({ zonaHoraria: 'America/Santiago' }));
  });

  it('zona horaria guardada fuera de la lista común sigue apareciendo como opción', async () => {
    company.set({ ...(company() as object), zonaHoraria: 'America/Cancun' });
    await montar();
    f.detectChanges();
    expect(q<HTMLSelectElement>('#empresa-zona').value).toBe('America/Cancun');
  });

  it('etiquetas de nombre e identificación según tipo de persona', async () => {
    await montar();
    expect(q('label[for="empresa-name"]').textContent).toContain('Razón social');
    expect(q('label[for="empresa-cif"]').textContent).toContain('CIF');
    company.set({ id: 'co', name: 'Ana Pérez', tipoPersona: 'fisica' });
    f.detectChanges();
    await f.whenStable();
    f.detectChanges();
    expect(q('label[for="empresa-name"]').textContent).toContain('Nombre y apellidos');
    expect(q('label[for="empresa-cif"]').textContent).toContain('NIF');
  });

  it('nombre vacío: Guardar deshabilitado y error enlazado con aria-describedby', async () => {
    await montar();
    escribir('empresa-name', '');
    expect(guardar().disabled).toBe(true);
    const input = q('#empresa-name');
    expect(input.getAttribute('aria-invalid')).toBe('true');
    const id = input.getAttribute('aria-describedby')!;
    expect(id).toBeTruthy();
    expect(document.getElementById(id) ?? el().querySelector(`#${id}`)).not.toBeNull();
    expect(el().querySelector(`#${id}`)!.textContent).toContain('obligatorio');
  });

  it('código postal inválido bloquea el guardado', async () => {
    await montar();
    escribir('empresa-cp', '123');
    expect(guardar().disabled).toBe(true);
    expect(q('#empresa-cp').getAttribute('aria-invalid')).toBe('true');
  });

  it('guardar envía el payload normalizado y avisa', async () => {
    await montar();
    escribir('empresa-name', '  Nueva SL ');
    escribir('empresa-cif', 'b12345674');
    escribir('empresa-web', 'nueva.es');
    escribir('empresa-ciudad', '   ');
    await f.componentInstance.guardar();
    expect(updateCompany).toHaveBeenCalledWith('co', expect.objectContaining({
      name: 'Nueva SL', cif: 'B12345674', website: 'https://nueva.es', ciudad: undefined, tipoPersona: 'juridica',
    }));
    expect(toast.run).toHaveBeenCalledWith(expect.any(Function), expect.objectContaining({ successMessage: 'Datos de la empresa guardados' }));
  });

  it('si el guardado falla se conservan los valores del formulario', async () => {
    await montar();
    toast.run.mockImplementationOnce(async () => undefined);
    escribir('empresa-name', 'Editado');
    await f.componentInstance.guardar();
    f.detectChanges();
    expect(q<HTMLInputElement>('#empresa-name').value).toBe('Editado');
  });

  it('una actualización de la empresa no pisa lo que el usuario está editando', async () => {
    await montar();
    escribir('empresa-name', 'Editado');
    company.set({ ...(company() as object), name: 'Otro', logo: undefined });
    f.detectChanges();
    await f.whenStable();
    expect(q<HTMLInputElement>('#empresa-name').value).toBe('Editado');
  });

  it('incluye el uploader de logo y pasa AXE', async () => {
    await montar();
    expect(el().querySelector('app-company-logo-uploader')).not.toBeNull();
    const v = await analizarA11y(el());
    expect(v, formatearViolaciones(v)).toEqual([]);
  });
});
