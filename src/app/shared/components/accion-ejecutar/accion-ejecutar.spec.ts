import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { signal } from '@angular/core';
import { By } from '@angular/platform-browser';
import { AccionEjecutarComponent } from './accion-ejecutar';
import { RedactorIaComponent } from '../redactor-ia/redactor-ia';
import { AccionRedaccionService } from '../../../core/services/accion-redaccion.service';
import { AccionEjecucionService } from '../../../core/services/accion-ejecucion.service';
import { DocTemplateService } from '../../../core/services/doc-template.service';
import { CompanyService } from '../../../core/services/company.service';
import { BloqueoPlanService } from '../../../core/planes/bloqueo-plan.service';
import { MejoraPlanService } from '../../../core/planes/mejora-plan.service';
import { PlanService } from '../../../core/planes/plan.service';
import { UsoService } from '../../../core/planes/uso.service';
import type { Accion } from '../../../interfaces/accion.interface';
import type { Contact } from '../../../interfaces/contact.interface';
import type { Caso, Hito } from '../../../interfaces/caso.interface';

const ana = { id: 'k1', type: 'persona_fisica', nombre: 'Ana', apellidos: 'Ruiz', email: 'ana@x.com', mobile: '612345678' } as Contact;
const luis = { id: 'k2', type: 'persona_fisica', nombre: 'Luis', apellidos: 'Gil', email: 'luis@x.com', mobile: '' } as Contact;
const CASO = { id: 'cs1', titulo: 'Divorcio', tipo: 'Civil', descripcion: '', vencimiento: '' } as Caso;
const HITOS = [
  { id: 'h1', titulo: 'Demanda', orden: 0, estado: 'completado' },
  { id: 'h2', titulo: 'Vista', orden: 1, estado: 'pendiente' },
] as Hito[];

const accion = (over: Partial<Accion> = {}): Accion =>
  ({
    id: 'a1', nombre: 'Aviso', ambito: 'caso', asunto: 'Novedad: {{hito}}',
    cuerpo: 'Hola {{cliente}}, hito {{hito}} de {{empresa}}', canales: ['gmail', 'whatsapp'], activa: true, ...over,
  }) as Accion;

