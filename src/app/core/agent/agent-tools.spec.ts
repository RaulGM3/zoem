import { describe, it, expect, vi } from 'vitest';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { AGENT_TOOLS, provideAgentTools } from './agent-tools';
import { CasosService } from '../services/casos.service';
import { ContactService } from '../services/contact.service';
import { PermissionService } from '../services/permission.service';

/** Monta el ensamblaje real de tools con los servicios de Angular sustituidos por dobles. */
function setup(can: (modulo: string, cap: string) => boolean = () => true) {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      provideAgentTools(),
      { provide: CasosService, useValue: { casos: signal([]) } },
      { provide: ContactService, useValue: { contacts: signal([]) } },
      { provide: Router, useValue: { navigate: vi.fn(async () => true) } },
      { provide: PermissionService, useValue: { can: vi.fn(can), canAccess: (m: string) => can(m, 'ver') } },
    ],
  });
  return TestBed.inject(AGENT_TOOLS).flat();
}

describe('provideAgentTools — ayuda', () => {
  it('registra consultar_ayuda junto al resto de tools', () => {
    const nombres = setup().map((t) => t.name);
    expect(nombres).toContain('consultar_ayuda');
    expect(nombres).toContain('navegar');
  });

  it('consultar_ayuda no declara permiso: sigue disponible en los modos de solo lectura', () => {
    const ayuda = setup().find((t) => t.name === 'consultar_ayuda');
    expect(ayuda?.permission).toBeUndefined();
  });

  it('consultar_ayuda usa las guías reales y los permisos del usuario', async () => {
    const ayuda = setup((modulo) => modulo !== 'Tesorería').find((t) => t.name === 'consultar_ayuda');

    const permitida = await ayuda!.execute({ guia: 'contactos' });
    expect(permitida.ok).toBe(true);

    const vetada = await ayuda!.execute({ guia: 'tesoreria' });
    expect(vetada.ok).toBe(false);
  });
});
