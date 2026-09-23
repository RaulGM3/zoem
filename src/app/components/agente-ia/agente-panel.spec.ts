import { describe, it, expect, beforeEach, vi } from 'vitest';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { AgentChatService } from '../../core/agent/agent-chat.service';
import { PermissionService } from '../../core/services/permission.service';
import { GRABADOR, type Grabador } from '../../core/voz/grabador.port';
import { TranscripcionService } from '../../core/voz/transcripcion.service';
import { AgentePanelComponent } from './agente-panel';

function montar() {
  const chat = {
    mensajes: signal([]),
    pensando: signal(false),
    error: signal<string | null>(null),
    send: vi.fn(async () => {}),
    limpiar: vi.fn(),
  };

  const grabador = { soportado: () => true, iniciar: vi.fn() } as unknown as Grabador;

  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    imports: [AgentePanelComponent],
    providers: [
      { provide: AgentChatService, useValue: chat },
      { provide: Router, useValue: { url: '/casos' } },
      { provide: PermissionService, useValue: { userRole: signal('admin') } },
      { provide: GRABADOR, useValue: grabador },
      { provide: TranscripcionService, useValue: { transcribir: vi.fn() } },
    ],
  });

  const fixture = TestBed.createComponent(AgentePanelComponent);
  fixture.detectChanges();
  return { fixture, componente: fixture.componentInstance };
}

describe('AgentePanelComponent', () => {
  beforeEach(() => TestBed.resetTestingModule());

  it('se anuncia como diálogo con nombre accesible', () => {
    const { fixture } = montar();
    const dialogo = fixture.nativeElement.querySelector('[role="dialog"]') as HTMLElement;

    expect(dialogo).toBeTruthy();
    expect(dialogo.getAttribute('aria-label')).toBeTruthy();
  });

  it('NO es modal: el agente acompaña, no bloquea el resto de la app', () => {
    const { fixture } = montar();
    const dialogo = fixture.nativeElement.querySelector('[role="dialog"]') as HTMLElement;

    expect(dialogo.getAttribute('aria-modal')).toBe('false');
  });

  it('monta el chat dentro', () => {
    const { fixture } = montar();

    expect(fixture.nativeElement.querySelector('app-agente-chat')).toBeTruthy();
  });

  it('proyecta un botón de cerrar en la cabecera del chat', () => {
    const { fixture } = montar();
    const cerrar = fixture.nativeElement.querySelector('[data-test="cerrar-panel"]');

    expect(cerrar).toBeTruthy();
    expect(cerrar.getAttribute('aria-label')).toBeTruthy();
  });

  it('el botón de cerrar emite `cerrado`', () => {
    const { fixture, componente } = montar();
    const emitido = vi.fn();
    componente.cerrado.subscribe(emitido);

    (fixture.nativeElement.querySelector('[data-test="cerrar-panel"]') as HTMLButtonElement).click();

    expect(emitido).toHaveBeenCalledTimes(1);
  });

  it('Escape emite `cerrado`', () => {
    const { fixture, componente } = montar();
    const emitido = vi.fn();
    componente.cerrado.subscribe(emitido);

    const dialogo = fixture.nativeElement.querySelector('[role="dialog"]') as HTMLElement;
    dialogo.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    fixture.detectChanges();

    expect(emitido).toHaveBeenCalledTimes(1);
  });

});
