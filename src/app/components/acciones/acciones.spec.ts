import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { signal } from '@angular/core';
import { AccionesComponent } from './acciones';
import { AccionesService } from '../../core/services/acciones.service';
import { DocTemplateService } from '../../core/services/doc-template.service';
import { PermissionService } from '../../core/services/permission.service';
import { ToastService } from '../../core/services/toast.service';
import type { Accion } from '../../interfaces/accion.interface';
import type { DocTemplate } from '../../interfaces/doc-template.interface';

const A = (over: Partial<Accion>): Accion =>
  ({ id: 'a1', nombre: 'Enviar presupuesto', ambito: 'contacto', asunto: 'S', cuerpo: 'C', canales: ['gmail', 'whatsapp'], activa: true, ...over }) as Accion;

describe('AccionesComponent', () => {
  let fixture: ComponentFixture<AccionesComponent>;
  let component: AccionesComponent;
  let acciones: ReturnType<typeof signal<Accion[]>>;
  let svc: Record<string, ReturnType<typeof vi.fn>>;
  let can: ReturnType<typeof vi.fn>;
  const el = () => fixture.nativeElement as HTMLElement;

  async function montar() {
    TestBed.resetTestingModule();
    acciones = signal([A({}), A({ id: 'a2', nombre: 'Aviso hito', ambito: 'caso', activa: false, docTemplateId: 't1' })]);
    svc = {
      cargar: vi.fn().mockResolvedValue(undefined),
      crear: vi.fn().mockResolvedValue('new'),
      actualizar: vi.fn().mockResolvedValue(undefined),
      eliminar: vi.fn().mockResolvedValue(undefined),
    };
    await TestBed.configureTestingModule({
      imports: [AccionesComponent],
      providers: [
        { provide: AccionesService, useValue: { ...svc, acciones, loading: signal(false) } },
        {
          provide: DocTemplateService,
          useValue: {
            loadTemplates: vi.fn().mockResolvedValue(undefined),
            templates: signal([
              { id: 't1', name: 'Hoja', status: 'listo' },
              { id: 't2', name: 'Borrador', status: 'revision' },
            ] as DocTemplate[]),
          },
        },
        { provide: PermissionService, useValue: { can } },
        { provide: ToastService, useValue: { run: async (fn: () => Promise<unknown>, o?: { onSuccess?: () => void }) => { const r = await fn(); o?.onSuccess?.(); return r; } } },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(AccionesComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  beforeEach(async () => {
    can = vi.fn().mockReturnValue(true);
    await montar();
  });

  it('carga el catálogo y las plantillas al iniciar', () => {
    expect(svc['cargar']).toHaveBeenCalled();
  });

  it('lista nombre, ámbito, canales y documento', () => {
    const txt = el().textContent ?? '';
    expect(txt).toContain('Enviar presupuesto');
    expect(txt).toContain('Aviso hito');
    expect(txt).toContain('Contacto');
    expect(txt).toContain('Caso');
    expect(txt).toContain('Gmail');
    expect(txt).toContain('WhatsApp');
    expect(txt).toContain('Hoja');
  });

  it('el interruptor activa actualiza la acción', async () => {
    const sw = el().querySelectorAll<HTMLButtonElement>('[role="switch"]')[1];
    expect(sw.getAttribute('aria-checked')).toBe('false');
    sw.click();
    await fixture.whenStable();
    expect(svc['actualizar']).toHaveBeenCalledWith('a2', { activa: true });
  });

  it('"Nueva acción" abre el drawer y guarda con crear()', async () => {
    el().querySelector<HTMLButtonElement>('[data-testid="nueva-accion"]')!.click();
    fixture.detectChanges();
    expect(el().querySelector('app-accion-form-drawer')).not.toBeNull();
    await component.onGuardar({ nombre: 'N', ambito: 'contacto', asunto: 'A', cuerpo: 'B', canales: ['mail'], activa: true });
    expect(svc['crear']).toHaveBeenCalled();
    fixture.detectChanges();
    expect(el().querySelector('app-accion-form-drawer')).toBeNull();
  });

  it('editar usa actualizar() con el id', async () => {
    component.editar(acciones()[0]);
    await component.onGuardar({ nombre: 'Nuevo', ambito: 'contacto', asunto: 'A', cuerpo: 'B', canales: ['mail'], activa: true });
    expect(svc['actualizar']).toHaveBeenCalledWith('a1', expect.objectContaining({ nombre: 'Nuevo' }));
  });

  it('eliminar pide confirmación inline antes de borrar', async () => {
    el().querySelector<HTMLButtonElement>('[data-testid="eliminar-a1"]')!.click();
    fixture.detectChanges();
    expect(svc['eliminar']).not.toHaveBeenCalled();
    el().querySelector<HTMLButtonElement>('[data-testid="confirmar-eliminar-a1"]')!.click();
    await fixture.whenStable();
    expect(svc['eliminar']).toHaveBeenCalledWith('a1');
  });

  it('sin permiso de edición de Configuración no hay controles de gestión', async () => {
    can = vi.fn().mockReturnValue(false);
    await montar();
    expect(el().querySelector('[data-testid="nueva-accion"]')).toBeNull();
    expect(el().querySelector('[role="switch"]')).toBeNull();
    expect(el().querySelector('[data-testid="eliminar-a1"]')).toBeNull();
    expect(el().textContent).toContain('Enviar presupuesto');
  });

  it('estado vacío con mensaje', async () => {
    acciones.set([]);
    fixture.detectChanges();
    expect(el().textContent).toContain('Aún no hay acciones');
  });
});
