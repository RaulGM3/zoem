import { describe, it, expect, vi, beforeEach } from 'vitest';
import { signal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { of } from 'rxjs';
import { provideRouter } from '@angular/router';
import { CalendarioComponent } from './calendario';
import { CasosService } from '../../core/services/casos.service';
import { CompanyService } from '../../core/services/company.service';
import { EventosService } from '../../core/services/eventos.service';
import { ToastService } from '../../core/services/toast.service';
import { UserSyncService } from '../../core/services/user-sync.service';
import { UsersService } from '../../core/services/users';
import { PermissionService } from '../../core/services/permission.service';
import type { Evento } from '../../interfaces';

const EVENTOS = [
  { id: 'e1', companyId: 'c1', titulo: 'Reunión', fecha: '2026-03-10', todoDia: true },
  {
    id: 'p1', companyId: 'c1', titulo: 'Vence plazo', fecha: '2026-03-12', todoDia: true,
    origen: { tipo: 'plazo_procesal', casoId: 'caso9', estadoPlazo: 'requiere_revision' },
  },
] as unknown as Evento[];

const toastRun = vi.fn();

let ultimoFixture: ComponentFixture<CalendarioComponent>;

function montar(puedeVerCasos: boolean) {
  toastRun.mockReset();
  TestBed.resetTestingModule();
  Element.prototype.scrollTo = vi.fn();
  Object.defineProperty(window, 'matchMedia', {
    configurable: true, writable: true,
    value: (q: string) => ({ matches: false, media: q, addEventListener: () => undefined, removeEventListener: () => undefined }),
  });
  TestBed.configureTestingModule({
    imports: [CalendarioComponent],
    providers: [
      provideRouter([]),
      { provide: CasosService, useValue: { hitosParaCalendarioStream: () => of([]) } },
      { provide: CompanyService, useValue: { activeCompany: signal({ id: 'c1' }) } },
      { provide: EventosService, useValue: { eventosStream: () => of(EVENTOS) } },
      { provide: ToastService, useValue: { info: vi.fn(), run: toastRun } },
      { provide: UserSyncService, useValue: { currentUser: signal(null) } },
      { provide: UsersService, useValue: { members: signal([]), loadMembers: vi.fn() } },
      { provide: PermissionService, useValue: { can: (m: string) => m !== 'Casos' || puedeVerCasos, hasRole: () => true, isSuperUser: () => false } },
    ],
  });
  const f = TestBed.createComponent(CalendarioComponent);
  f.detectChanges();
  ultimoFixture = f;
  return f.componentInstance;
}

describe('CalendarioComponent — plazos procesales', () => {
  beforeEach(() => TestBed.resetTestingModule());

  it('con permiso sobre Casos el plazo se mapea con casoId y marca de revisión', () => {
    const items = montar(true).allItems();
    const plazo = items.find((i) => i.id === 'p1')!;
    expect(plazo.casoId).toBe('caso9');
    expect(plazo.plazo).toEqual({ requiereRevision: true });
    expect(items.find((i) => i.id === 'e1')!.plazo).toBeUndefined();
  });

  it('la cabecera muestra el enlace a Días inhábiles', () => {
    montar(true);
    const enlace = (ultimoFixture.nativeElement as HTMLElement).querySelector('app-dias-inhabiles-link a');
    expect(enlace?.textContent).toContain('Días inhábiles');
  });

  it('sin permiso sobre Casos el plazo se oculta y el resto de eventos no', () => {
    const ids = montar(false).allItems().map((i) => i.id);
    expect(ids).toContain('e1');
    expect(ids).not.toContain('p1');
  });

  describe('bloqueo de edición del plazo (se gestiona desde el caso)', () => {
    it('no persiste cambios de hora, estado ni borrado sobre un plazo', async () => {
      const cmp = montar(true);
      await cmp.updateItemTime({ id: 'p1', itemType: 'evento', horaInicio: '10:00', duracionMinutos: 60, date: '2026-03-20' });
      await cmp.updateItemTime({ id: 'p1', itemType: 'evento', horaInicio: null, duracionMinutos: null });
      await cmp.updateEventoEstado({ id: 'p1', estado: 'cancelado' });
      await cmp.onDeleteEvento({ id: 'p1' });
      expect(toastRun).not.toHaveBeenCalled();
    });

    it('un evento normal sigue siendo editable', async () => {
      const cmp = montar(true);
      await cmp.updateEventoEstado({ id: 'e1', estado: 'cancelado' });
      await cmp.onDeleteEvento({ id: 'e1' });
      expect(toastRun).toHaveBeenCalledTimes(2);
    });
  });
});
