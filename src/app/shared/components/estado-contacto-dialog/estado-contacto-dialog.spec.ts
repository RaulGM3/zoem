import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { signal } from '@angular/core';
import { EstadoContactoDialogComponent } from './estado-contacto-dialog';
import { PermissionService } from '../../../core/services/permission.service';
import { UsersService } from '../../../core/services/users';
import { CONTACT_STATUS_OPTIONS, type Contact } from '../../../interfaces/contact.interface';

const CONTACTO = {
  id: 'ct-1',
  companyId: 'c-1',
  type: 'persona_fisica',
  nombre: 'Ana',
  apellidos: 'Ruiz',
  nifType: 'dni',
  email: 'ana@example.com',
  status: 'potencial',
  assignedTo: 'u-abogado',
} as Contact;

const MEMBERS = [
  { id: 'u-abogado', userId: 'u-abogado', nombre: 'Luis', apellido: 'Pérez' },
  { id: 'u-otro', userId: 'u-otro', nombre: 'Marta', apellido: 'Gil' },
];

describe('EstadoContactoDialogComponent', () => {
  let fixture: ComponentFixture<EstadoContactoDialogComponent>;
  let component: EstadoContactoDialogComponent;
  let can: ReturnType<typeof vi.fn>;

  async function montar(inputs: Record<string, unknown> = {}) {
    TestBed.resetTestingModule();
    await TestBed.configureTestingModule({
      imports: [EstadoContactoDialogComponent],
      providers: [
        {
          provide: PermissionService,
          useValue: {
            can,
            currentMember: signal({ userId: 'u-otro', role: 'Usuario' }),
            userRole: signal('Usuario'),
            isSuperUser: signal(false),
          },
        },
        { provide: UsersService, useValue: { members: signal(MEMBERS) } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(EstadoContactoDialogComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('contacto', CONTACTO);
    for (const [k, v] of Object.entries(inputs)) fixture.componentRef.setInput(k, v);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-21T10:00:00Z'));
    can = vi.fn().mockReturnValue(true);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('es un diálogo accesible con focus trap', async () => {
    await montar();

    const dialog: HTMLElement = fixture.nativeElement.querySelector('[role="dialog"]');
    expect(dialog.getAttribute('aria-modal')).toBe('true');
    expect(dialog.hasAttribute('appFocusTrap')).toBe(true);
  });

  it('lista todos los estados como radiogroup y marca el actual', async () => {
    await montar();

    const radios: HTMLElement[] = Array.from(
      fixture.nativeElement.querySelectorAll('[role="radio"]'),
    );
    expect(radios).toHaveLength(CONTACT_STATUS_OPTIONS.length);

    const marcados = radios.filter(r => r.getAttribute('aria-checked') === 'true');
    expect(marcados).toHaveLength(1);
    expect(marcados[0].textContent).toContain('Potencial');
  });

  it('elegir el mismo estado no propone seguimiento: cierra sin emitir', async () => {
    await montar();
    const savedSpy = vi.spyOn(component.saved, 'emit');
    const closedSpy = vi.spyOn(component.closed, 'emit');

    component.elegirEstado('potencial');
    fixture.detectChanges();

    expect(savedSpy).not.toHaveBeenCalled();
    expect(closedSpy).toHaveBeenCalled();
  });

  it('elegir un estado nuevo abre el paso de seguimiento prellenado con la sugerencia', async () => {
    await montar();

    component.elegirEstado('pendiente_presupuesto');
    fixture.detectChanges();

    expect(component.paso()).toBe('seguimiento');
    expect(component.form.value.entregable).toBe('Enviar propuesta de honorarios');
    // 2026-09-21 + 3 días de plazo
    expect(component.form.value.fechaLimite).toBe('2026-09-24');
  });

  it('el responsable por defecto es el encargado del contacto', async () => {
    await montar();

    component.elegirEstado('pendiente_presupuesto');
    fixture.detectChanges();

    expect(component.form.value.responsableId).toBe('u-abogado');
  });

  it('si el contacto no tiene encargado, el responsable por defecto es el usuario actual', async () => {
    await montar({ contacto: { ...CONTACTO, assignedTo: undefined } as Contact });

    component.elegirEstado('pendiente_presupuesto');
    fixture.detectChanges();

    expect(component.form.value.responsableId).toBe('u-otro');
  });

  it('"Guardar y programar" emite el estado junto al compromiso', async () => {
    await montar();
    const savedSpy = vi.spyOn(component.saved, 'emit');

    component.elegirEstado('pendiente_presupuesto');
    component.form.patchValue({ entregable: 'Mandar minuta', fechaLimite: '2026-10-01' });
    component.guardarConSeguimiento();

    expect(savedSpy).toHaveBeenCalledWith({
      status: 'pendiente_presupuesto',
      seguimiento: {
        entregable: 'Mandar minuta',
        fechaLimite: '2026-10-01',
        responsableId: 'u-abogado',
      },
    });
  });

  it('"Omitir" cambia el estado sin crear ningún compromiso', async () => {
    await montar();
    const savedSpy = vi.spyOn(component.saved, 'emit');

    component.elegirEstado('pendiente_presupuesto');
    component.omitir();

    expect(savedSpy).toHaveBeenCalledWith({ status: 'pendiente_presupuesto' });
  });

  it('no permite guardar un compromiso sin entregable', async () => {
    await montar();

    component.elegirEstado('pendiente_presupuesto');
    component.form.patchValue({ entregable: '   ' });
    fixture.detectChanges();

    expect(component.puedeGuardar()).toBe(false);
  });

  it('sin permiso de crear en Calendario se salta el seguimiento y emite sólo el estado', async () => {
    can = vi.fn().mockImplementation((modulo: string) => modulo !== 'Calendario');
    await montar();
    const savedSpy = vi.spyOn(component.saved, 'emit');

    component.elegirEstado('pendiente_presupuesto');
    fixture.detectChanges();

    expect(component.paso()).toBe('estado');
    expect(savedSpy).toHaveBeenCalledWith({ status: 'pendiente_presupuesto' });
  });

  it('en modo soloSeguimiento arranca directamente en el paso del compromiso', async () => {
    await montar({ soloSeguimiento: true });

    expect(component.paso()).toBe('seguimiento');
    expect(fixture.nativeElement.querySelector('[role="radiogroup"]')).toBeNull();
  });

  it('emite closed() al pulsar el botón de cerrar', async () => {
    await montar();
    const closedSpy = vi.spyOn(component.closed, 'emit');

    fixture.nativeElement.querySelector('[aria-label="Cerrar"]').click();

    expect(closedSpy).toHaveBeenCalled();
  });
});
