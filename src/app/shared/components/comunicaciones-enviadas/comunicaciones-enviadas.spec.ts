import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { signal } from '@angular/core';
import { ComunicacionesEnviadasComponent } from './comunicaciones-enviadas';
import { AccionRegistrosService } from '../../../core/services/accion-registros.service';
import { UsersService } from '../../../core/services/users';
import type { AccionRegistro } from '../../../interfaces/accion.interface';

const ts = (iso: string) => ({ toDate: () => new Date(iso) }) as AccionRegistro['createdAt'];
const REG: AccionRegistro[] = [
  { id: 'r1', companyId: 'c', accionId: 'a1', accionNombre: 'Enviar presupuesto', contactoIds: ['k1'], canal: 'gmail', docPath: 'p.docx', createdBy: 'u1', createdAt: ts('2026-10-01T10:00:00Z') },
  { id: 'r2', companyId: 'c', accionId: 'a2', accionNombre: 'Aviso', contactoIds: ['k1'], canal: 'whatsapp', createdBy: 'u9', createdAt: ts('2026-09-20T10:00:00Z') },
];

describe('ComunicacionesEnviadasComponent', () => {
  let fixture: ComponentFixture<ComunicacionesEnviadasComponent>;
  let listarPorContacto: ReturnType<typeof vi.fn>;
  let listarPorCaso: ReturnType<typeof vi.fn>;
  const el = () => fixture.nativeElement as HTMLElement;

  async function montar(inputs: Record<string, unknown>) {
    TestBed.resetTestingModule();
    await TestBed.configureTestingModule({
      imports: [ComunicacionesEnviadasComponent],
      providers: [
        { provide: AccionRegistrosService, useValue: { listarPorContacto, listarPorCaso } },
        { provide: UsersService, useValue: { members: signal([{ userId: 'u1', nombre: 'Luis', apellido: 'Pérez' }]) } },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(ComunicacionesEnviadasComponent);
    for (const [k, v] of Object.entries(inputs)) fixture.componentRef.setInput(k, v);
    fixture.detectChanges();
    await fixture.whenStable();
    for (let i = 0; i < 5; i++) await Promise.resolve();
    fixture.detectChanges();
  }

  beforeEach(() => {
    listarPorContacto = vi.fn().mockResolvedValue(REG);
    listarPorCaso = vi.fn().mockResolvedValue(REG);
  });

  it('por contacto: lista acción, canal, autor y documento', async () => {
    await montar({ contactoId: 'k1' });
    expect(listarPorContacto).toHaveBeenCalledWith('k1');
    const txt = el().textContent ?? '';
    expect(txt).toContain('Enviar presupuesto');
    expect(txt).toContain('Gmail');
    expect(txt).toContain('Luis Pérez');
    expect(txt).toContain('01/10/2026');
    expect(el().querySelectorAll('[data-testid="con-documento"]')).toHaveLength(1);
    expect(txt).toContain('Desconocido');
  });

  it('por caso usa listarPorCaso', async () => {
    await montar({ casoId: 'cs1' });
    expect(listarPorCaso).toHaveBeenCalledWith('cs1');
  });

  it('estado vacío', async () => {
    listarPorContacto.mockResolvedValue([]);
    await montar({ contactoId: 'k1' });
    expect(el().textContent).toContain('Todavía no se ha enviado ninguna acción');
  });

  it('error de carga inline sin romper', async () => {
    listarPorContacto.mockRejectedValue(new Error('x'));
    await montar({ contactoId: 'k1' });
    expect(el().querySelector('[role="alert"]')).not.toBeNull();
  });

  it('con registros externos los pinta sin consultar', async () => {
    await montar({ casoId: 'cs1', registros: [REG[1]] });
    expect(listarPorCaso).not.toHaveBeenCalled();
    expect(listarPorContacto).not.toHaveBeenCalled();
    const txt = el().textContent ?? '';
    expect(txt).toContain('Aviso');
    expect(txt).not.toContain('Enviar presupuesto');
  });

  it('con registros externos refleja el estado de carga del padre', async () => {
    await montar({ registros: [], cargando: true });
    expect(el().querySelector('[role="status"]')?.textContent).toContain('Cargando');
    fixture.componentRef.setInput('cargando', false);
    fixture.detectChanges();
    expect(el().textContent).toContain('Todavía no se ha enviado ninguna acción');
  });

  it('usa una lista semántica con título', async () => {
    await montar({ contactoId: 'k1' });
    expect(el().querySelector('section[aria-labelledby]')).not.toBeNull();
    expect(el().querySelector('ul')).not.toBeNull();
  });

  it('es un bloque para que respete el espaciado vertical del padre', async () => {
    await montar({ contactoId: 'k1' });
    expect(el().classList).toContain('block');
  });

  it('se titula como lo que es: el historial de acciones enviadas', async () => {
    await montar({ contactoId: 'k1' });
    expect(el().querySelector('h2')?.textContent?.trim()).toBe('Acciones enviadas');
    expect(el().textContent).toContain('Mensajes y documentos enviados desde Acciones');
  });

  it('sin puedeLanzar no ofrece lanzar una acción', async () => {
    await montar({ contactoId: 'k1' });
    expect(el().querySelector('[data-testid="lanzar-accion"]')).toBeNull();
  });

  it('con puedeLanzar ofrece lanzar una acción y emite lanzar', async () => {
    await montar({ contactoId: 'k1', puedeLanzar: true });
    const lanzar = vi.fn();
    fixture.componentInstance.lanzar.subscribe(lanzar);
    const btn = el().querySelector<HTMLButtonElement>('[data-testid="lanzar-accion"]');
    expect(btn?.textContent?.trim()).toBe('Lanzar acción');
    btn!.click();
    expect(lanzar).toHaveBeenCalledOnce();
  });
});
