import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';

import { DashboardComponent } from './dashboard';
import { PermissionService } from '../../core/services/permission.service';
import { IaContactService } from '../../core/services/ia-contact.service';
import { CasosService } from '../../core/services/casos.service';
import { GestoriaService } from '../../core/services/gestoria.service';
import { CuentasService } from '../../core/services/cuentas.service';
import { EventosService } from '../../core/services/eventos.service';
import { ActividadService } from '../../core/services/actividad.service';
import type { Evento } from '../../interfaces/evento.interface';

const HOY = '2026-09-21';

function evento(over: Partial<Evento> = {}): Evento {
  return {
    id: 'ev-1',
    companyId: 'c-1',
    titulo: 'Evento',
    fecha: '2026-09-25',
    todoDia: true,
    estado: 'confirmado',
    recurrencia: 'ninguna',
    prioridad: 'media',
    color: 'azul',
    invitados: 'todos',
    creadoPor: 'u-1',
    createdAt: undefined as never,
    updatedAt: undefined as never,
    ...over,
  };
}

function seguimiento(over: Partial<Evento> = {}): Evento {
  return evento({
    responsableId: 'u-yo',
    entregable: 'Enviar propuesta',
    origen: {
      tipo: 'seguimiento_contacto',
      contactoId: 'ct-1',
      contactoNombre: 'Ana Ruiz',
      statusOrigen: 'potencial',
      statusDestino: 'pendiente_presupuesto',
    },
    ...over,
  });
}

describe('DashboardComponent — seguimientos', () => {
  let component: DashboardComponent;

  async function montar(eventos: Evento[]) {
    TestBed.resetTestingModule();
    await TestBed.configureTestingModule({
      imports: [DashboardComponent],
      providers: [
        provideRouter([]),
        {
          provide: PermissionService,
          useValue: {
            can: () => true,
            currentMember: signal({ userId: 'u-yo', role: 'Usuario' }),
            userRole: signal('Usuario'),
            isSuperUser: signal(false),
          },
        },
        { provide: IaContactService, useValue: { iaContacts: signal([]), loadIaContacts: vi.fn() } },
        {
          provide: CasosService,
          useValue: {
            casos: signal([]),
            loadCasos: vi.fn(),
            hitosParaCalendarioStream: () => of([]),
          },
        },
        {
          provide: GestoriaService,
          useValue: {
            todosMovimientos: signal([]),
            loadTodosMovimientos: vi.fn(),
            stopTodosMovimientos: vi.fn(),
          },
        },
        { provide: CuentasService, useValue: { cuentas: signal([]), loadCuentas: vi.fn(), stopCuentas: vi.fn() } },
        { provide: EventosService, useValue: { eventosStream: () => of(eventos) } },
        { provide: ActividadService, useValue: { recentStream: () => of([]) } },
      ],
    }).compileComponents();

    component = TestBed.createComponent(DashboardComponent).componentInstance;
    await component.ngOnInit();
  }

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(`${HOY}T10:00:00Z`));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('misSeguimientos', () => {
    it('sólo incluye los compromisos de los que soy responsable', async () => {
      await montar([
        seguimiento({ id: 'mio', responsableId: 'u-yo' }),
        seguimiento({ id: 'ajeno', responsableId: 'u-otro' }),
      ]);

      expect(component.misSeguimientos().map(s => s.id)).toEqual(['mio']);
    });

    it('excluye los eventos normales de calendario', async () => {
      await montar([seguimiento({ id: 'seg' }), evento({ id: 'normal' })]);

      expect(component.misSeguimientos().map(s => s.id)).toEqual(['seg']);
    });

    it('excluye los compromisos ya cerrados', async () => {
      await montar([
        seguimiento({ id: 'abierto' }),
        seguimiento({ id: 'hecho', estado: 'completado' }),
        seguimiento({ id: 'anulado', estado: 'cancelado' }),
      ]);

      expect(component.misSeguimientos().map(s => s.id)).toEqual(['abierto']);
    });

    it('pone los vencidos primero y ordena por fecha dentro de cada grupo', async () => {
      await montar([
        seguimiento({ id: 'futuro-lejano', fecha: '2026-10-10' }),
        seguimiento({ id: 'vencido-viejo', fecha: '2026-09-01' }),
        seguimiento({ id: 'futuro-cercano', fecha: '2026-09-22' }),
        seguimiento({ id: 'vencido-reciente', fecha: '2026-09-19' }),
      ]);

      expect(component.misSeguimientos().map(s => s.id)).toEqual([
        'vencido-viejo', 'vencido-reciente', 'futuro-cercano', 'futuro-lejano',
      ]);
    });

    it('marca cuáles están vencidos', async () => {
      await montar([
        seguimiento({ id: 'tarde', fecha: '2026-09-01' }),
        seguimiento({ id: 'a-tiempo', fecha: '2026-09-30' }),
      ]);

      const porId = new Map(component.misSeguimientos().map(s => [s.id, s]));
      expect(porId.get('tarde')!.vencido).toBe(true);
      expect(porId.get('a-tiempo')!.vencido).toBe(false);
    });

    it('expone el contacto y su enlace para poder actuar', async () => {
      await montar([seguimiento({ id: 's-1' })]);

      const s = component.misSeguimientos()[0];
      expect(s.contactoNombre).toBe('Ana Ruiz');
      expect(s.link).toBe('/contactos/ct-1');
      expect(s.entregable).toBe('Enviar propuesta');
    });
  });

  describe('agendaProxima', () => {
    it('etiqueta el seguimiento como tal y enlaza al contacto, no al calendario', async () => {
      await montar([seguimiento({ id: 'seg', fecha: '2026-09-25' })]);

      const item = component.agendaProxima().find(i => i.id === 'e-seg');
      expect(item?.tipo).toBe('seguimiento');
      expect(item?.link).toBe('/contactos/ct-1');
      expect(item?.subtitulo).toContain('Ana Ruiz');
    });

    it('un evento normal sigue enlazando al calendario', async () => {
      await montar([evento({ id: 'normal', fecha: '2026-09-25' })]);

      const item = component.agendaProxima().find(i => i.id === 'e-normal');
      expect(item?.tipo).toBe('evento');
      expect(item?.link).toBe('/calendario');
    });
  });
});
