import { describe, it, expect, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { CasoDetailHeaderComponent } from './caso-detail-header';

async function montar(canEdit: boolean, editing = false) {
  TestBed.resetTestingModule();
  await TestBed.configureTestingModule({
    imports: [CasoDetailHeaderComponent],
    providers: [provideRouter([])],
  }).compileComponents();
  const f = TestBed.createComponent(CasoDetailHeaderComponent);
  const set = (k: string, v: unknown) => f.componentRef.setInput(k, v);
  set('titulo', 'Divorcio'); set('estado', 'pendiente'); set('tipo', 'Civil'); set('editing', editing);
  set('activeTab', 'info'); set('hitosCount', 0); set('movimientosCount', 0); set('gestoriaPending', 0);
  set('docsPending', 0); set('canEdit', canEdit);
  f.detectChanges();
  return f;
}

describe('CasoDetailHeaderComponent: acciones', () => {
  it('muestra "Notificar / Acciones" y emite acciones al pulsarlo', async () => {
    const f = await montar(true);
    const spy = vi.fn();
    f.componentInstance.acciones.subscribe(spy);
    const btn = (f.nativeElement as HTMLElement).querySelector<HTMLButtonElement>('[data-testid="caso-acciones"]')!;
    expect(btn.textContent).toContain('Notificar / Acciones');
    btn.click();
    expect(spy).toHaveBeenCalled();
  });

  it('no se muestra sin permiso de edición ni mientras se edita', async () => {
    expect(((await montar(false)).nativeElement as HTMLElement).querySelector('[data-testid="caso-acciones"]')).toBeNull();
    expect(((await montar(true, true)).nativeElement as HTMLElement).querySelector('[data-testid="caso-acciones"]')).toBeNull();
  });
});
