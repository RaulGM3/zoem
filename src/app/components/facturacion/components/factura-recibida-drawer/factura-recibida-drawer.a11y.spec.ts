import { describe, it, expect } from 'vitest';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { FacturaRecibidaDrawerComponent } from './factura-recibida-drawer';
import { analizarA11y, formatearViolaciones } from '../../../../../testing/axe';

async function montar(): Promise<ComponentFixture<FacturaRecibidaDrawerComponent>> {
  TestBed.resetTestingModule();
  await TestBed.configureTestingModule({ imports: [FacturaRecibidaDrawerComponent] }).compileComponents();
  const fixture = TestBed.createComponent(FacturaRecibidaDrawerComponent);
  fixture.componentRef.setInput('fechaHoy', '2026-04-05');
  fixture.detectChanges();
  await fixture.whenStable();
  fixture.detectChanges();
  return fixture;
}

const pulsarConfirmar = async (f: ComponentFixture<FacturaRecibidaDrawerComponent>): Promise<void> => {
  (f.nativeElement as HTMLElement).querySelector<HTMLButtonElement>('[data-confirmar]')!.click();
  f.detectChanges();
  await f.whenStable();
  f.detectChanges();
};

describe('FacturaRecibidaDrawerComponent — accesibilidad (axe)', () => {
  it('sin violaciones en el estado inicial', async () => {
    const f = await montar();
    const v = await analizarA11y(f.nativeElement as HTMLElement);
    expect(v, `\n${formatearViolaciones(v)}\n`).toEqual([]);
  });

  it('sin violaciones con todos los errores de validación visibles', async () => {
    const f = await montar();
    await pulsarConfirmar(f);
    const raiz = f.nativeElement as HTMLElement;
    expect(raiz.querySelectorAll('[role="alert"]').length).toBeGreaterThan(3);
    const v = await analizarA11y(raiz);
    expect(v, `\n${formatearViolaciones(v)}\n`).toEqual([]);
  });

  it('sin violaciones con error de servidor, aviso de reactivación y advertencias', async () => {
    const f = await montar();
    f.componentRef.setInput('errorServidor', 'Ya existe una factura registrada.');
    f.componentRef.setInput('reactivacionPendiente', true);
    f.detectChanges();
    const v = await analizarA11y(f.nativeElement as HTMLElement);
    expect(v, `\n${formatearViolaciones(v)}\n`).toEqual([]);
  });

  it('al fallar la validación el foco va al primer campo inválido', async () => {
    const f = await montar();
    await pulsarConfirmar(f);
    await f.whenStable();
    const activo = document.activeElement as HTMLElement | null;
    expect(activo?.getAttribute('aria-invalid')).toBe('true');
  });
});
