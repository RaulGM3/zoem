import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CasoDocSlotRowComponent } from './caso-doc-slot-row';
import type { CasoDocSlot } from '../../../../interfaces';

const slot = (extra: Record<string, unknown> = {}): CasoDocSlot =>
  ({ id: 's1', folderId: null, name: 'DNI', status: 'pendiente', ...extra }) as unknown as CasoDocSlot;

describe('CasoDocSlotRowComponent', () => {
  let fixture: ComponentFixture<CasoDocSlotRowComponent>;
  let eventos: string[];
  let subidos: File[];

  const el = (): HTMLElement => fixture.nativeElement;
  const texto = (): string => el().textContent?.replace(/\s+/g, ' ').trim() ?? '';
  const boton = (etiqueta: string): HTMLButtonElement | undefined =>
    Array.from(el().querySelectorAll('button')).find(b => b.textContent?.replace(/\s+/g, ' ').trim() === etiqueta);
  const porLabel = (label: string): HTMLButtonElement | null => el().querySelector(`[aria-label="${label}"]`);

  function render(s: CasoDocSlot, inputs: Record<string, unknown> = {}): void {
    fixture.componentRef.setInput('slot', s);
    for (const [nombre, valor] of Object.entries(inputs)) fixture.componentRef.setInput(nombre, valor);
    fixture.detectChanges();
  }

  beforeEach(async () => {
    TestBed.resetTestingModule();
    await TestBed.configureTestingModule({ imports: [CasoDocSlotRowComponent] }).compileComponents();
    fixture = TestBed.createComponent(CasoDocSlotRowComponent);
    const c = fixture.componentInstance;
    eventos = [];
    subidos = [];
    c.generate.subscribe(() => eventos.push('generate'));
    c.preview.subscribe(() => eventos.push('preview'));
    c.history.subscribe(() => eventos.push('history'));
    c.access.subscribe(() => eventos.push('access'));
    c.remove.subscribe(() => eventos.push('remove'));
    c.upload.subscribe(f => subidos.push(f));
  });

  afterEach(() => vi.restoreAllMocks());

  describe('slot de subida pendiente', () => {
    it('muestra nombre, descripción y estado', () => {
      render(slot({ description: 'Ambas caras' }));
      expect(texto()).toContain('DNI');
      expect(texto()).toContain('Ambas caras');
      expect(texto()).toContain('Pendiente');
    });

    it('el botón abre el selector y el archivo elegido se emite', () => {
      render(slot());
      const input = el().querySelector<HTMLInputElement>('#upload-slot-s1')!;
      const spy = vi.spyOn(input, 'click');
      boton('Subir')!.click();
      expect(spy).toHaveBeenCalled();

      const file = new File(['x'], 'dni.pdf');
      Object.defineProperty(input, 'files', { value: [file], configurable: true });
      input.value = '';
      input.dispatchEvent(new Event('change'));
      expect(subidos).toEqual([file]);
    });

    it('no emite si se cancela el selector', () => {
      render(slot());
      const input = el().querySelector<HTMLInputElement>('#upload-slot-s1')!;
      Object.defineProperty(input, 'files', { value: [], configurable: true });
      input.dispatchEvent(new Event('change'));
      expect(subidos).toHaveLength(0);
    });

    it('mientras sube se bloquea', () => {
      render(slot(), { uploading: true });
      expect(boton('Subiendo...')!.disabled).toBe(true);
    });

    it('sin permiso de edición no se puede subir', () => {
      render(slot(), { canEdit: false });
      expect(boton('Subir')).toBeUndefined();
      expect(el().querySelector('input[type="file"]')).toBeNull();
    });
  });

  describe('slot con plantilla', () => {
    it('pendiente: se rellena', () => {
      render(slot({ docTemplateId: 't1' }));
      boton('Rellenar')!.click();
      expect(eventos).toEqual(['generate']);
    });

    it('pendiente sin permiso de edición: no se puede rellenar', () => {
      render(slot({ docTemplateId: 't1' }), { canEdit: false });
      expect(boton('Rellenar')).toBeUndefined();
      expect(texto()).toContain('Pendiente');
    });

    it('generado: se puede ver aunque no se pueda editar', () => {
      render(slot({ docTemplateId: 't1', status: 'generado' }), { canEdit: false });
      expect(texto()).toContain('Generado');
      boton('Ver')!.click();
      expect(eventos).toEqual(['generate']);
    });
  });

  describe('slot subido', () => {
    const subido = (extra: Record<string, unknown> = {}): CasoDocSlot =>
      slot({ status: 'subido', downloadUrl: 'http://x', ...extra });

    it('emite previsualizar, historial, acceso y quitar', () => {
      render(subido(), { isAdmin: true });
      for (const label of ['Previsualizar', 'Ver historial', 'Gestionar acceso', 'Quitar documento']) porLabel(label)!.click();
      expect(eventos).toEqual(['preview', 'history', 'access', 'remove']);
    });

    it('solo muestra la versión a partir de la segunda', () => {
      render(subido({ version: 1 }));
      expect(texto()).not.toContain('v1');
      render(subido({ version: 4 }));
      expect(texto()).toContain('v4');
    });

    it('no ofrece previsualizar si no hay nada que abrir', () => {
      render(subido({ downloadUrl: undefined }));
      expect(porLabel('Previsualizar')).toBeNull();
      render(subido({ downloadUrl: undefined, clasificado: true, storagePath: 'p' }));
      expect(porLabel('Previsualizar')).not.toBeNull();
    });

    it('el acceso es solo para administradores y quitar requiere permiso de borrado', () => {
      render(subido(), { isAdmin: false, canDelete: false });
      expect(porLabel('Gestionar acceso')).toBeNull();
      expect(porLabel('Quitar documento')).toBeNull();
    });

    it('bloquea quitar mientras el slot está en una operación', () => {
      render(subido(), { uploading: true });
      expect(porLabel('Quitar documento')!.disabled).toBe(true);
    });
  });
});
