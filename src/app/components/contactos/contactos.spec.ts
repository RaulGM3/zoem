import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ChangeDetectionStrategy, Component, input, output, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { ActivatedRoute, Router, convertToParamMap, provideRouter, type ParamMap } from '@angular/router';
import { BehaviorSubject } from 'rxjs';
import { ContactosComponent } from './contactos';
import { AccionLanzadorComponent } from '../../shared/components/accion-lanzador/accion-lanzador';
import { ImportarContactosComponent } from './components/importar-contactos/importar-contactos';
import {
  EstadoContactoDialogComponent, type CambioEstadoResult,
} from '../../shared/components/estado-contacto-dialog/estado-contacto-dialog';
import { ContactService } from '../../core/services/contact.service';
import { UsersService } from '../../core/services/users';
import { SearchService } from '../../core/services/search.service';
import { PermissionService } from '../../core/services/permission.service';
import { ToastService } from '../../core/services/toast.service';
import { SeguimientoContactoService } from '../../core/services/seguimiento-contacto.service';
import type { CompanyMember, Contact } from '../../interfaces';

interface RunOptions { successMessage?: string; errorTitle?: string; onSuccess?: () => void }

@Component({ selector: 'app-importar-contactos', template: '', changeDetection: ChangeDetectionStrategy.OnPush })
class ImportarStubComponent {
  readonly visible = input.required<boolean>();
  readonly closed = output<void>();
}

@Component({ selector: 'app-estado-contacto-dialog', template: '', changeDetection: ChangeDetectionStrategy.OnPush })
class EstadoDialogStubComponent {
  readonly contacto = input.required<Contact>();
  readonly soloSeguimiento = input(false);
  readonly closed = output<void>();
  readonly saved = output<CambioEstadoResult>();
}

@Component({ selector: 'app-accion-lanzador', template: '', changeDetection: ChangeDetectionStrategy.OnPush })
class AccionLanzadorStubComponent {
  readonly ambito = input.required<string>();
  readonly contactos = input.required<Contact[]>();
  readonly closed = output<void>();
}

const ANA = {
  id: 'c1', type: 'persona_fisica', nombre: 'Ana', apellidos: 'López', nifType: 'nie', nif: 'X1234567L',
  nacionalidad: 'FR', estadoCivil: 'soltero', email: 'ana@example.com', mobile: '600111222', status: 'activo',
  notes: 'Cliente VIP', asunto: 'Herencia', canalEntrada: 'web', assignedTo: 'u2', totalBilled: 1000, activeProjects: 2,
  direccion: { calle: 'Mayor', numero: '3', codigoPostal: '28001', municipio: 'Madrid', provincia: 'Madrid', pais: 'ES' },
  createdAt: { toMillis: () => 100 },
} as unknown as Contact;

const ACME = {
  id: 'c2', type: 'persona_juridica', razonSocial: 'Acme S.L.', nombreComercial: 'Acme', formaJuridica: 'S.L.',
  cifType: 'vat', cif: 'B12345678', sectorActividad: 'Logística', website: 'https://acme.test',
  representanteLegalNombre: 'Luis Pérez', email: 'info@acme.test', mobile: '', status: 'potencial', totalBilled: 500,
  direccionSocial: { calle: 'Gran Vía', numero: '1', codigoPostal: '08001', municipio: 'Barcelona', provincia: 'Barcelona', pais: 'ES' },
  createdAt: { toMillis: () => 200 },
} as unknown as Contact;

const MEMBERS = [
  { id: 'm1', userId: 'u1', nombre: 'Marta' },
  { id: 'm2', userId: 'u2', nombre: 'Luis', apellido: 'Gil' },
] as CompanyMember[];

