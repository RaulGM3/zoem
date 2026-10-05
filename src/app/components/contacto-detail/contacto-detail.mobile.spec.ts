import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ChangeDetectionStrategy, Component, input, output, signal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { ContactoDetailComponent } from './contacto-detail';
import {
  EstadoContactoDialogComponent, type CambioEstadoResult,
} from '../../shared/components/estado-contacto-dialog/estado-contacto-dialog';
import { AccionLanzadorComponent } from '../../shared/components/accion-lanzador/accion-lanzador';
import { ComunicacionesEnviadasComponent } from '../../shared/components/comunicaciones-enviadas/comunicaciones-enviadas';
import { ContactService } from '../../core/services/contact.service';
import { ContactFolderService } from '../../core/services/contact-folder.service';
import { ContactFileService } from '../../core/services/contact-file.service';
import { UploadQueueService } from '../../core/services/upload-queue.service';
import { CasosService } from '../../core/services/casos.service';
import { EventosService } from '../../core/services/eventos.service';
import { SeguimientoContactoService } from '../../core/services/seguimiento-contacto.service';
import { UsersService } from '../../core/services/users';
import { PermissionService } from '../../core/services/permission.service';
import { ToastService } from '../../core/services/toast.service';
import type { AmbitoAccion, Caso, CompanyMember, Contact, ContactFile, ContactFolder, Evento, Hito } from '../../interfaces';
import { analizarA11y, formatearViolaciones } from '../../../testing/axe';

@Component({ selector: 'app-estado-contacto-dialog', template: '', changeDetection: ChangeDetectionStrategy.OnPush })
class EstadoDialogStubComponent {
  readonly contacto = input.required<Contact>();
  readonly soloSeguimiento = input(false);
  readonly closed = output<void>();
  readonly saved = output<CambioEstadoResult>();
}

@Component({ selector: 'app-accion-lanzador', template: '', changeDetection: ChangeDetectionStrategy.OnPush })
class AccionLanzadorStubComponent {
  readonly ambito = input.required<AmbitoAccion>();
  readonly contactos = input.required<Contact[]>();
  readonly caso = input<Caso | null>(null);
  readonly hitos = input<Hito[]>([]);
  readonly hitoId = input<string | null>(null);
  readonly closed = output<void>();
}

@Component({ selector: 'app-comunicaciones-enviadas', template: '', changeDetection: ChangeDetectionStrategy.OnPush })
class ComunicacionesEnviadasStubComponent {
  readonly contactoId = input<string | null>(null);
  readonly casoId = input<string | null>(null);
}

const ANA = {
  id: 'c1', type: 'persona_fisica', nombre: 'Ana', apellidos: 'López', email: 'ana@example.com',
  mobile: '600111222', status: 'activo', notes: '',
} as unknown as Contact;

const SIN_DATOS = {
  id: 'c2', type: 'persona_fisica', nombre: 'Eva', apellidos: 'Ruiz', email: '', status: 'activo',
} as unknown as Contact;

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

