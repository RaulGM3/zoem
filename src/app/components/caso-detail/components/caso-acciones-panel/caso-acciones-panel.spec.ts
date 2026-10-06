import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { signal } from '@angular/core';
import { provideRouter } from '@angular/router';
import { CasoAccionesPanelComponent } from './caso-acciones-panel';
import { AccionesService } from '../../../../core/services/acciones.service';
import { AccionRegistrosService } from '../../../../core/services/accion-registros.service';
import { UsersService } from '../../../../core/services/users';
import type { Accion, AccionRegistro } from '../../../../interfaces/accion.interface';
import type { Contact } from '../../../../interfaces';

const ts = (iso: string) => ({ toDate: () => new Date(iso) }) as AccionRegistro['createdAt'];
const accion = (id: string, nombre: string): Accion =>
  ({ id, nombre, ambito: 'caso', asunto: '', cuerpo: '', canales: ['gmail'], activa: true }) as unknown as Accion;
const ACCIONES = [accion('a1', 'Enviar presupuesto'), accion('a2', 'Recordatorio de pago')];
const REG: AccionRegistro[] = [
  { id: 'r1', companyId: 'c', accionId: 'a1', accionNombre: 'Enviar presupuesto', contactoIds: ['k1', 'k2'], casoId: 'cs1', canal: 'gmail', createdBy: 'u1', createdAt: ts('2026-10-01T10:00:00Z') },
  { id: 'r2', companyId: 'c', accionId: 'a1', accionNombre: 'Enviar presupuesto', contactoIds: ['k1'], casoId: 'cs1', canal: 'whatsapp', createdBy: 'u1', createdAt: ts('2026-09-20T10:00:00Z') },
];
const contacto = (id: string, nombre: string) =>
  ({ id, type: 'persona_fisica', nombre, apellidos: 'López' }) as unknown as Contact;

describe('CasoAccionesPanelComponent', () => {
  let fixture: ComponentFixture<CasoAccionesPanelComponent>;
  let listarPorAmbito: ReturnType<typeof vi.fn>;
  let listarPorCaso: ReturnType<typeof vi.fn>;
  const el = () => fixture.nativeElement as HTMLElement;
  const botones = () => Array.from(el().querySelectorAll<HTMLButtonElement>('[data-testid="accion-boton"]'));

  async function flush() {
    fixture.detectChanges();
    await fixture.whenStable();
    for (let i = 0; i < 5; i++) await Promise.resolve();
    fixture.detectChanges();
  }

  async function montar(inputs: Record<string, unknown> = {}) {
    TestBed.resetTestingModule();
    await TestBed.configureTestingModule({
      imports: [CasoAccionesPanelComponent],
      providers: [
        provideRouter([]),
        { provide: AccionesService, useValue: { listarPorAmbito } },
        { provide: AccionRegistrosService, useValue: { listarPorCaso, listarPorContacto: vi.fn() } },
        { provide: UsersService, useValue: { members: signal([{ userId: 'u1', nombre: 'Luis' }]) } },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(CasoAccionesPanelComponent);
    fixture.componentRef.setInput('casoId', 'cs1');
    fixture.componentRef.setInput('contactos', [contacto('k1', 'Víctor')]);
    for (const [k, v] of Object.entries(inputs)) fixture.componentRef.setInput(k, v);
    await flush();
  }

  beforeEach(() => {
    listarPorAmbito = vi.fn().mockResolvedValue(ACCIONES);
    listarPorCaso = vi.fn().mockResolvedValue(REG);
  });

  it('carga las acciones de caso y el log del caso', async () => {
    await montar();
    expect(listarPorAmbito).toHaveBeenCalledWith('caso');
    expect(listarPorCaso).toHaveBeenCalledWith('cs1');
  });

  it('un botón por acción con su estado de envío y contador', async () => {
    await montar();
    const [b1, b2] = botones();
    expect(botones()).toHaveLength(2);
    expect(b1.textContent).toContain('Enviar presupuesto');
    expect(b1.textContent).toContain('Enviada');
    expect(b1.textContent).toContain('2 veces');
    expect(b1.textContent).toContain('01/10/2026');
    expect(b2.textContent).toContain('Recordatorio de pago');
    expect(b2.textContent).toContain('Sin enviar');
  });

  it('cada acción tiene su color', async () => {
    await montar();
    const [b1, b2] = botones();
    expect(b1.style.getPropertyValue('--accion-color')).not.toBe('');
    expect(b1.style.getPropertyValue('--accion-color')).not.toBe(b2.style.getPropertyValue('--accion-color'));
  });

  it('con varios clientes desglosa los envíos por cliente', async () => {
    await montar({ contactos: [contacto('k1', 'Víctor'), contacto('k2', 'Ana')] });
    const desglose = botones()[0].querySelectorAll('[data-testid="por-cliente"]');
    expect(desglose).toHaveLength(2);
    expect(desglose[0].textContent).toContain('Víctor');
    expect(desglose[0].textContent).toContain('2');
    expect(desglose[1].textContent).toContain('Ana');
    expect(desglose[1].textContent).toContain('1');
  });

  it('click emite la acción a ejecutar', async () => {
    await montar();
    const spy = vi.fn();
    fixture.componentInstance.ejecutar.subscribe(spy);
    botones()[1].click();
    expect(spy).toHaveBeenCalledWith(ACCIONES[1]);
  });

  it('sin permiso de edición los botones quedan deshabilitados', async () => {
    await montar({ canEdit: false });
    expect(botones().every((b) => b.disabled)).toBe(true);
  });

  it('al cambiar `recarga` vuelve a pedir el log', async () => {
    await montar();
    fixture.componentRef.setInput('recarga', 1);
    await flush();
    expect(listarPorCaso).toHaveBeenCalledTimes(2);
    expect(listarPorAmbito).toHaveBeenCalledTimes(1);
  });

  it('muestra el log de comunicaciones debajo sin consultar dos veces', async () => {
    await montar();
    expect(el().querySelector('app-comunicaciones-enviadas')?.textContent).toContain('Enviar presupuesto');
    expect(listarPorCaso).toHaveBeenCalledTimes(1);
  });

  it('estado vacío si no hay acciones de caso', async () => {
    listarPorAmbito.mockResolvedValue([]);
    await montar();
    expect(botones()).toHaveLength(0);
    expect(el().textContent).toContain('No hay acciones disponibles');
  });
});