describe('ContactosComponent', () => {
  let fixture: ComponentFixture<ContactosComponent>;
  let contacts: ReturnType<typeof signal<Contact[]>>;
  let isLoading: ReturnType<typeof signal<boolean>>;
  let term: ReturnType<typeof signal<string>>;
  let denegados: Set<string>;
  let queryParams: BehaviorSubject<ParamMap>;
  let navigate: ReturnType<typeof vi.spyOn>;
  let run: ReturnType<typeof vi.fn>;
  let contactService: {
    contacts: typeof contacts;
    isLoading: typeof isLoading;
    loadContacts: ReturnType<typeof vi.fn>;
    createContact: ReturnType<typeof vi.fn>;
    updateContact: ReturnType<typeof vi.fn>;
    deleteContact: ReturnType<typeof vi.fn>;
  };
  let seguimientos: { cambiarEstado: ReturnType<typeof vi.fn>; programarSeguimiento: ReturnType<typeof vi.fn> };

  const el = (): HTMLElement => fixture.nativeElement;
  const q = <T extends HTMLElement>(selector: string): T => {
    const found = el().querySelector<T>(selector);
    expect(found, selector).toBeTruthy();
    return found!;
  };
  const qa = <T extends HTMLElement>(selector: string): T[] => Array.from(el().querySelectorAll<T>(selector));
  const boton = (texto: string, raiz: HTMLElement = el()): HTMLButtonElement | undefined =>
    Array.from(raiz.querySelectorAll('button')).find(b => b.textContent?.replace(/\s+/g, ' ').includes(texto));
  const tarjetas = (): HTMLElement[] => qa('[role="group"][aria-label^="Ficha de"]');
  const tarjeta = (nombre: string): HTMLElement => q(`[role="group"][aria-label="Ficha de ${nombre}"]`);
  const nombreDialogo = (): string | null | undefined => {
    const id = drawer()!.getAttribute('aria-labelledby');
    return el().querySelector(`#${id}`)?.textContent?.trim();
  };
  const drawer = (): HTMLElement | null => el().querySelector('[role="dialog"]');
  const dialogosEstado = (): EstadoDialogStubComponent[] =>
    fixture.debugElement.queryAll(By.directive(EstadoDialogStubComponent)).map(d => d.componentInstance);

  async function estable(): Promise<void> {
    fixture.detectChanges();
    // Deja correr las promesas encadenadas (toast.run) antes de repintar.
    await new Promise(resolve => setTimeout(resolve, 0));
    await fixture.whenStable();
    fixture.detectChanges();
  }

  async function click(target: HTMLElement | undefined | null): Promise<void> {
    expect(target).toBeTruthy();
    target!.click();
    await estable();
  }

  function escribir(id: string, valor: string): void {
    const control = q<HTMLInputElement | HTMLSelectElement>(`#${id}`);
    control.value = valor;
    control.dispatchEvent(new Event(control.tagName === 'SELECT' ? 'change' : 'input'));
    fixture.detectChanges();
  }

  const valor = (id: string): string => q<HTMLInputElement>(`#${id}`).value;
  const existe = (id: string): boolean => el().querySelector(`#${id}`) !== null;

  async function crear(): Promise<void> {
    navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    fixture = TestBed.createComponent(ContactosComponent);
    await estable();
  }

  beforeEach(async () => {
    contacts = signal<Contact[]>([ANA, ACME]);
    isLoading = signal(false);
    term = signal('');
    denegados = new Set();
    queryParams = new BehaviorSubject<ParamMap>(convertToParamMap({}));
    history.replaceState(null, '');
    run = vi.fn(async (action: () => Promise<unknown>, opts: RunOptions = {}) => {
      try {
        const result = await action();
        opts.onSuccess?.();
        return result;
      } catch {
        return undefined;
      }
    });
    contactService = {
      contacts,
      isLoading,
      loadContacts: vi.fn().mockResolvedValue(undefined),
      createContact: vi.fn().mockImplementation(async (data: object) => ({ id: 'nuevo', ...data })),
      updateContact: vi.fn().mockResolvedValue(undefined),
      deleteContact: vi.fn().mockResolvedValue(undefined),
    };
    seguimientos = {
      cambiarEstado: vi.fn().mockResolvedValue(undefined),
      programarSeguimiento: vi.fn().mockResolvedValue(undefined),
    };

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [ContactosComponent],
      providers: [
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: { queryParamMap: queryParams, snapshot: { get queryParamMap() { return queryParams.value; } } },
        },
        { provide: ContactService, useValue: contactService },
        { provide: UsersService, useValue: { members: signal(MEMBERS), loadMembers: vi.fn().mockResolvedValue(undefined) } },
        { provide: SearchService, useValue: { termFor: () => term } },
        { provide: PermissionService, useValue: { can: (modulo: string, cap: string) => !denegados.has(`${modulo}:${cap}`) } },
        { provide: ToastService, useValue: { run } },
        { provide: SeguimientoContactoService, useValue: seguimientos },
      ],
    });
    TestBed.overrideComponent(ContactosComponent, {
      remove: { imports: [ImportarContactosComponent, EstadoContactoDialogComponent, AccionLanzadorComponent] },
      add: { imports: [ImportarStubComponent, EstadoDialogStubComponent, AccionLanzadorStubComponent] },
    });
    await TestBed.compileComponents();
  });

  describe('listado', () => {
    it('carga contactos y miembros al entrar', async () => {
      await crear();
      expect(contactService.loadContacts).toHaveBeenCalledTimes(1);
      expect(run.mock.calls[0][1]).toMatchObject({ errorTitle: 'No se pudieron cargar los contactos' });
      expect(TestBed.inject(UsersService).loadMembers).toHaveBeenCalled();
    });

    it('muestra los KPIs', async () => {
      await crear();
      const kpis = qa('.kpi-card').slice(0, 3).map(k => k.textContent?.replace(/\s+/g, ' ').trim());
      expect(kpis[0]).toContain('Total Contactos 2');
      expect(kpis[1]).toContain('Activos 1');
      expect(el().textContent).not.toContain('Facturación Total');
    });

    it('la tercera KPI es un botón que rota entre potenciales, pendientes de pago y de presupuesto', async () => {
      contacts.set([
        ANA, ACME,
        { ...ACME, id: 'c3', status: 'pendiente_pago' } as Contact,
        { ...ACME, id: 'c4', status: 'pendiente_pago' } as Contact,
        { ...ACME, id: 'c5', status: 'pendiente_presupuesto' } as Contact,
        { ...ACME, id: 'c6', status: 'pendiente_presupuesto' } as Contact,
        { ...ACME, id: 'c7', status: 'pendiente_presupuesto' } as Contact,
      ]);
      await crear();
      const kpi = (): HTMLButtonElement => q<HTMLButtonElement>('button.kpi-card');
      // Texto accesible: sin la ligadura del icono ni los indicadores aria-hidden.
      const texto = (): string => {
        const copia = kpi().cloneNode(true) as HTMLElement;
        copia.querySelectorAll('[aria-hidden="true"]').forEach(n => n.remove());
        return copia.textContent?.replace(/\s+/g, ' ').trim() ?? '';
      };

      expect(kpi().type).toBe('button');
      expect(texto()).toContain('Potenciales 1');
      expect(texto()).toContain('Cambiar a Pendientes de pago');

      await click(kpi());
      expect(texto()).toContain('Pendientes de pago 2');
      expect(texto()).toContain('Cambiar a Pendientes de presupuesto');

      await click(kpi());
      expect(texto()).toContain('Pendientes de presupuesto 3');
      expect(texto()).toContain('Cambiar a Potenciales');

      await click(kpi());
      expect(texto()).toContain('Potenciales 1');
    });

    it('lista los contactos del más reciente al más antiguo con sus datos', async () => {
      await crear();
      expect(tarjetas().map(t => t.getAttribute('aria-label'))).toEqual(['Ficha de Acme S.L.', 'Ficha de Ana López']);
      const ana = tarjeta('Ana López').textContent ?? '';
      expect(ana).toContain('Persona Física');
      expect(ana).toContain('ana@example.com');
      expect(ana).toContain('600111222');
      expect(ana).toContain('Cliente VIP');
      expect(tarjeta('Acme S.L.').textContent).toContain('Logística');
    });

    it('filtra por estado, tipo y texto de búsqueda', async () => {
      await crear();
      const [estado, tipo] = qa<HTMLSelectElement>('select.form-select');
      estado.value = 'activo';
      estado.dispatchEvent(new Event('change'));
      fixture.detectChanges();
      expect(tarjetas()).toHaveLength(1);
      estado.value = '';
      estado.dispatchEvent(new Event('change'));
      tipo.value = 'persona_juridica';
      tipo.dispatchEvent(new Event('change'));
      fixture.detectChanges();
      expect(tarjetas().map(t => t.getAttribute('aria-label'))).toEqual(['Ficha de Acme S.L.']);
      tipo.value = '';
      tipo.dispatchEvent(new Event('change'));
      term.set('600111');
      fixture.detectChanges();
      expect(tarjetas().map(t => t.getAttribute('aria-label'))).toEqual(['Ficha de Ana López']);
      term.set('nadie');
      fixture.detectChanges();
      expect(el().textContent).toContain('No se encontraron contactos');
    });

    it('muestra el estado de carga', async () => {
      isLoading.set(true);
      await crear();
      expect(el().textContent).toContain('Cargando contactos...');
      expect(tarjetas()).toHaveLength(0);
    });

    it('oculta las acciones para las que no hay permiso', async () => {
      denegados = new Set(['Contactos:crear', 'Contactos:editar', 'Contactos:eliminar']);
      await crear();
      expect(boton('Nuevo Contacto')).toBeUndefined();
      expect(boton('Importar Excel')).toBeUndefined();
      expect(qa('[aria-label="Editar contacto"]')).toHaveLength(0);
      expect(qa('[aria-label="Eliminar contacto"]')).toHaveLength(0);
      expect(qa('[aria-label^="Cambiar estado de"]')).toHaveLength(0);
    });

    it('abre la importación desde Excel', async () => {
      await crear();
      const importar = fixture.debugElement.query(By.directive(ImportarStubComponent)).componentInstance as ImportarStubComponent;
      expect(importar.visible()).toBe(false);
      await click(boton('Importar Excel'));
      expect(importar.visible()).toBe(true);
      importar.closed.emit();
      await estable();
      expect(importar.visible()).toBe(false);
    });

    it('navega a la ficha con Enter y abre un caso para el contacto', async () => {
      await crear();
      tarjeta('Ana López').dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
      expect(navigate).toHaveBeenCalledWith(['/contactos', 'c1']);
      await click(tarjeta('Ana López').querySelector<HTMLButtonElement>('[aria-label="Abrir caso para este contacto"]'));
      expect(navigate).toHaveBeenCalledWith(['/casos'], { queryParams: { newCaso: '1', contactId: 'c1' } });
    });

    it('elimina un contacto tras confirmar', async () => {
      await crear();
      await click(tarjeta('Ana López').querySelector<HTMLButtonElement>('[aria-label="Eliminar contacto"]'));
      expect(contactService.deleteContact).not.toHaveBeenCalled();
      await click(tarjeta('Ana López').querySelector<HTMLButtonElement>('[aria-label="Cancelar"]'));
      await click(tarjeta('Ana López').querySelector<HTMLButtonElement>('[aria-label="Eliminar contacto"]'));
      await click(tarjeta('Ana López').querySelector<HTMLButtonElement>('[aria-label="Confirmar eliminación"]'));
      expect(contactService.deleteContact).toHaveBeenCalledWith('c1');
      expect(tarjeta('Ana López').querySelector('[aria-label="Confirmar eliminación"]')).toBeNull();
    });

    it('cambia el estado desde el chip', async () => {
      await crear();
      await click(tarjeta('Ana López').querySelector<HTMLButtonElement>('[aria-label^="Cambiar estado de"]'));
      expect(dialogosEstado()).toHaveLength(1);
      expect(dialogosEstado()[0].contacto()).toBe(ANA);
      expect(dialogosEstado()[0].soloSeguimiento()).toBe(false);
      dialogosEstado()[0].saved.emit({ status: 'inactivo' });
      await estable();
      expect(seguimientos.cambiarEstado).toHaveBeenCalledWith(ANA, 'inactivo', undefined);
      expect(dialogosEstado()).toHaveLength(0);
    });
  });

  describe('acciones', () => {
    const lanzador = (): AccionLanzadorStubComponent | null =>
      fixture.debugElement.query(By.directive(AccionLanzadorStubComponent))?.componentInstance ?? null;
    const botonAcciones = (nombre: string) =>
      tarjeta(nombre).querySelector<HTMLButtonElement>('[aria-label="Acciones para este contacto"]');

    it('el botón de acciones de la tarjeta abre el lanzador con ámbito contacto y ese contacto', async () => {
      await crear();
      expect(lanzador()).toBeNull();
      await click(botonAcciones('Ana López'));
      expect(lanzador()).not.toBeNull();
      expect(lanzador()!.ambito()).toBe('contacto');
      expect(lanzador()!.contactos().map(c => c.id)).toEqual(['c1']);
    });

    it('cerrar el lanzador lo desmonta', async () => {
      await crear();
      await click(botonAcciones('Ana López'));
      lanzador()!.closed.emit();
      await estable();
      expect(lanzador()).toBeNull();
    });

    it('sin permiso Contactos:editar no hay botón de acciones', async () => {
      denegados.add('Contactos:editar');
      await crear();
      expect(botonAcciones('Ana López')).toBeNull();
    });
  });

  describe('integración del drawer', () => {
    async function altaRapida(): Promise<void> {
      await click(boton('Nuevo Contacto'));
      escribir('nombre', 'Eva');
      escribir('apellidos', 'Ruiz');
      escribir('email', 'eva@example.com');
      await click(boton('Continuar', drawer()!));
      await click(boton('Guardar contacto', drawer()!));
    }

    it('se cierra con Cerrar, con el fondo y con Escape, y reabre limpio', async () => {
      await crear();
      await click(boton('Nuevo Contacto'));
      escribir('nombre', 'Borrador');
      await click(drawer()!.querySelector<HTMLButtonElement>('[aria-label="Cerrar"]'));
      expect(drawer()).toBeNull();

      await click(boton('Nuevo Contacto'));
      expect(valor('nombre')).toBe('');
      await click(q('[data-overlay-backdrop]'));
      expect(drawer()).toBeNull();

      await click(boton('Nuevo Contacto'));
      drawer()!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      await estable();
      expect(drawer()).toBeNull();
    });

    it('tras editar, un alta nueva abre vacía y en el paso 1', async () => {
      await crear();
      await click(tarjeta('Ana López').querySelector<HTMLButtonElement>('[aria-label="Editar contacto"]'));
      expect(nombreDialogo()).toBe('Editar contacto');
      expect(valor('nombre')).toBe('Ana');
      await click(boton('Cancelar', drawer()!));
      await click(boton('Nuevo Contacto'));
      expect(nombreDialogo()).toBe('Nuevo contacto');
      expect(valor('nombre')).toBe('');
      expect(existe('calle')).toBe(false);
    });

    it('tras un alta propone el primer seguimiento sobre el contacto creado', async () => {
      await crear();
      await altaRapida();
      expect(dialogosEstado()).toHaveLength(1);
      expect(dialogosEstado()[0].soloSeguimiento()).toBe(true);
      expect(dialogosEstado()[0].contacto()).toMatchObject({ id: 'nuevo', nombre: 'Eva' });
      const seguimiento = { titulo: 'Llamar' } as unknown as NonNullable<CambioEstadoResult['seguimiento']>;
      dialogosEstado()[0].saved.emit({ status: 'activo', seguimiento });
      await estable();
      expect(seguimientos.programarSeguimiento).toHaveBeenCalledWith(expect.objectContaining({ id: 'nuevo' }), seguimiento);
      expect(dialogosEstado()).toHaveLength(0);
    });

    it('no propone seguimiento sin permiso de calendario ni al editar', async () => {
      denegados = new Set(['Calendario:crear']);
      await crear();
      await altaRapida();
      expect(dialogosEstado()).toHaveLength(0);

      denegados = new Set();
      await click(tarjeta('Ana López').querySelector<HTMLButtonElement>('[aria-label="Editar contacto"]'));
      await click(boton('Guardar cambios', drawer()!));
      expect(contactService.updateContact).toHaveBeenCalled();
      expect(dialogosEstado()).toHaveLength(0);
    });
  });

  describe('intenciones por URL', () => {
    it('newContact=1 abre el alta con los datos de history.state y limpia la URL', async () => {
      history.replaceState({ nombre: 'Eva', apellidos: 'Ruiz', mobile: '611222333', notes: 'Desde recepción' }, '');
      queryParams.next(convertToParamMap({ newContact: '1' }));
      await crear();
      expect(nombreDialogo()).toBe('Nuevo contacto');
      expect([valor('nombre'), valor('apellidos'), valor('mobile'), valor('notes')])
        .toEqual(['Eva', 'Ruiz', '611222333', 'Desde recepción']);
      expect(valor('status')).toBe('activo');
      expect(navigate).toHaveBeenCalledWith([], expect.objectContaining({ queryParams: {}, replaceUrl: true }));
    });

    it('newContact=1 también abre el alta si llega con el componente ya montado', async () => {
      await crear();
      expect(drawer()).toBeNull();
      history.replaceState({ nombre: 'Noa' }, '');
      queryParams.next(convertToParamMap({ newContact: '1' }));
      await estable();
      expect(valor('nombre')).toBe('Noa');
      expect(valor('apellidos')).toBe('');
    });

    it('una segunda petición por URL sustituye los datos del drawer ya abierto', async () => {
      history.replaceState({ nombre: 'Eva' }, '');
      queryParams.next(convertToParamMap({ newContact: '1' }));
      await crear();
      escribir('apellidos', 'Escrito a mano');
      history.replaceState({ nombre: 'Noa' }, '');
      queryParams.next(convertToParamMap({ newContact: '1' }));
      await estable();
      expect([valor('nombre'), valor('apellidos')]).toEqual(['Noa', '']);
    });

    it('editContact=<id> abre la edición cuando la lista termina de cargar', async () => {
      isLoading.set(true);
      queryParams.next(convertToParamMap({ editContact: 'c1' }));
      await crear();
      expect(drawer()).toBeNull();
      isLoading.set(false);
      await estable();
      expect(nombreDialogo()).toBe('Editar contacto');
      expect(valor('nombre')).toBe('Ana');
      expect(navigate).toHaveBeenCalledWith([], expect.objectContaining({ queryParams: {}, replaceUrl: true }));
    });
  });
});
