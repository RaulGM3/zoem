import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { vi } from 'vitest';
import { PlazoDrawerComponent } from '../app/components/caso-detail/components/plazo-drawer/plazo-drawer';
import { PlazosService } from '../app/core/services/plazos.service';
import type { EntradaPrevisualizacion, Previsualizacion } from '../app/core/services/plazos.service';
import { ToastService } from '../app/core/services/toast.service';
import type { Evento } from '../app/interfaces/evento.interface';

export const FESTIVO = { fecha: '2026-10-12', motivo: 'festivo', etiqueta: 'Fiesta Nacional de España' } as const;

/** Cálculo falso: el 12/10 alarga el plazo salvo que el usuario lo excluya. */
export function previsualizacionFalsa(e: EntradaPrevisualizacion, advertencias: string[] = []): Previsualizacion {
  const excluido = e.excluidosPorUsuario?.includes(FESTIVO.fecha) ?? false;
  return {
    resultado: {
      inicio: '2026-10-08',
      vencimiento: excluido ? '2026-10-21' : '2026-10-22',
      diaGracia: excluido ? '2026-10-22' : '2026-10-23',
      diasInhabiles: excluido ? [] : [FESTIVO],
      advertencias,
    },
    capas: { ca: 'ca-madrid', partido: 'pj-28-4', advertencias: [] },
    fuentes: { [FESTIVO.fecha]: 'https://www.boe.es/diario_boe/txt.php?id=BOE-A-2025-0001' },
    advertencias,
  };
}

export interface Mocks {
  previsualizar: ReturnType<typeof vi.fn>;
  guardar: ReturnType<typeof vi.fn>;
  aceptarRevision: ReturnType<typeof vi.fn>;
}

export async function montarDrawer(opciones: { advertencias?: string[]; canEdit?: boolean; plazoRevision?: Evento | null; errorPrevisualizar?: Error } = {}): Promise<{
  f: ComponentFixture<PlazoDrawerComponent>;
  raiz: HTMLElement;
  mocks: Mocks;
}> {
  const mocks: Mocks = {
    previsualizar: vi.fn(async (e: EntradaPrevisualizacion) => {
      if (opciones.errorPrevisualizar) throw opciones.errorPrevisualizar;
      return previsualizacionFalsa(e, opciones.advertencias);
    }),
    guardar: vi.fn().mockResolvedValue({}),
    aceptarRevision: vi.fn().mockResolvedValue(undefined),
  };
  TestBed.resetTestingModule();
  await TestBed.configureTestingModule({
    imports: [PlazoDrawerComponent],
    providers: [
      { provide: PlazosService, useValue: mocks },
      {
        provide: ToastService,
        useValue: {
          run: async (fn: () => Promise<unknown>, o?: { onSuccess?: () => void }) => {
            await fn();
            o?.onSuccess?.();
            return true;
          },
        },
      },
    ],
  }).compileComponents();
  const f = TestBed.createComponent(PlazoDrawerComponent);
  f.componentRef.setInput('visible', true);
  f.componentRef.setInput('caso', { id: 'caso1', titulo: 'Pérez vs. Gómez', jurisdiccion: 'civil', partidoJudicialId: '28-4' });
  f.componentRef.setInput('canEdit', opciones.canEdit ?? true);
  f.componentRef.setInput('plazoRevision', opciones.plazoRevision ?? null);
  f.detectChanges();
  return { f, raiz: document.body, mocks };
}

export const escribirEn = (f: ComponentFixture<PlazoDrawerComponent>, selector: string, valor: string, evento: 'input' | 'change' = 'input'): void => {
  const el = document.body.querySelector<HTMLInputElement | HTMLSelectElement>(selector)!;
  el.value = valor;
  el.dispatchEvent(new Event(evento, { bubbles: true }));
  f.detectChanges();
};

/** Avanza el debounce y deja resolver la vista previa. */
export async function esperarCalculo(f: ComponentFixture<PlazoDrawerComponent>): Promise<void> {
  await vi.advanceTimersByTimeAsync(400);
  f.detectChanges();
  await Promise.resolve();
  f.detectChanges();
}

export async function rellenarPlazoValido(f: ComponentFixture<PlazoDrawerComponent>): Promise<void> {
  escribirEn(f, '#plazo-fecha', '2026-10-07');
  escribirEn(f, '#plazo-cantidad', '10');
  await esperarCalculo(f);
}