describe('ContactoDetailComponent — móvil', () => {
  let fixture: ComponentFixture<ContactoDetailComponent>;
  let denegados: Set<string>;
  let navigate: ReturnType<typeof vi.spyOn>;
  const el = (): HTMLElement => fixture.nativeElement;

  async function estable(): Promise<void> {
    fixture.detectChanges();
    await new Promise((r) => setTimeout(r, 0));
    await fixture.whenStable();
    fixture.detectChanges();
  }

  async function montar(mobile: boolean, contacto: Contact = ANA): Promise<void> {
    TestBed.resetTestingModule();
    mockViewport(mobile);
    TestBed.configureTestingModule({
      imports: [ContactoDetailComponent],
      providers: [
        provideRouter([]),
        { provide: ContactService, useValue: { getContact: vi.fn().mockResolvedValue(contacto), updateContact: vi.fn() } },
        { provide: ContactFolderService, useValue: { folders: signal<ContactFolder[]>([]), isLoading: signal(false), loadFolders: vi.fn().mockResolvedValue(undefined) } },
        { provide: ContactFileService, useValue: { files: signal<ContactFile[]>([]), isLoading: signal(false), loadFiles: vi.fn().mockResolvedValue(undefined) } },
        { provide: UploadQueueService, useValue: { enqueue: vi.fn() } },
        { provide: CasosService, useValue: { casos: signal<Caso[]>([]), loadCasos: vi.fn().mockResolvedValue(undefined) } },
        { provide: EventosService, useValue: { eventos: signal<Evento[]>([]), loadEventos: vi.fn().mockResolvedValue(undefined), updateEvento: vi.fn() } },
        { provide: SeguimientoContactoService, useValue: { cambiarEstado: vi.fn() } },
        { provide: UsersService, useValue: { members: signal<CompanyMember[]>([]), loadMembers: vi.fn().mockResolvedValue(undefined) } },
        {
          provide: PermissionService,
          useValue: {
            can: (m: string, c: string) => !denegados.has(`${m}:${c}`),
            currentMember: () => null, userRole: () => null, isSuperUser: () => false,
          },
        },
        { provide: ToastService, useValue: { run: vi.fn(async (a: () => Promise<unknown>) => a()) } },
      ],
    });
    TestBed.overrideComponent(ContactoDetailComponent, {
      remove: { imports: [EstadoContactoDialogComponent, AccionLanzadorComponent, ComunicacionesEnviadasComponent] },
      add: { imports: [EstadoDialogStubComponent, AccionLanzadorStubComponent, ComunicacionesEnviadasStubComponent] },
    });
    await TestBed.compileComponents();
    navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    fixture = TestBed.createComponent(ContactoDetailComponent);
    fixture.componentRef.setInput('id', contacto.id);
    await estable();
  }

  beforeEach(() => {
    denegados = new Set();
    TestBed.resetTestingModule();
  });

  describe('cabecera', () => {
    it('móvil: las acciones van en un menú y no hay botón Editar suelto', async () => {
      await montar(true);
      expect(el().querySelector('[data-cabecera] app-action-menu')).not.toBeNull();
      const editar = Array.from(el().querySelectorAll('[data-cabecera] > button')).find((b) => b.textContent?.trim() === 'Editar');
      expect(editar).toBeUndefined();
    });

    it('móvil: Editar desde el menú navega a la edición', async () => {
      await montar(true);
      el().querySelector<HTMLButtonElement>('[data-cabecera] button[aria-haspopup="menu"]')!.click();
      await estable();
      el().querySelector<HTMLButtonElement>('[data-action-id="edit"]')!.click();
      await estable();
      expect(navigate).toHaveBeenCalledWith(['/contactos'], { queryParams: { editContact: 'c1' } });
    });

    it('escritorio: botón Editar y sin menú de acciones en la cabecera', async () => {
      await montar(false);
      expect(el().querySelector('[data-cabecera] app-action-menu')).toBeNull();
      const editar = Array.from(el().querySelectorAll('button')).find((b) => b.textContent?.trim() === 'Editar');
      expect(editar).toBeTruthy();
    });

    it('móvil sin permiso de edición: sin menú', async () => {
      denegados.add('Contactos:editar');
      await montar(true);
      expect(el().querySelector('[data-cabecera] app-action-menu')).toBeNull();
    });
  });

  describe('accionesContacto (misma lógica que el botón de escritorio)', () => {
    it('con permiso: editar y cambiar estado', async () => {
      await montar(false);
      expect(fixture.componentInstance.accionesContacto().map((a) => a.id)).toEqual(['edit', 'estado']);
    });

    it('sin permiso de edición: ninguna', async () => {
      denegados.add('Contactos:editar');
      await montar(false);
      expect(fixture.componentInstance.accionesContacto()).toEqual([]);
    });
  });

  describe('acciones rápidas', () => {
    it('móvil: enlaces tel: y mailto: con área táctil', async () => {
      await montar(true);
      const tel = el().querySelector<HTMLAnchorElement>('[data-acciones-rapidas] a[href="tel:600111222"]')!;
      const mail = el().querySelector<HTMLAnchorElement>('[data-acciones-rapidas] a[href="mailto:ana@example.com"]')!;
      expect(tel.className).toContain('tap-target');
      expect(mail.className).toContain('tap-target');
    });

    it('móvil: sin teléfono ni email no hay barra de acciones rápidas', async () => {
      await montar(true, SIN_DATOS);
      expect(el().querySelector('[data-acciones-rapidas]')).toBeNull();
    });

    it('escritorio: no hay barra de acciones rápidas', async () => {
      await montar(false);
      expect(el().querySelector('[data-acciones-rapidas]')).toBeNull();
    });
  });

  it('el contenedor reduce el padding en móvil', async () => {
    await montar(true);
    expect(el().querySelector('[data-detalle]')!.className).toContain('p-4');
  });

  it('axe: sin violaciones en móvil', async () => {
    await montar(true);
    const violaciones = await analizarA11y(el());
    expect(violaciones, `\n${formatearViolaciones(violaciones)}\n`).toEqual([]);
  });
});
