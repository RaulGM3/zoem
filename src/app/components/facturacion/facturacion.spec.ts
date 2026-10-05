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
import type { Caso } from '../../interfaces';
import type { Contact } from '../../interfaces/contact.interface';

const ANA = { id: 'c-ana', type: 'persona_fisica', nombre: 'Ana', apellidos: 'Pérez', nifType: 'dni', nif: '12345678Z' } as Contact;
const ACME = { id: 'c-acme', type: 'persona_juridica', razonSocial: 'Acme SL', cifType: 'cif', cif: 'B12345674' } as Contact;

function caso(contactoIds: string[]): Caso {
  return {
    id: 'k-1', titulo: 'Caso 1', estado: 'en_proceso', contactoIds, hitos: [],
    resumenFinanciero: { totalHonorarios: 100, totalSuplidos: 0, totalIngresos: 0 },
  } as unknown as Caso;
}

describe('FacturacionComponent — clientes del caso al generar factura', () => {
  let fixture: ComponentFixture<FacturacionComponent>;

  async function montar(contactos: Contact[]): Promise<void> {
    TestBed.resetTestingModule();
    const porId = new Map(contactos.map((c) => [c.id, c]));
    TestBed.configureTestingModule({
      imports: [FacturacionComponent],
      providers: [
        { provide: CasosService, useValue: { casos: signal([]), loading: signal(false), loadCasos: async () => {}, loadAllHitos: async () => [] } },
        { provide: UsersService, useValue: { loadMembers: async () => {}, members: signal([]) } },
        { provide: InvoiceService, useValue: { invoices: signal([]), loadInvoices: async () => {} } },
        { provide: InvoicePdfService, useValue: {} },
        { provide: CompanyService, useValue: { activeCompany: signal({ id: 'co', name: 'X' }) } },
        {
          provide: ContactService,
          useValue: {
            contacts: signal([]),
            isLoading: signal(false),
            // Un contacto borrado o inexistente devuelve null, como el servicio real.
            getContact: async (id: string) => porId.get(id) ?? null,
          },
        },
        { provide: PermissionService, useValue: { can: () => true, hasRole: () => false, isSuperUser: signal(false) } },
        { provide: ToastService, useValue: { run: async (fn: () => unknown) => fn() } },
        { provide: Router, useValue: { navigate: () => {} } },
      ],
    });
    fixture = TestBed.createComponent(FacturacionComponent);
    await fixture.whenStable();
  }

  async function abrir(contactoIds: string[]): Promise<void> {
    fixture.componentInstance.abrirFactura(caso(contactoIds));
    await fixture.whenStable();
    await new Promise((r) => setTimeout(r));
    await fixture.whenStable();
  }

  it('si el primer contacto del caso ya no existe, precarga el siguiente válido', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    await montar([ANA]);
    await abrir(['c-borrado', 'c-ana']);

    const nombre = (fixture.nativeElement as HTMLElement).querySelector<HTMLInputElement>('#cliente-nombre')!;
    expect(nombre.value).toBe('Ana Pérez');
    expect(fixture.componentInstance.drawerContacto()?.id).toBe('c-ana');
  });

  it('pasa al drawer todos los clientes válidos del caso para elegir entre ellos', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    await montar([ANA, ACME]);
    await abrir(['c-ana', 'c-borrado', 'c-acme']);

    expect(fixture.componentInstance.drawerContactosCaso().map((c) => c.id)).toEqual(['c-ana', 'c-acme']);
    const opciones = Array.from((fixture.nativeElement as HTMLElement).querySelectorAll<HTMLOptionElement>('#cliente-caso option'));
    expect(opciones.map((o) => o.value)).toContain('c-acme');
  });

  it('la línea de honorarios del caso sale con IVA 10% por defecto', async () => {
    await montar([]);
    await abrir([]);
    const honorarios = fixture.componentInstance.drawerLineas().find((l) => l.concepto === 'Honorarios');
    expect(honorarios?.ivaRate).toBe(0.1);
  });

  it('avisa por consola de los contactos del caso que no se pudieron cargar', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    await montar([ANA]);
    await abrir(['c-borrado', 'c-ana']);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('c-borrado'));
  });
});

