import { describe, it, expect, vi } from 'vitest';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { Subject } from 'rxjs';
import { analizarA11y, formatearViolaciones } from '../../../testing/axe';
import { AgentChatService } from '../../core/agent/agent-chat.service';
import { PermissionService } from '../../core/services/permission.service';
import { DictadoService } from '../../core/voz/dictado.service';
import { AgenteVozComponent } from './agente-voz';
import { fakeDictado } from '../../../testing/fake-dictado';

async function montar() {
  const dictado = fakeDictado();
  const chat = {
    mensajes: signal([]),
    pensando: signal(false),
    error: signal<string | null>(null),
    send: vi.fn(async () => {}),
    limpiar: vi.fn(),
  };

  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    imports: [AgenteVozComponent],
    providers: [
      { provide: AgentChatService, useValue: chat },
      { provide: Router, useValue: { url: '/casos', events: new Subject().asObservable() } },
      { provide: PermissionService, useValue: { userRole: signal('admin') } },
    ],
  });
  TestBed.overrideComponent(AgenteVozComponent, {
    set: { providers: [{ provide: DictadoService, useValue: dictado }] },
  });
  const fixture = TestBed.createComponent(AgenteVozComponent);
  fixture.detectChanges();
  await fixture.whenStable();
  return { fixture, dictado };
}

describe('AgenteVozComponent — accesibilidad (axe)', () => {
  it('no tiene violaciones mientras graba', async () => {
    const { fixture } = await montar();
    const v = await analizarA11y(fixture.nativeElement);
    expect(v.length, formatearViolaciones(v)).toBe(0);
  });

  it('no tiene violaciones editando la transcripción', async () => {
    const { fixture, dictado } = await montar();
    dictado.transcribir('Llévame a facturación');
    await fixture.whenStable();
    fixture.detectChanges();
    const v = await analizarA11y(fixture.nativeElement);
    expect(v.length, formatearViolaciones(v)).toBe(0);
  });

  it('no tiene violaciones mostrando un error', async () => {
    const { fixture, dictado } = await montar();
    dictado.fallar('No se ha detectado ningún micrófono conectado.');
    await fixture.whenStable();
    fixture.detectChanges();
    const v = await analizarA11y(fixture.nativeElement);
    expect(v.length, formatearViolaciones(v)).toBe(0);
  });
});
