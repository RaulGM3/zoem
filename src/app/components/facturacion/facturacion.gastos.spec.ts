import { describe, it, expect, vi } from 'vitest';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { signal } from '@angular/core';
import { Router } from '@angular/router';
import { FacturacionComponent } from './facturacion';
import { CasosService } from '../../core/services/casos.service';
import { UsersService } from '../../core/services/users';
import { InvoiceService } from '../../core/services/invoice.service';
import { InvoicePdfService } from '../../core/services/invoice-pdf.service';
import { CompanyService } from '../../core/services/company.service';
import { ContactService } from '../../core/services/contact.service';
import { PermissionService } from '../../core/services/permission.service';
import { ToastService } from '../../core/services/toast.service';
import { FacturasRecibidasService } from '../../core/services/facturas-recibidas.service';
import type { FirmRole } from '../../interfaces/member';

type Rol = FirmRole | 'Super';

async function montar(rol: Rol, mobile = false): Promise<ComponentFixture<FacturacionComponent>> {
  TestBed.resetTestingModule();
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
  const puedeFacturar = rol !== 'Usuario' && rol !== 'Viewer';
  TestBed.configureTestingModule({
    imports: [FacturacionComponent],
    providers: [
      { provide: CasosService, useValue: { casos: signal([]), loading: signal(false), loadCasos: async () => {}, loadAllHitos: async () => [] } },
      { provide: UsersService, useValue: { loadMembers: async () => {}, members: signal([]) } },
      { provide: InvoiceService, useValue: { invoices: signal([]), loadInvoices: async () => {} } },
      { provide: InvoicePdfService, useValue: {} },
      { provide: CompanyService, useValue: { activeCompany: signal({ id: 'co', name: 'X' }) } },
      { provide: ContactService, useValue: { contacts: signal([]), isLoading: signal(false), getContact: async () => null } },
      {
        provide: PermissionService,
        useValue: {
          can: () => puedeFacturar,
          hasRole: (...roles: string[]) => roles.includes(rol),
          isSuperUser: signal(rol === 'Super'),
        },
      },
      { provide: ToastService, useValue: { run: async (fn: () => unknown) => fn(), success: vi.fn(), fromError: vi.fn() } },
      { provide: Router, useValue: { navigate: () => {} } },
      {
        provide: FacturasRecibidasService,
        useValue: { facturas: signal([]), cargando: signal(false), cargar: vi.fn().mockResolvedValue(undefined) },
      },
    ],
  });
  const fixture = TestBed.createComponent(FacturacionComponent);
  fixture.detectChanges();
  await fixture.whenStable();
  fixture.detectChanges();
  return fixture;
}

const etiquetas = (f: ComponentFixture<FacturacionComponent>): string[] =>
  Array.from((f.nativeElement as HTMLElement).querySelectorAll('[data-tab]')).map((b) => (b.textContent ?? '').trim());

describe('FacturacionComponent — pestaña Gastos (facturas recibidas)', () => {
  for (const rol of ['Admin', 'Gestor', 'Super'] as const) {
    it(`${rol} ve la pestaña Gastos y su contenido`, async () => {
      const f = await montar(rol);
      expect(etiquetas(f)).toContain('Gastos');
      const gastos = Array.from((f.nativeElement as HTMLElement).querySelectorAll<HTMLButtonElement>('[data-tab]')).find(
        (b) => b.textContent?.trim() === 'Gastos',
      )!;
      gastos.click();
      f.detectChanges();
      await f.whenStable();
      f.detectChanges();
      expect((f.nativeElement as HTMLElement).querySelector('app-facturacion-gastos-tab')).not.toBeNull();
      expect((f.nativeElement as HTMLElement).textContent).toMatch(/no se envía nada a la AEAT/i);
    });
  }

  for (const rol of ['Usuario', 'Viewer'] as const) {
    it(`${rol} no ve la pestaña Gastos`, async () => {
      const f = await montar(rol);
      expect(etiquetas(f)).not.toContain('Gastos');
      expect(f.componentInstance.tabs().map((t) => t.id)).not.toContain('gastos');
    });
  }

  it('en móvil la sección Gastos aparece en el selector solo para Admin/Gestor', async () => {
    const gestor = await montar('Gestor', true);
    const opciones = Array.from((gestor.nativeElement as HTMLElement).querySelectorAll('#facturacion-seccion option')).map(
      (o) => o.textContent?.trim(),
    );
    expect(opciones).toContain('Gastos');
    const usuario = await montar('Usuario', true);
    const opcionesU = Array.from((usuario.nativeElement as HTMLElement).querySelectorAll('#facturacion-seccion option')).map(
      (o) => o.textContent?.trim(),
    );
    expect(opcionesU).not.toContain('Gastos');
  });

  it('si el rol se pierde estando en Gastos, la sección no se renderiza', async () => {
    const f = await montar('Usuario');
    f.componentInstance.activeTab.set('gastos');
    f.detectChanges();
    expect((f.nativeElement as HTMLElement).querySelector('app-facturacion-gastos-tab')).toBeNull();
  });
});