describe('FacturacionComponent — navegación de secciones en móvil', () => {
  let fixture: ComponentFixture<FacturacionComponent>;
  const el = (): HTMLElement => fixture.nativeElement;

  async function montar(mobile: boolean): Promise<void> {
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
    TestBed.configureTestingModule({
      imports: [FacturacionComponent],
      providers: [
        { provide: CasosService, useValue: { casos: signal([]), loading: signal(false), loadCasos: async () => {}, loadAllHitos: async () => [] } },
        { provide: UsersService, useValue: { loadMembers: async () => {}, members: signal([]) } },
        { provide: InvoiceService, useValue: { invoices: signal([]), isLoading: signal(false), loadInvoices: async () => {} } },
        { provide: InvoicePdfService, useValue: {} },
        { provide: CompanyService, useValue: { activeCompany: signal({ id: 'co', name: 'X' }) } },
        { provide: ContactService, useValue: { contacts: signal([]), isLoading: signal(false), getContact: async () => null } },
        { provide: PermissionService, useValue: { can: () => true, hasRole: () => false, isSuperUser: signal(false) } },
        { provide: ToastService, useValue: { run: async (fn: () => unknown) => fn() } },
        { provide: Router, useValue: { navigate: () => {} } },
      ],
    });
    fixture = TestBed.createComponent(FacturacionComponent);
    await fixture.whenStable();
  }

  it('móvil: muestra un select "Sección" y no la barra de pestañas', async () => {
    await montar(true);
    const select = el().querySelector<HTMLSelectElement>('select#facturacion-seccion')!;
    expect(select).not.toBeNull();
    expect(el().querySelector('label[for="facturacion-seccion"]')?.textContent).toContain('Sección');
    expect(select.options).toHaveLength(5);
    expect(select.value).toBe('casos');
    expect(el().querySelector('[role="tablist"], button[data-tab]')).toBeNull();
  });

  it('móvil: cambiar el select cambia la pestaña activa', async () => {
    await montar(true);
    const select = el().querySelector<HTMLSelectElement>('select#facturacion-seccion')!;
    select.value = 'facturas';
    select.dispatchEvent(new Event('change'));
    await fixture.whenStable();
    expect(fixture.componentInstance.activeTab()).toBe('facturas');
    expect(el().querySelector('app-facturacion-facturas-tab')).not.toBeNull();
  });

  it('móvil: el select refleja cambios de pestaña hechos por otra vía', async () => {
    await montar(true);
    fixture.componentInstance.activeTab.set('archivo');
    await fixture.whenStable();
    expect(el().querySelector<HTMLSelectElement>('select#facturacion-seccion')!.value).toBe('archivo');
  });

  it('escritorio: pestañas como botones y sin select', async () => {
    await montar(false);
    expect(el().querySelector('select#facturacion-seccion')).toBeNull();
    const botones = Array.from(el().querySelectorAll<HTMLButtonElement>('button[data-tab]'));
    expect(botones.map((b) => b.textContent?.trim())).toEqual([
      'Casos abiertos', 'Facturas', 'Archivo', 'Registro de Horas', 'Configuración',
    ]);
    botones[1].click();
    await fixture.whenStable();
    expect(fixture.componentInstance.activeTab()).toBe('facturas');
  });

  it('el botón "Configuración" de la cabecera se oculta en móvil (hidden sm:inline-flex)', async () => {
    await montar(true);
    const btn = el().querySelector<HTMLButtonElement>('button[data-config-header]')!;
    expect(btn.classList.contains('hidden')).toBe(true);
    expect(btn.classList.contains('sm:inline-flex')).toBe(true);
  });
});
