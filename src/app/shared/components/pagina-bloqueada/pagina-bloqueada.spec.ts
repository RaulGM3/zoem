import { describe, it, expect } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { PaginaBloqueadaComponent } from './pagina-bloqueada';

async function montar() {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({ imports: [PaginaBloqueadaComponent] });
  const fixture = TestBed.createComponent(PaginaBloqueadaComponent);
  fixture.componentRef.setInput('titulo', 'Tesorería');
  fixture.componentRef.setInput('descripcion', 'Controla tus cobros.');
  fixture.componentRef.setInput('beneficios', ['Cierre de caja', 'Gastos']);
  fixture.detectChanges();
  return fixture;
}

describe('PaginaBloqueadaComponent', () => {
  it('muestra título, descripción y beneficios', async () => {
    const f = await montar();
    const el = f.nativeElement as HTMLElement;
    expect(el.querySelector('h1')?.textContent).toContain('Tesorería');
    expect(el.textContent).toContain('Controla tus cobros.');
    expect(el.querySelectorAll('li').length).toBe(2);
  });

  it('el CTA emite mejorar', async () => {
    const f = await montar();
    let emitido = 0;
    f.componentInstance.mejorar.subscribe(() => emitido++);
    (f.nativeElement as HTMLElement).querySelector<HTMLButtonElement>('button')!.click();
    expect(emitido).toBe(1);
  });
});
