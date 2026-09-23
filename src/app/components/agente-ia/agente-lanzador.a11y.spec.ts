import { describe, it, expect } from 'vitest';
import { DeferBlockBehavior, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { Subject } from 'rxjs';
import { analizarA11y, formatearViolaciones } from '../../../testing/axe';
import { AgenteLanzadorComponent } from './agente-lanzador';

async function montar() {
  const events = new Subject<unknown>();

  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    imports: [AgenteLanzadorComponent],
    providers: [{ provide: Router, useValue: { url: '/casos', events: events.asObservable() } }],
    deferBlockBehavior: DeferBlockBehavior.Manual,
  });
  await TestBed.compileComponents();

  const fixture = TestBed.createComponent(AgenteLanzadorComponent);
  fixture.detectChanges();
  await fixture.whenStable();
  return fixture;
}

describe('AgenteLanzadorComponent — accesibilidad (axe)', () => {
  it('no tiene violaciones en reposo', async () => {
    const fixture = await montar();

    const v = await analizarA11y(fixture.nativeElement);
    expect(v.length, formatearViolaciones(v)).toBe(0);
  });
});