describe('AccionEjecutarComponent', () => {
  let fixture: ComponentFixture<AccionEjecutarComponent>;
  let component: AccionEjecutarComponent;
  let preparar: ReturnType<typeof vi.fn>;
  let abrir: ReturnType<typeof vi.fn>;
  let getTemplate: ReturnType<typeof vi.fn>;
  let writeText: ReturnType<typeof vi.fn>;
  let abrirMejora: ReturnType<typeof vi.fn>;
  let manejar: ReturnType<typeof vi.fn>;
  let cupo: { usado: number; limite: number };
  const el = () => fixture.nativeElement as HTMLElement;
  const q = <T extends HTMLElement>(sel: string) => el().querySelector<T>(sel)!;
  const flush = async () => {
    fixture.detectChanges();
    await fixture.whenStable();
    for (let i = 0; i < 5; i++) await Promise.resolve();
    fixture.detectChanges();
  };

  async function montar(inputs: Record<string, unknown> = {}, empresa: Record<string, unknown> = {}) {
    TestBed.resetTestingModule();
    await TestBed.configureTestingModule({
      imports: [AccionEjecutarComponent],
      providers: [
        { provide: AccionEjecucionService, useValue: { preparar, abrir } },
        { provide: DocTemplateService, useValue: { getTemplate } },
        { provide: AccionRedaccionService, useValue: { redactar: vi.fn() } },
        { provide: CompanyService, useValue: { activeCompany: signal({ id: 'c1', name: 'Despacho Pérez', ...empresa }) } },
        { provide: PlanService, useValue: { limite: () => cupo.limite } },
        { provide: UsoService, useValue: { usado: () => cupo.usado } },
        { provide: MejoraPlanService, useValue: { abrir: vi.fn() } },
        { provide: BloqueoPlanService, useValue: { abrirCupo: abrirMejora, manejar } },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(AccionEjecutarComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('accion', accion());
    fixture.componentRef.setInput('contactos', [ana, luis]);
    fixture.componentRef.setInput('caso', CASO);
    fixture.componentRef.setInput('hitos', HITOS);
    for (const [k, v] of Object.entries(inputs)) fixture.componentRef.setInput(k, v);
    await flush();
  }

  beforeEach(async () => {
    abrirMejora = vi.fn();
    manejar = vi.fn(() => false);
    cupo = { usado: 2, limite: 15 };
    preparar = vi.fn().mockResolvedValue({
      registroId: 'r1', url: 'https://mail.google.com/x', cuerpoFinal: 'Cuerpo final', excedeLimite: false,
    });
    abrir = vi.fn().mockReturnValue(true);
    getTemplate = vi.fn().mockResolvedValue({
      id: 't1', name: 'Hoja',
      variables: [
        { key: 'cliente', label: 'Cliente', type: 'text', required: true },
        { key: 'importe', label: 'Importe', type: 'currency', required: true },
        { key: 'nota', label: 'Nota', type: 'text', required: false },
      ],
    });
    writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    await montar();
  });

  describe('cupo mensual de acciones', () => {
    it('muestra el medidor del mes', () => {
      expect(q('app-cupo').textContent).toContain('2/15 acciones este mes');
    });

    it('con el cupo agotado, "Preparar" abre el aviso de mejora y no prepara nada', async () => {
      cupo = { usado: 15, limite: 15 };
      await montar();
      await component.preparar();
      expect(abrirMejora).toHaveBeenCalledTimes(1);
      expect(preparar).not.toHaveBeenCalled();
      expect(component.fase()).toBe('editando');
    });

    it('con cupo disponible prepara con normalidad', async () => {
      await component.preparar();
      expect(abrirMejora).not.toHaveBeenCalled();
      expect(preparar).toHaveBeenCalledTimes(1);
    });
  });

  it('es un diálogo modal accesible con región de estado aria-live', () => {
    const d = q('[role="dialog"]');
    expect(d.getAttribute('aria-modal')).toBe('true');
    expect(d.getAttribute('aria-labelledby')).toBeTruthy();
    expect(d.hasAttribute('appFocusTrap')).toBe(true);
    expect(q('[role="status"]').getAttribute('aria-live')).toBe('polite');
  });

  it('prerrellena asunto y cuerpo con contactos, hito sugerido y empresa', () => {
    const v = component.form.getRawValue();
    expect(v.asunto).toBe('Novedad: Demanda');
    expect(v.cuerpo).toBe('Hola Ana Ruiz, Luis Gil, hito Demanda de Despacho Pérez');
  });

  it('usa el hito preseleccionado', async () => {
    await montar({ hitoId: 'h2' });
    expect(component.form.getRawValue().asunto).toBe('Novedad: Vista');
  });

  it('al cambiar el hito se rellena de nuevo, salvo que el usuario haya editado el campo', () => {
    component.seleccionarHito('h2');
    fixture.detectChanges();
    expect(component.form.getRawValue().asunto).toBe('Novedad: Vista');

    component.form.controls.cuerpo.setValue('Texto mío');
    component.form.controls.cuerpo.markAsDirty();
    component.seleccionarHito('h1');
    fixture.detectChanges();
    expect(component.form.getRawValue().asunto).toBe('Novedad: Demanda');
    expect(component.form.getRawValue().cuerpo).toBe('Texto mío');
  });

  it('al desmarcar destinatarios se rellena con los restantes y WhatsApp indica el motivo', async () => {
    // Dos destinatarios: WhatsApp deshabilitado
    const wa = q<HTMLInputElement>('input[type="radio"][value="whatsapp"]');
    expect(wa.disabled).toBe(true);
    expect(el().textContent).toContain('solo permite enviar a uno');

    component.alternarContacto('k2');
    await flush();
    expect(component.form.getRawValue().cuerpo).toContain('Hola Ana Ruiz,');
    expect(q<HTMLInputElement>('input[type="radio"][value="whatsapp"]').disabled).toBe(false);
  });

  it('con ámbito contacto los destinatarios son fijos (sin checkboxes)', async () => {
    await montar({ accion: accion({ ambito: 'contacto' }), contactos: [ana], caso: null, hitos: [] });
    expect(el().querySelector('[data-testid="destinatarios"] input[type="checkbox"]')).toBeNull();
    expect(el().textContent).toContain('Ana Ruiz');
    expect(el().querySelector('select#ae-hito')).toBeNull();
  });

  it('Preparar llama al servicio con asunto, cuerpo, canal, destinatarios, caso y hito', async () => {
    await component.preparar();
    await flush();
    expect(preparar).toHaveBeenCalledWith({
      accion: expect.objectContaining({ id: 'a1' }),
      contactos: [ana, luis],
      canal: 'gmail',
      asunto: 'Novedad: Demanda',
      cuerpo: 'Hola Ana Ruiz, Luis Gil, hito Demanda de Despacho Pérez',
      casoId: 'cs1',
      hitoId: 'h1',
    });
  });

  it('Preparar NO abre la app; el botón "Abrir en Gmail" la abre en el click (síncrono)', async () => {
    await component.preparar();
    await flush();
    expect(abrir).not.toHaveBeenCalled();
    const btn = q<HTMLButtonElement>('[data-testid="abrir"]');
    expect(btn.textContent).toContain('Abrir en Gmail');
    btn.click();
    expect(abrir).toHaveBeenCalledWith('https://mail.google.com/x', 'gmail');
  });

  it('si el navegador bloquea la apertura muestra el enlace y "Copiar texto"', async () => {
    abrir.mockReturnValue(false);
    await component.preparar();
    await flush();
    q<HTMLButtonElement>('[data-testid="abrir"]').click();
    fixture.detectChanges();
    const link = q<HTMLAnchorElement>('[data-testid="enlace-respaldo"]');
    expect(link.getAttribute('href')).toBe('https://mail.google.com/x');
    q<HTMLButtonElement>('[data-testid="copiar"]').click();
    await flush();
    expect(writeText).toHaveBeenCalledWith('Cuerpo final');
    expect(q('[role="status"]').textContent).toContain('copiado');
  });

  it('avisa si la URL excede el límite', async () => {
    preparar.mockResolvedValue({ registroId: 'r', url: 'https://x', cuerpoFinal: 'c', excedeLimite: true });
    await component.preparar();
    await flush();
    expect(el().textContent).toContain('demasiado largo');
  });

  it('si preparar falla por el plan (cupo/demo terminada), abre la mejora con la causa y NO enseña el alert de error', async () => {
    manejar.mockReturnValue(true);
    preparar.mockRejectedValue(Object.assign(new Error('x'), { code: 'permission-denied' }));
    await component.preparar();
    await flush();
    expect(manejar).toHaveBeenCalledWith(expect.objectContaining({ code: 'permission-denied' }), { limite: 'accionesMes' });
    expect(el().querySelector('[role="alert"]')).toBeNull();
    expect(component.fase()).toBe('editando');
  });

  it('muestra el error de preparar en un alert y permite reintentar', async () => {
    preparar.mockRejectedValue(new Error('permission-denied'));
    await component.preparar();
    await flush();
    expect(q('[role="alert"]').textContent).toContain('No se pudo preparar');
    expect(el().querySelector('[data-testid="abrir"]')).toBeNull();
    expect(q<HTMLButtonElement>('[data-testid="preparar"]').disabled).toBe(false);
  });

  it('muestra "Preparando…" mientras espera', async () => {
    let resolver!: (v: unknown) => void;
    preparar.mockReturnValue(new Promise((r) => (resolver = r)));
    const p = component.preparar();
    fixture.detectChanges();
    expect(q('[role="status"]').textContent).toContain('Preparando');
    expect(q<HTMLButtonElement>('[data-testid="preparar"]').disabled).toBe(true);
    resolver({ registroId: 'r', url: 'u', cuerpoFinal: 'c', excedeLimite: false });
    await p;
  });

  describe('con documento', () => {
    beforeEach(async () => {
      await montar({ accion: accion({ docTemplateId: 't1' }) });
    });

    it('lista las variables de la plantilla, prerrellenadas con el contexto', () => {
      expect(getTemplate).toHaveBeenCalledWith('t1');
      expect(component.docForm.getRawValue()['cliente']).toBe('Ana Ruiz, Luis Gil');
      expect(q<HTMLInputElement>('#ae-doc-cliente').value).toBe('Ana Ruiz, Luis Gil');
      expect(q<HTMLInputElement>('#ae-doc-importe').value).toBe('');
    });

    it('bloquea Preparar mientras falten variables obligatorias y lo indica', () => {
      expect(component.puedePreparar()).toBe(false);
      expect(el().textContent).toContain('Importe');
      component.docForm.controls['importe'].setValue('1.200 €');
      expect(component.puedePreparar()).toBe(true);
    });

    it('envía valoresDoc al servicio', async () => {
      component.docForm.controls['importe'].setValue('1.200 €');
      await component.preparar();
      expect(preparar.mock.calls[0][0].valoresDoc).toMatchObject({ importe: '1.200 €', cliente: 'Ana Ruiz, Luis Gil' });
    });

    it('si la plantilla ya no existe avisa y bloquea', async () => {
      getTemplate.mockResolvedValue(null);
      await montar({ accion: accion({ docTemplateId: 't1' }) });
      expect(q('[role="alert"]').textContent).toContain('plantilla de documento');
      expect(component.puedePreparar()).toBe(false);
    });
  });

  it('cerrar emite closed', async () => {
    const spy = vi.fn();
    component.closed.subscribe(spy);
    q<HTMLButtonElement>('[aria-label="Cerrar"]').click();
    expect(spy).toHaveBeenCalled();
  });

  describe('Redactar con IA', () => {
    const redactor = () => fixture.debugElement.query(By.directive(RedactorIaComponent)).componentInstance as RedactorIaComponent;

    it('modo mensaje con el contexto real y el borrador actual', async () => {
      await montar();
      expect(redactor().modo()).toBe('mensaje');
      expect(redactor().contexto()?.['cliente']).toBe(component.contexto()['cliente']);
      expect(redactor().borrador()).toEqual(component.form.getRawValue());
    });

    it('el formato sigue al canal elegido', async () => {
      await montar();
      expect(redactor().formato()).toBe('email');
      component.elegirCanal('whatsapp');
      fixture.detectChanges();
      expect(redactor().formato()).toBe('whatsapp');
    });

    it('vuelca el texto y no lo pisa al cambiar destinatarios', async () => {
      await montar();
      redactor().redactado.emit({ asunto: 'Vista mañana', cuerpo: 'Hola Ana, mañana es la vista.' });
      await flush();
      expect(component.form.getRawValue()).toEqual({ asunto: 'Vista mañana', cuerpo: 'Hola Ana, mañana es la vista.' });
      component.alternarContacto('k2');
      await flush();
      expect(component.form.getRawValue().cuerpo).toBe('Hola Ana, mañana es la vista.');
      expect(component.puedePreparar()).toBe(true);
    });
  });

  describe('despacho de ejemplo', () => {
    it('avisa que no se envía nada y no deja preparar el mensaje', async () => {
      await montar({}, { esDemo: true });
      expect(q('[data-testid="aviso-demo"]').textContent).toContain('En el despacho de ejemplo no se envía nada');
      expect(component.puedePreparar()).toBe(false);
      expect(q<HTMLButtonElement>('[data-testid="preparar"]').disabled).toBe(true);
      await component.preparar();
      expect(preparar).not.toHaveBeenCalled();
    });

    it('en un despacho normal no hay aviso', async () => {
      await montar();
      expect(el().querySelector('[data-testid="aviso-demo"]')).toBeNull();
    });
  });
});
