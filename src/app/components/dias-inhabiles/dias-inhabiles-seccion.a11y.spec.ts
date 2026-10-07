import { describe, it, expect, vi } from 'vitest';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { DiasInhabilesSeccionComponent } from './dias-inhabiles-seccion';
import { CalendariosJudicialesService } from '../../core/services/calendarios-judiciales.service';
import { CompanyService } from '../../core/services/company.service';
import { CasosService } from '../../core/services/casos.service';
import { PermissionService } from '../../core/services/permission.service';
import { UsersService } from '../../core/services/users';
import { UserSyncService } from '../../core/services/user-sync.service';
import { FestivosIaService } from '../../core/services/festivos-ia.service';
import { ToastService } from '../../core/services/toast.service';
import { analizarA11y, formatearViolaciones } from '../../../testing/axe';
import type { CapaAnio } from '../../core/plazos/dias-rojos';

const ANIO = new Date().getFullYear();
const CAPA: CapaAnio = {
  diasRojos: [
    { fecha: `${ANIO}-01-01`, nombre: 'Año Nuevo', ambito: 'nacional', estado: 'confirmado', origen: 'ia', fuenteUrl: 'https://www.boe.es/x' },
    { fecha: `${ANIO}-05-02`, nombre: 'Fiesta autonómica', ambito: 'autonomico', estado: 'propuesto', origen: 'ia' },
  ],
  descartados: [],
};

async function montar(capa: CapaAnio | undefined, puedeEditar: boolean) {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    imports: [DiasInhabilesSeccionComponent],
    providers: [
      { provide: CalendariosJudicialesService, useValue: { obtenerCapa: async () => capa, guardarFusion: async () => undefined } },
      { provide: CompanyService, useValue: { activeCompany: signal({ id: 'c1', ca: 'madrid' }) } },
      { provide: CasosService, useValue: { casos: signal([]), loading: signal(false), loadCasos: vi.fn(async () => undefined) } },
      { provide: PermissionService, useValue: { hasRole: () => puedeEditar, isSuperUser: signal(false) } },
      { provide: UsersService, useValue: { members: signal([]) } },
      { provide: FestivosIaService, useValue: { buscar: async () => ({
        ok: true, capaId: 'ca-madrid', capa: { diasRojos: [], descartados: [] }, añadidos: 2,
        descartadas: [{ fecha: `${ANIO}-03-19`, motivo: 'sin_fuente' }],
        searchEntryPointHtml: '<div><a href="https://www.google.com/search?q=x">festivos</a></div>',
        fuentes: [{ titulo: 'boe.es', uri: 'https://www.boe.es/x' }],
      }) } },
      { provide: UserSyncService, useValue: { currentUser: signal({ id: 'u1' }) } },
      { provide: ToastService, useValue: { run: async (fn: () => Promise<unknown>) => fn() } },
    ],
  });
  const f = TestBed.createComponent(DiasInhabilesSeccionComponent);
  f.detectChanges();
  await f.whenStable();
  f.detectChanges();
  return f;
}

describe('DiasInhabilesSeccionComponent — accesibilidad (axe)', () => {
  it('sin violaciones con días y edición', async () => {
    const f = await montar(CAPA, true);
    const v = await analizarA11y(f.nativeElement);
    expect(v.length, formatearViolaciones(v)).toBe(0);
  });

  it('sin violaciones en solo lectura', async () => {
    const f = await montar(CAPA, false);
    const v = await analizarA11y(f.nativeElement);
    expect(v.length, formatearViolaciones(v)).toBe(0);
  });

  it('sin violaciones con el panel de resultados de la búsqueda (iframe, fuentes y descartadas)', async () => {
    const f = await montar(undefined, true);
    const b = Array.from((f.nativeElement as HTMLElement).querySelectorAll('button')).find((x) => x.textContent?.includes('Buscar festivos oficiales'))!;
    b.click();
    await f.whenStable();
    f.detectChanges();
    const iframe = (f.nativeElement as HTMLElement).querySelector('iframe');
    expect(iframe).not.toBeNull();
    // axe no puede entrar en iframes de jsdom ("Respondable target must be a frame"): se comprueba a mano
    // lo que axe exigiría (nombre accesible) y se analiza el resto del panel sin el iframe.
    expect(iframe!.title.length).toBeGreaterThan(10);
    iframe!.remove();
    const v = await analizarA11y(f.nativeElement);
    expect(v.length, formatearViolaciones(v)).toBe(0);
  });

  it('sin violaciones en estado vacío (aviso + botón de búsqueda)', async () => {
    const f = await montar(undefined, true);
    const v = await analizarA11y(f.nativeElement);
    expect(v.length, formatearViolaciones(v)).toBe(0);
  });
});
