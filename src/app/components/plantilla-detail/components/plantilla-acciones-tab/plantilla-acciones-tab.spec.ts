import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { signal } from '@angular/core';
import { PlantillaAccionesTabComponent } from './plantilla-acciones-tab';
import { AccionesService } from '../../../../core/services/acciones.service';
import { DocTemplateService } from '../../../../core/services/doc-template.service';
import { PermissionService } from '../../../../core/services/permission.service';
import { ToastService } from '../../../../core/services/toast.service';
import type { Accion } from '../../../../interfaces/accion.interface';
import type { HitoPlantilla } from '../../../../interfaces/plantilla.interface';
import type { DocTemplate } from '../../../../interfaces/doc-template.interface';

const HITOS: HitoPlantilla[] = [
  { id: 'h1', titulo: 'Demanda presentada', orden: 0, diasDesdeInicio: 0 },
  { id: 'h2', titulo: 'Sentencia', orden: 1, diasDesdeInicio: 30 },
];
const ACCION = { id: 'a1', nombre: 'Avisar demanda', ambito: 'caso', asunto: 'S', cuerpo: 'C', canales: ['gmail'], activa: true, plantillaId: 'p1', hitoPlantillaId: 'h1' } as Accion;

describe('PlantillaAccionesTabComponent', () => {
  let fixture: ComponentFixture<PlantillaAccionesTabComponent>;
  let component: PlantillaAccionesTabComponent;
  let svc: Record<string, ReturnType<typeof vi.fn>>;
  const el = () => fixture.nativeElement as HTMLElement;

  beforeEach(async () => {
    TestBed.resetTestingModule();
    svc = {
      listarPorPlantilla: vi.fn().mockResolvedValue([ACCION]),
      crear: vi.fn().mockResolvedValue('n'),
      actualizar: vi.fn().mockResolvedValue(undefined),
      eliminar: vi.fn().mockResolvedValue(undefined),
    };
    await TestBed.configureTestingModule({
      imports: [PlantillaAccionesTabComponent],
      providers: [
        { provide: AccionesService, useValue: svc },
        { provide: DocTemplateService, useValue: { templates: signal([{ id: 't1', name: 'Hoja', status: 'listo' }] as DocTemplate[]) } },
        { provide: PermissionService, useValue: { can: () => true } },
        { provide: ToastService, useValue: { run: async (fn: () => Promise<unknown>, o?: { onSuccess?: () => void }) => { const r = await fn(); o?.onSuccess?.(); return r; } } },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(PlantillaAccionesTabComponent);
    fixture.componentRef.setInput('plantillaId', 'p1');
    fixture.componentRef.setInput('hitos', HITOS);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
    for (let i = 0; i < 5; i++) await Promise.resolve();
    fixture.detectChanges();
  });

  it('lista las acciones de la plantilla con el hito asociado', () => {
    expect(svc['listarPorPlantilla']).toHaveBeenCalledWith('p1');
    expect(el().textContent).toContain('Avisar demanda');
    expect(el().textContent).toContain('Demanda presentada');
  });

  it('crea con ámbito caso, plantillaId y hito elegido', async () => {
    el().querySelector<HTMLButtonElement>('[data-testid="nueva-accion"]')!.click();
    fixture.detectChanges();
    expect(el().querySelector('app-accion-form-drawer')).not.toBeNull();
    expect(el().querySelector('#af-ambito')).toBeNull();
    expect(el().querySelector('#af-hito')).not.toBeNull();
    await component.onGuardar({ nombre: 'N', ambito: 'caso', asunto: 'A', cuerpo: 'B', canales: ['mail'], activa: true, plantillaId: 'p1', hitoPlantillaId: 'h2' });
    expect(svc['crear']).toHaveBeenCalledWith(expect.objectContaining({ plantillaId: 'p1', hitoPlantillaId: 'h2', ambito: 'caso' }));
    expect(svc['listarPorPlantilla']).toHaveBeenCalledTimes(2);
  });

  it('edita y elimina con confirmación', async () => {
    component.editar(ACCION);
    await component.onGuardar({ nombre: 'X', ambito: 'caso', asunto: 'A', cuerpo: 'B', canales: ['mail'], activa: true, plantillaId: 'p1' });
    expect(svc['actualizar']).toHaveBeenCalledWith('a1', expect.objectContaining({ nombre: 'X' }));
    el().querySelector<HTMLButtonElement>('[data-testid="eliminar-a1"]')!.click();
    fixture.detectChanges();
    expect(svc['eliminar']).not.toHaveBeenCalled();
    el().querySelector<HTMLButtonElement>('[data-testid="confirmar-eliminar-a1"]')!.click();
    await fixture.whenStable();
    expect(svc['eliminar']).toHaveBeenCalledWith('a1');
  });
});
