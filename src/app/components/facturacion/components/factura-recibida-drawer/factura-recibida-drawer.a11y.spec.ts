import { describe, it, expect } from 'vitest';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { FacturaRecibidaDrawerComponent } from './factura-recibida-drawer';
import { extraccionFalsa } from '../../../../../testing/facturas-recibidas';
import { analizarA11y, formatearViolaciones } from '../../../../../testing/axe';

async function montar(): Promise<ComponentFixture<FacturaRecibidaDrawerComponent>> {
  TestBed.resetTestingModule();
  await TestBed.configureTestingModule({ imports: [FacturaRecibidaDrawerComponent], providers: [extraccionFalsa()] }).compileComponents();
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

  it('sin violaciones con archivo adjunto, estado de extracción y error de formato visibles', async () => {
    const f = await montar();
    const raiz = f.nativeElement as HTMLElement;
    const input = raiz.querySelector<HTMLInputElement>('#fr-archivo')!;
    Object.defineProperty(input, 'files', { configurable: true, value: [new File([new Uint8Array(3)], 'a.pdf', { type: 'application/pdf' })] });
    input.dispatchEvent(new Event('change', { bubbles: true }));
    f.detectChanges();
    await f.whenStable();
    f.detectChanges();
    const heic = raiz.querySelector<HTMLInputElement>('#fr-foto')!;
    Object.defineProperty(heic, 'files', { configurable: true, value: [new File([new Uint8Array(3)], 'a.heic', { type: 'image/heic' })] });
    heic.dispatchEvent(new Event('change', { bubbles: true }));
    f.detectChanges();
    await f.whenStable();
    f.detectChanges();
    expect(raiz.querySelector('[data-archivo-adjunto]')).not.toBeNull();
    expect(raiz.querySelector('[data-error-archivo]')).not.toBeNull();
    expect(raiz.querySelector('[data-estado-extraccion]')?.textContent).toContain('sin IA en tests');
    const v = await analizarA11y(raiz);
    expect(v, `\n${formatearViolaciones(v)}\n`).toEqual([]);
  });
});
