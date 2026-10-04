import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { HorasEditorComponent } from './horas-editor';
import { ToastService } from '../../../../core/services/toast.service';
import { MEMBERS, hito, registro } from '../../testing/calendario-fixtures';

describe('HorasEditorComponent — móvil', () => {
  beforeEach(() => TestBed.resetTestingModule());

  function abrirEditor(): HTMLElement {
    TestBed.configureTestingModule({
      imports: [HorasEditorComponent],
      providers: [{ provide: ToastService, useValue: { info: vi.fn() } }],
    });
    const fixture = TestBed.createComponent(HorasEditorComponent);
    fixture.componentRef.setInput('item', hito({ registrosHoras: [registro()] }));
    fixture.componentRef.setInput('members', MEMBERS);
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;
    Array.from(el.querySelectorAll('button')).find(b => b.textContent?.includes('Editar horas'))!.click();
    fixture.detectChanges();
    return el;
  }

  it('los botones de acción tienen área táctil y hover por clases', () => {
    const el = abrirEditor();
    const guardar = Array.from(el.querySelectorAll('button')).find(b => b.textContent?.trim() === 'Guardar horas')!;
    expect(guardar.className).toContain('tap-target');
    expect(guardar.className).toContain('hover:');
    const separar = el.querySelector<HTMLElement>('[aria-label="Separar bloque en otro día"]')!;
    expect(separar.className).toContain('tap-target');
  });

  it('cada bloque apila sus campos en móvil (columna) y los inputs no desbordan', () => {
    const el = abrirEditor();
    const select = el.querySelector<HTMLElement>('select[aria-label="Miembro"]')!;
    expect(select.className).toContain('max-sm:w-full');
    expect(el.querySelector<HTMLElement>('input[aria-label="Fecha"]')!.className).toContain('max-sm:flex-1');
  });
});
