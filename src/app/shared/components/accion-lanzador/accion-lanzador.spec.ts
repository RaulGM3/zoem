import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { signal } from '@angular/core';
import { provideRouter } from '@angular/router';
import { AccionLanzadorComponent } from './accion-lanzador';
import { AccionesService } from '../../../core/services/acciones.service';
import { PermissionService } from '../../../core/services/permission.service';
import { AccionEjecucionService } from '../../../core/services/accion-ejecucion.service';
import { DocTemplateService } from '../../../core/services/doc-template.service';
import { CompanyService } from '../../../core/services/company.service';
import { AccionRedaccionService } from '../../../core/services/accion-redaccion.service';
import type { Accion } from '../../../interfaces/accion.interface';
import type { Contact } from '../../../interfaces/contact.interface';

const ana = { id: 'k1', type: 'persona_fisica', nombre: 'Ana', apellidos: 'Ruiz', email: 'ana@x.com', mobile: '' } as Contact;
const A = (id: string): Accion => ({ id, nombre: 'Acc ' + id, ambito: 'contacto', asunto: 'S', cuerpo: 'C', canales: ['gmail'], activa: true }) as Accion;

describe('AccionLanzadorComponent', () => {
  let fixture: ComponentFixture<AccionLanzadorComponent>;
  let listarPorAmbito: ReturnType<typeof vi.fn>;
  const el = () => fixture.nativeElement as HTMLElement;
  const flush = async () => { fixture.detectChanges(); await fixture.whenStable(); for (let i = 0; i < 5; i++) await Promise.resolve(); fixture.detectChanges(); };

  async function montar(inputs: Record<string, unknown> = {}) {
    TestBed.resetTestingModule();
    await TestBed.configureTestingModule({
      imports: [AccionLanzadorComponent],
      providers: [
        provideRouter([]),
        { provide: AccionesService, useValue: { listarPorAmbito } },
        { provide: PermissionService, useValue: { can: () => true } },
        { provide: AccionRedaccionService, useValue: { redactar: vi.fn() } },
        { provide: AccionEjecucionService, useValue: { preparar: vi.fn(), abrir: vi.fn() } },
        { provide: DocTemplateService, useValue: { getTemplate: vi.fn() } },
        { provide: CompanyService, useValue: { activeCompany: signal({ id: 'c', name: 'D' }) } },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(AccionLanzadorComponent);
    fixture.componentRef.setInput('ambito', 'contacto');
    fixture.componentRef.setInput('contactos', [ana]);
    for (const [k, v] of Object.entries(inputs)) fixture.componentRef.setInput(k, v);
    await flush();
  }

  beforeEach(() => {
    listarPorAmbito = vi.fn().mockResolvedValue([A('a1'), A('a2')]);
  });

  it('carga las acciones del ámbito y muestra el selector', async () => {
    await montar();
    expect(listarPorAmbito).toHaveBeenCalledWith('contacto');
    expect(el().querySelector('app-accion-selector')).not.toBeNull();
    expect(el().querySelector('app-accion-ejecutar')).toBeNull();
  });

  it('al elegir una acción abre el modal de ejecución', async () => {
    await montar();
    el().querySelector<HTMLButtonElement>('[data-testid="opcion-accion"]')!.click();
    await flush();
    expect(el().querySelector('app-accion-ejecutar')).not.toBeNull();
    expect(el().querySelector('app-accion-selector')).toBeNull();
  });

  it('con una acción preseleccionada salta el selector', async () => {
    await montar({ accion: A('a1') });
    expect(listarPorAmbito).not.toHaveBeenCalled();
    expect(el().querySelector('app-accion-ejecutar')).not.toBeNull();
  });

  it('con una lista de acciones sugeridas (varias) muestra el selector filtrado sin consultar', async () => {
    await montar({ sugeridas: [A('a1'), A('a2')] });
    expect(listarPorAmbito).not.toHaveBeenCalled();
    expect(el().querySelectorAll('[data-testid="opcion-accion"]')).toHaveLength(2);
  });

  it('si falla la carga muestra el selector vacío y no revienta', async () => {
    listarPorAmbito.mockRejectedValue(new Error('x'));
    await montar();
    expect(el().querySelector('app-accion-selector')).not.toBeNull();
    expect(el().querySelectorAll('[data-testid="opcion-accion"]')).toHaveLength(0);
  });

  it('closed se emite al cerrar el selector', async () => {
    await montar();
    const spy = vi.fn();
    fixture.componentInstance.closed.subscribe(spy);
    el().querySelector<HTMLButtonElement>('[aria-label="Cerrar"]')!.click();
    expect(spy).toHaveBeenCalled();
  });
});
