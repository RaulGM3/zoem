import { vi } from 'vitest';
import { AlmacenamientoCupoService } from '../app/core/planes/almacenamiento-cupo.service';
import { PlanService } from '../app/core/planes/plan.service';
import { UsoService } from '../app/core/planes/uso.service';

/**
 * Dobles de pruebas del cupo de almacenamiento para los componentes de subida: por defecto hay espacio para
 * todo y el plan es ilimitado (el medidor no se pinta). Cada test puede cambiar el comportamiento del `cupo`.
 */
export function cupoDePruebas(opciones: { limiteMB?: number; usadoMB?: number } = {}) {
  const cupo = {
    puedeSubir: vi.fn<() => boolean>(() => true),
    admitir: vi.fn<(archivos: readonly File[]) => File[]>((archivos) => [...archivos]),
    asegurar: vi.fn<(bytes: number) => void>(),
  };
  const providers = [
    { provide: AlmacenamientoCupoService, useValue: cupo },
    { provide: PlanService, useValue: { limite: () => opciones.limiteMB ?? Infinity } },
    { provide: UsoService, useValue: { usado: () => opciones.usadoMB ?? 0 } },
  ];
  return { cupo, providers, provider: providers[0] };
}
