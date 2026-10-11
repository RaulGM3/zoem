import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CompanyService } from '../../../core/services/company.service';
import { ToastService } from '../../../core/services/toast.service';
import { SuperuserService } from '../../../services/superuser';
import { CompaniesComponent } from './companies';

describe('CompaniesComponent (superusuario): país, región y moneda', () => {
  const createCompany = vi.fn();
  const updateCompany = vi.fn();
  const companias = [
    { id: 'es1', name: 'Madrid SL', email: 'a@b.es', ciudad: 'Madrid', ca: 'madrid', rubro: 'abogados', status: 'active', plan: 'free', tipoPersona: 'juridica', verifactu: { enabled: true, sandbox: true } },
    { id: 'co1', name: 'Paisa SAS', email: 'c@d.co', rubro: 'abogados', status: 'active', plan: 'free', tipoPersona: 'juridica', pais: 'CO', moneda: 'COP', region: 'CO-ANT' },
  ];

  beforeEach(() => {
    createCompany.mockReset().mockReturnValue(of(undefined));
    updateCompany.mockReset().mockReturnValue(of(undefined));
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [CompaniesComponent],
      providers: [
        { provide: SuperuserService, useValue: { getCompanies: () => of(companias), createCompany, updateCompany, deleteCompany: vi.fn() } },
        { provide: ToastService, useValue: { success: vi.fn(), fromError: vi.fn() } },
        { provide: CompanyService, useValue: { entrarComoSuperuser: vi.fn() } },
      ],
    });
  });

  function montar() {
    const fixture = TestBed.createComponent(CompaniesComponent);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    const cmp = fixture.componentInstance;
    const q = <T extends HTMLElement>(s: string) => el.querySelector<T>(s)!;
    const elegir = (id: string, v: string) => {
      const s = q<HTMLSelectElement>(`#${id}`);
      s.value = v;
      s.dispatchEvent(new Event('change'));
      fixture.detectChanges();
    };
    return { fixture, el, cmp, q, elegir };
  }

  it('la tabla no revienta con empresas sin ciudad y muestra la región de cada país', () => {
    const { el } = montar();
    expect(el.textContent).toContain('Comunidad de Madrid');
    expect(el.textContent).toContain('Antioquia');
  });

  it('la búsqueda tolera empresas sin ciudad', () => {
    const { cmp } = montar();
    cmp.search.set('paisa');
    expect(cmp.filteredCompanies().map((c) => c.id)).toEqual(['co1']);
  });

  it('alta nueva: España por defecto, con región de CA, moneda EUR y etiqueta CIF', () => {
    const { cmp } = montar();
    cmp.openCreate();
    expect(cmp.form.getRawValue()).toMatchObject({ pais: 'ES', region: 'madrid', moneda: 'EUR' });
    expect(cmp.cifLabel()).toBe('CIF');
  });

  it('al cambiar a México: región = capital, moneda local, etiqueta RFC, etiqueta de región Estado y Verifactu deshabilitado', () => {
    const { cmp, fixture, q, elegir } = montar();
    cmp.openCreate();
    cmp.form.controls.verifactuEnabled.setValue(true);
    fixture.detectChanges();
    elegir('co-pais', 'MX');
    expect(cmp.form.getRawValue()).toMatchObject({ pais: 'MX', region: 'MX-CMX', moneda: 'MXN', verifactuEnabled: false });
    expect(cmp.cifLabel()).toBe('RFC');
    expect(q('label[for="co-region"]').textContent).toContain('Estado');
    expect(Array.from(q<HTMLSelectElement>('#co-moneda').options).map((o) => o.value)).toEqual(['MXN', 'USD']);
    expect(q<HTMLInputElement>('#co-verifactu').disabled).toBe(true);
    elegir('co-pais', 'ES');
    expect(q<HTMLInputElement>('#co-verifactu').disabled).toBe(false);
  });

  it('crear en España guarda `ca` (sin `region`)', () => {
    const { cmp } = montar();
    cmp.openCreate();
    cmp.form.patchValue({ name: 'Nueva', email: 'x@y.es', telefono: '1', direccion: 'c', codigoPostal: '28001', ciudad: 'Madrid', region: 'cataluna' });
    cmp.save();
    const payload = createCompany.mock.calls[0][0];
    expect(payload).toMatchObject({ pais: 'ES', moneda: 'EUR', ca: 'cataluna' });
    expect(payload.region).toBeUndefined();
  });

  it('crear en Colombia guarda `region` ISO (sin `ca`) y fuerza Verifactu apagado', () => {
    const { cmp } = montar();
    cmp.openCreate();
    cmp.form.controls.pais.setValue('CO');
    cmp.form.patchValue({ name: 'Nueva', email: 'x@y.co', telefono: '1', direccion: 'c', codigoPostal: '050001', ciudad: 'Medellín', region: 'CO-ANT' });
    cmp.save();
    const payload = createCompany.mock.calls[0][0];
    expect(payload).toMatchObject({ pais: 'CO', moneda: 'COP', region: 'CO-ANT', verifactu: { enabled: false } });
    expect(payload.ca).toBeUndefined();
  });

  it('editar una empresa previa al backfill la ve como ES/EUR con su `ca`', () => {
    const { cmp } = montar();
    cmp.openEdit(companias[0] as never);
    expect(cmp.form.getRawValue()).toMatchObject({ pais: 'ES', moneda: 'EUR', region: 'madrid' });
  });

  it('editar y cambiar de país borra la región del país anterior', () => {
    const { cmp } = montar();
    cmp.openEdit(companias[0] as never);
    cmp.form.controls.pais.setValue('MX');
    cmp.form.patchValue({ telefono: '1', direccion: 'c', codigoPostal: '06600', ciudad: 'CDMX' });
    cmp.save();
    const payload = updateCompany.mock.calls[0][1];
    expect(payload).toMatchObject({ pais: 'MX', moneda: 'MXN', region: 'MX-CMX' });
    // `ca` viaja como centinela deleteField(), no como valor.
    expect(payload.ca).toBeDefined();
    expect(payload.ca).not.toBe('madrid');
  });
});
