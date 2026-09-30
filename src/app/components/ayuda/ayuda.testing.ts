import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import type { Guia, PuedeFn } from '../../core/ayuda/guia';
import { PermissionService } from '../../core/services/permission.service';
import { AyudaComponent, CARGADOR_GUIAS } from './ayuda';

/**
 * Apoyo de test compartido por `ayuda.spec.ts` y `ayuda.a11y.spec.ts`.
 * Usa guías de juguete: así los tests no se rompen cuando cambia el contenido real.
 */
export const GUIAS_DE_PRUEBA: readonly Guia[] = [
  {
    id: 'general',
    titulo: 'Primeros pasos',
    modulo: null,
    ruta: '/',
    resumen: 'Cómo moverte por la aplicación.',
    paraQue: 'Orientarte el primer día.',
    claves: [],
    tareas: [{ id: 'menu', titulo: 'Moverte por el menú', pasos: ['Pulsa una entrada.'], claves: [] }],
  },
  {
    id: 'casos',
    titulo: 'Casos',
    modulo: 'Casos',
    ruta: '/casos',
    resumen: 'Los expedientes del despacho.',
    paraQue: 'Seguir cada asunto.',
    claves: [],
    tareas: [
      { id: 'buscar', titulo: 'Buscar un caso', pasos: ['Usa los filtros.'], claves: [] },
      {
        id: 'crear',
        titulo: 'Crear un caso nuevo',
        pasos: ['Pulsa "Nuevo caso".', 'Pulsa "Crear caso".'],
        claves: [],
        requiere: { modulo: 'Casos', capacidad: 'crear' },
        nota: 'Hace falta un cliente.',
      },
    ],
  },
  {
    id: 'tesoreria',
    titulo: 'Tesorería',
    modulo: 'Tesorería',
    ruta: '/tesoreria',
    resumen: 'Cuentas y movimientos.',
    paraQue: 'Saber cuánto dinero hay.',
    claves: [],
    tareas: [{ id: 'cierre', titulo: 'Hacer un cierre de caja', pasos: ['Pulsa "Cierre de caja".'], claves: [] }],
  },
];

export async function montarAyuda(opts: { puede?: PuedeFn; guia?: string } = {}) {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    imports: [AyudaComponent],
    providers: [
      provideRouter([]),
      { provide: CARGADOR_GUIAS, useValue: async () => GUIAS_DE_PRUEBA },
      { provide: PermissionService, useValue: { can: opts.puede ?? (() => true) } },
    ],
  });

  const fixture = TestBed.createComponent(AyudaComponent);
  if (opts.guia) fixture.componentRef.setInput('guia', opts.guia);
  fixture.detectChanges();
  await fixture.whenStable();
  fixture.detectChanges();
  return fixture;
}

export type FixtureAyuda = Awaited<ReturnType<typeof montarAyuda>>;

/** Teclea en el buscador y espera a que la vista se asiente. */
export async function buscarEnAyuda(fixture: FixtureAyuda, texto: string): Promise<void> {
  const input = fixture.nativeElement.querySelector('input[type="search"]') as HTMLInputElement;
  input.value = texto;
  input.dispatchEvent(new Event('input'));
  fixture.detectChanges();
  await fixture.whenStable();
  fixture.detectChanges();
}
