import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { RedactorIaComponent } from './redactor-ia';
import { AccionRedaccionService } from '../../../core/services/accion-redaccion.service';
import type { TextoRedactado } from '../../../core/acciones/redaccion-ia';

describe('RedactorIaComponent', () => {
  let fixture: ComponentFixture<RedactorIaComponent>;
  let redactar: ReturnType<typeof vi.fn>;
  let emitidos: TextoRedactado[];
  const el = () => fixture.nativeElement as HTMLElement;
  const q = <T extends HTMLElement>(sel: string) => el().querySelector<T>(sel);
  const flush = async () => {
    fixture.detectChanges();
    await fixture.whenStable();
    for (let i = 0; i < 5; i++) await Promise.resolve();
    fixture.detectChanges();
  };

  async function montar(inputs: Record<string, unknown> = {}) {
    TestBed.resetTestingModule();
    await TestBed.configureTestingModule({
      imports: [RedactorIaComponent],
      providers: [{ provide: AccionRedaccionService, useValue: { redactar } }],
    }).compileComponents();
    fixture = TestBed.createComponent(RedactorIaComponent);
    fixture.componentRef.setInput('modo', 'plantilla');
    fixture.componentRef.setInput('formato', 'email');
    fixture.componentRef.setInput('idPrefix', 't');
    for (const [k, v] of Object.entries(inputs)) fixture.componentRef.setInput(k, v);
    emitidos = [];
    fixture.componentInstance.redactado.subscribe((t) => emitidos.push(t));
    await flush();
  }

  const abrir = async () => {
    q<HTMLButtonElement>('[data-testid="redactor-toggle"]')!.click();
    await flush();
  };
  const escribir = async (texto: string) => {
    const ta = q<HTMLTextAreaElement>('#t-ia-instrucciones')!;
    ta.value = texto;
    ta.dispatchEvent(new Event('input'));
    await flush();
  };

  beforeEach(async () => {
    redactar = vi.fn().mockResolvedValue({ ok: true, texto: { asunto: 'A', cuerpo: 'C' } });
    await montar();
  });

  it('empieza plegado con un toggle accesible', async () => {
    const t = q<HTMLButtonElement>('[data-testid="redactor-toggle"]')!;
    expect(t.getAttribute('aria-expanded')).toBe('false');
    expect(q('#t-ia-instrucciones')).toBeNull();
    await abrir();
    expect(t.getAttribute('aria-expanded')).toBe('true');
    expect(q('label[for="t-ia-instrucciones"]')).not.toBeNull();
  });

  it('el botón Redactar está deshabilitado sin instrucciones', async () => {
    await abrir();
    expect(q<HTMLButtonElement>('[data-testid="redactor-generar"]')!.disabled).toBe(true);
  });

  it('envía la solicitud completa y emite el texto redactado', async () => {
    const borrador = { asunto: 'X', cuerpo: 'Y' };
    const contexto = { cliente: 'Ana' };
    await montar({ modo: 'mensaje', formato: 'whatsapp', borrador, contexto });
    await abrir();
    await escribir('recordar la cita');
    q<HTMLButtonElement>('[data-testid="redactor-generar"]')!.click();
    await flush();
    expect(redactar).toHaveBeenCalledWith({
      modo: 'mensaje', formato: 'whatsapp', instrucciones: 'recordar la cita', borrador, contexto,
    });
    expect(emitidos).toEqual([{ asunto: 'A', cuerpo: 'C' }]);
  });

  it('en modo mensaje avisa de qué datos salen hacia la IA', async () => {
    await montar({ modo: 'mensaje' });
    await abrir();
    expect(el().textContent).toMatch(/no se envían el email ni el teléfono/i);
  });

  it('muestra el error con role=alert y no emite', async () => {
    redactar.mockResolvedValue({ ok: false, mensaje: 'Falló' });
    await abrir();
    await escribir('algo');
    q<HTMLButtonElement>('[data-testid="redactor-generar"]')!.click();
    await flush();
    expect(q('[role="alert"]')!.textContent).toContain('Falló');
    expect(emitidos).toEqual([]);
  });
});
