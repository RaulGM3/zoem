import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { AccionFormDrawerComponent } from './accion-form-drawer';
import { RedactorIaComponent } from '../redactor-ia/redactor-ia';
import { AccionRedaccionService } from '../../../core/services/accion-redaccion.service';
import type { Accion, AccionInput } from '../../../interfaces/accion.interface';
import type { DocTemplate } from '../../../interfaces/doc-template.interface';

const plantillasDoc = [
  { id: 't1', name: 'Hoja de encargo' },
  { id: 't2', name: 'Presupuesto' },
] as DocTemplate[];

const existente = {
  id: 'a1', nombre: 'Enviar presupuesto', ambito: 'contacto', asunto: 'Presupuesto', cuerpo: 'Hola {{cliente}}',
  canales: ['gmail'], activa: true, docTemplateId: 't1',
} as Accion;

describe('AccionFormDrawerComponent', () => {
  let fixture: ComponentFixture<AccionFormDrawerComponent>;
  let component: AccionFormDrawerComponent;
  let saved: AccionInput[];
  let closed: number;

  async function montar(inputs: Record<string, unknown> = {}) {
    TestBed.resetTestingModule();
    await TestBed.configureTestingModule({
      imports: [AccionFormDrawerComponent],
      providers: [{ provide: AccionRedaccionService, useValue: { redactar: vi.fn() } }],
    }).compileComponents();
    fixture = TestBed.createComponent(AccionFormDrawerComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('docTemplates', plantillasDoc);
    for (const [k, v] of Object.entries(inputs)) fixture.componentRef.setInput(k, v);
    saved = [];
    closed = 0;
    component.saved.subscribe((v) => saved.push(v));
    component.closed.subscribe(() => closed++);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  const el = () => fixture.nativeElement as HTMLElement;

  beforeEach(async () => {
    await montar();
  });

  it('es un diálogo modal accesible', () => {
    const dialog = el().querySelector('[role="dialog"]')!;
    expect(dialog.getAttribute('aria-modal')).toBe('true');
    expect(dialog.getAttribute('aria-labelledby')).toBeTruthy();
    expect(dialog.hasAttribute('appFocusTrap')).toBe(true);
  });

  it('no permite guardar vacío ni sin canal', () => {
    expect(component.puedeGuardar()).toBe(false);
    component.form.patchValue({ nombre: 'X', asunto: 'A', cuerpo: 'B' });
    expect(component.puedeGuardar()).toBe(false);
    component.toggleCanal('gmail');
    expect(component.puedeGuardar()).toBe(true);
    component.toggleCanal('gmail');
    expect(component.puedeGuardar()).toBe(false);
  });

  it('emite AccionInput limpio al guardar', () => {
    component.form.patchValue({ nombre: ' Bienvenida ', asunto: 'Hola', cuerpo: 'Texto', ambito: 'caso' });
    component.toggleCanal('gmail');
    component.toggleCanal('whatsapp');
    component.guardar();
    expect(saved).toEqual([
      { nombre: 'Bienvenida', ambito: 'caso', asunto: 'Hola', cuerpo: 'Texto', canales: ['gmail', 'whatsapp'], activa: true },
    ]);
  });

  it('precarga una acción existente y permite quitarle el documento', async () => {
    await montar({ accion: existente });
    expect(component.form.getRawValue().nombre).toBe('Enviar presupuesto');
    expect(component.form.getRawValue().docTemplateId).toBe('t1');
    component.form.patchValue({ docTemplateId: '' });
    component.guardar();
    expect(saved[0].docTemplateId).toBe('');
  });

  it('con ámbito fijo y plantilla: fuerza ambito caso y adjunta plantillaId y hito', async () => {
    await montar({
      ambitoFijo: 'caso', plantillaId: 'p1',
      hitosPlantilla: [{ id: 'h1', titulo: 'Demanda', orden: 0, diasDesdeInicio: 0 }],
    });
    expect(el().querySelector('#af-ambito')).toBeNull();
    component.form.patchValue({ nombre: 'N', asunto: 'A', cuerpo: 'B', hitoPlantillaId: 'h1' });
    component.toggleCanal('mail');
    component.guardar();
    expect(saved[0]).toMatchObject({ ambito: 'caso', plantillaId: 'p1', hitoPlantillaId: 'h1' });
  });

  it('el chip de variable inserta {{clave}} en el cuerpo en la posición del cursor', () => {
    component.form.patchValue({ cuerpo: 'Hola ,' });
    const ta = el().querySelector<HTMLTextAreaElement>('#af-cuerpo')!;
    ta.focus();
    ta.setSelectionRange(5, 5);
    component.registrarFoco('cuerpo');
    component.insertarVariable('cliente');
    expect(component.form.getRawValue().cuerpo).toBe('Hola {{cliente}},');
  });

  it('los chips son botones con nombre accesible', () => {
    const chip = el().querySelector<HTMLButtonElement>('button[data-variable="cliente"]')!;
    expect(chip.getAttribute('type')).toBe('button');
    expect(chip.getAttribute('aria-label')).toContain('cliente');
  });

  it('lista solo las plantillas de documento recibidas', () => {
    const opts = Array.from(el().querySelectorAll('#af-doc option')).map((o) => o.textContent?.trim());
    expect(opts).toEqual(['Sin documento', 'Hoja de encargo', 'Presupuesto']);
  });

  it('cerrar emite closed', () => {
    el().querySelector<HTMLButtonElement>('[aria-label="Cerrar"]')!.click();
    expect(closed).toBe(1);
  });

  describe('Redactar con IA', () => {
    const redactor = () => fixture.debugElement.query(By.directive(RedactorIaComponent)).componentInstance as RedactorIaComponent;

    it('genera una plantilla y vuelca asunto y cuerpo en el formulario', () => {
      expect(redactor().modo()).toBe('plantilla');
      redactor().redactado.emit({ asunto: 'Documentación', cuerpo: 'Hola {{cliente}}' });
      fixture.detectChanges();
      expect(component.form.controls.asunto.value).toBe('Documentación');
      expect(component.form.controls.cuerpo.value).toBe('Hola {{cliente}}');
      expect(component.form.controls.cuerpo.dirty).toBe(true);
    });

    it('formato WhatsApp solo si WhatsApp es el único canal', () => {
      expect(redactor().formato()).toBe('email');
      component.toggleCanal('whatsapp');
      fixture.detectChanges();
      expect(redactor().formato()).toBe('whatsapp');
      component.toggleCanal('gmail');
      fixture.detectChanges();
      expect(redactor().formato()).toBe('email');
    });
  });
});
