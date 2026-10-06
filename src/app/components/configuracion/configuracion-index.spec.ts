import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { Router } from '@angular/router';
import { ConfiguracionIndexComponent } from './configuracion-index';
import { BreakpointService } from '../../core/services/breakpoint.service';

describe('ConfiguracionIndexComponent', () => {
  const isDesktop = signal(true);
  const navigate = vi.fn(async () => true);

  function montar() {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [ConfiguracionIndexComponent],
      providers: [
        { provide: BreakpointService, useValue: { isDesktop } },
        { provide: Router, useValue: { navigate } },
      ],
    });
    const f = TestBed.createComponent(ConfiguracionIndexComponent);
    f.detectChanges();
    return f;
  }

  beforeEach(() => navigate.mockClear());

  it('escritorio: redirige a /configuracion/empresa sin dejar historial', async () => {
    isDesktop.set(true);
    const f = montar();
    await f.whenStable();
    expect(navigate).toHaveBeenCalledWith(['/configuracion', 'empresa'], { replaceUrl: true });
  });

  it('móvil: no redirige (se queda la lista)', async () => {
    isDesktop.set(false);
    const f = montar();
    await f.whenStable();
    expect(navigate).not.toHaveBeenCalled();
  });

  it('móvil que pasa a escritorio: redirige', async () => {
    isDesktop.set(false);
    const f = montar();
    await f.whenStable();
    isDesktop.set(true);
    f.detectChanges();
    await f.whenStable();
    expect(navigate).toHaveBeenCalledTimes(1);
  });
});
