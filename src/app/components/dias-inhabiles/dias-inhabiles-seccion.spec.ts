import { describe, it, expect, vi, beforeEach } from 'vitest';
import { signal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { DiasInhabilesSeccionComponent } from './dias-inhabiles-seccion';
import { CalendariosJudicialesService } from '../../core/services/calendarios-judiciales.service';
import { CompanyService } from '../../core/services/company.service';
import { CasosService } from '../../core/services/casos.service';
import { PermissionService } from '../../core/services/permission.service';
import { UsersService } from '../../core/services/users';
import { UserSyncService } from '../../core/services/user-sync.service';
import { FestivosIaService, type BusquedaFestivosOk } from '../../core/services/festivos-ia.service';
import { ToastService } from '../../core/services/toast.service';
import type { CapaAnio } from '../../core/plazos/dias-rojos';

const ANIO = new Date().getFullYear();

const CAPA: CapaAnio = {
  diasRojos: [
    { fecha: `${ANIO}-01-01`, nombre: 'Año Nuevo', ambito: 'nacional', estado: 'confirmado', origen: 'ia', fuenteUrl: 'https://www.boe.es/x' },
    { fecha: `${ANIO}-05-02`, nombre: 'Fiesta de la Comunidad', ambito: 'autonomico', estado: 'propuesto', origen: 'ia', fuenteUrl: 'https://www.madrid.org/y' },
    { fecha: `${ANIO}-09-10`, nombre: 'Cierre del despacho', ambito: 'personalizado', estado: 'confirmado', origen: 'manual' },
  ],
  descartados: [],
  ultimaBusquedaIa: { ejecutadaAt: `${ANIO}-02-03T10:00:00.000Z`, ejecutadaPor: 'u1', propuestos: 2 },
};

const RESULTADO_OK: BusquedaFestivosOk = {
  ok: true,
  capaId: 'ca-madrid',
  capa: { diasRojos: [], descartados: [] },
  añadidos: 3,
  descartadas: [
    { fecha: `${ANIO}-03-19`, motivo: 'sin_fuente' },
    { fecha: `${ANIO}-12-08`, motivo: 'dominio_no_oficial' },
  ],
  searchEntryPointHtml: '<div class="container"><a class="chip" href="https://www.google.com/search?q=festivos">festivos madrid</a></div>',
  fuentes: [{ titulo: 'boe.es', uri: 'https://vertexaisearch.cloud.google.com/r/1' }],
};

interface Opciones {
  capa?: CapaAnio | undefined;
  puedeEditar?: boolean;
  casos?: { id: string; partidoJudicialId?: string }[];
  ca?: string | null;
  falla?: boolean;
  buscar?: () => Promise<unknown>;
}

function montar(o: Opciones = {}) {
  const svc = {
    obtenerCapa: vi.fn(async () => {
      if (o.falla) throw new Error('boom');
      return 'capa' in o ? o.capa : CAPA;
    }),
    añadirManual: vi.fn(async () => undefined),
    quitar: vi.fn(async () => undefined),
    confirmar: vi.fn(async () => undefined),
    confirmarTodos: vi.fn(async () => undefined),
    guardarFusion: vi.fn(async () => undefined),
  };
  const festivos = { buscar: vi.fn(o.buscar ?? (async () => RESULTADO_OK)) };
  const casosSvc = { casos: signal(o.casos ?? []), loading: signal(false), loadCasos: vi.fn(async () => undefined) };
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    imports: [DiasInhabilesSeccionComponent],
    providers: [
      { provide: CalendariosJudicialesService, useValue: svc },
      { provide: CompanyService, useValue: { activeCompany: signal({ id: 'c1', ca: o.ca === null ? undefined : (o.ca ?? 'madrid') }) } },
      { provide: CasosService, useValue: casosSvc },
      { provide: PermissionService, useValue: { hasRole: () => o.puedeEditar ?? true, isSuperUser: signal(false) } },
      { provide: UsersService, useValue: { members: signal([{ userId: 'u1', nombre: 'Ana', apellido: 'Pérez' }]) } },
      { provide: FestivosIaService, useValue: festivos },
      { provide: UserSyncService, useValue: { currentUser: signal({ id: 'u1' }) } },
      { provide: ToastService, useValue: { run: async (fn: () => Promise<unknown>) => fn() } },
    ],
  });
  const f: ComponentFixture<DiasInhabilesSeccionComponent> = TestBed.createComponent(DiasInhabilesSeccionComponent);
  f.detectChanges();
  return { f, svc, festivos, casosSvc, el: f.nativeElement as HTMLElement };
}

async function estable(f: ComponentFixture<unknown>) {
  await f.whenStable();
  f.detectChanges();
}

const boton = (el: HTMLElement, texto: string) =>
  Array.from(el.querySelectorAll('button')).find((b) => b.textContent?.trim().includes(texto));

describe('DiasInhabilesSeccionComponent', () => {
  beforeEach(() => TestBed.resetTestingModule());

  it('h2 enfocable y carga la capa de la CA de la empresa para el año actual', async () => {
    const { f, svc, el } = montar();
    await estable(f);
    const h = el.querySelector('h2#config-detalle-titulo')!;
    expect(h.textContent).toContain('Días inhábiles');
    expect(h.getAttribute('tabindex')).toBe('-1');
    expect(svc.obtenerCapa).toHaveBeenCalledWith('ca-madrid', ANIO);
  });

  it('agrupa por ámbito y muestra fecha, nombre, estado, origen y fuente', async () => {
    const { f, el } = montar();
    await estable(f);
    const titulos = Array.from(el.querySelectorAll('h4')).map((h) => h.textContent?.trim());
    expect(titulos).toEqual(['Nacional', 'Autonómico', 'Personalizado']);
    const txt = el.textContent!;
    expect(txt).toContain(`01/01/${ANIO}`);
    expect(txt).toContain('Año Nuevo');
    expect(txt).toContain('Confirmado');
    expect(txt).toContain('Propuesto · pendiente de revisar');
    expect(txt).toContain('IA');
    expect(txt).toContain('Manual');
    const link = el.querySelector<HTMLAnchorElement>('a[href="https://www.boe.es/x"]')!;
    expect(link.target).toBe('_blank');
    expect(link.rel).toContain('noopener');
    expect(link.getAttribute('aria-label')).toContain('Año Nuevo');
  });

  it('muestra la última búsqueda con el nombre del usuario', async () => {
    const { f, el } = montar();
    await estable(f);
    expect(el.textContent).toContain('Última búsqueda:');
    expect(el.textContent).toContain('Ana Pérez');
  });

  it('sin días confirmados: aviso y botón de búsqueda habilitado para quien puede editar', async () => {
    const { f, el } = montar({ capa: undefined });
    await estable(f);
    expect(el.textContent).toContain(`No hay días inhábiles confirmados para ${ANIO} en`);
    const b = boton(el, `Buscar festivos oficiales ${ANIO}`)!;
    expect(b.disabled).toBe(false);
    expect(el.textContent).not.toContain('Disponible próximamente');
  });

  it('solo lectura: no hay botón de búsqueda', async () => {
    const { f, el } = montar({ puedeEditar: false, capa: undefined });
    await estable(f);
    expect(boton(el, 'Buscar festivos oficiales')).toBeUndefined();
  });

  describe('búsqueda de festivos con IA', () => {
    const SIN_PREVIA: CapaAnio = { diasRojos: [], descartados: [] };

    it('sin búsqueda previa: busca directo, guarda la fusión con la marca y muestra el panel de resultados', async () => {
      const { f, svc, festivos, el } = montar({ capa: SIN_PREVIA });
      await estable(f);
      boton(el, `Buscar festivos oficiales ${ANIO}`)!.click();
      await estable(f);
      expect(festivos.buscar).toHaveBeenCalledWith({ tipo: 'autonomica', ca: 'madrid' }, ANIO);
      expect(svc.guardarFusion).toHaveBeenCalledWith(
        'ca-madrid', ANIO, RESULTADO_OK.capa,
        { ejecutadaAt: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/), ejecutadaPor: 'u1', propuestos: 3 },
      );
      expect(svc.obtenerCapa).toHaveBeenCalledTimes(2);
      const txt = el.textContent!;
      expect(txt).toContain('3 días propuestos');
      expect(txt).toContain('pendientes de revisar');
      expect(txt).toContain('No indicaba una fuente oficial.');
      expect(txt).toContain('La fuente no es un sitio oficial');
      const fuente = el.querySelector<HTMLAnchorElement>('a[href="https://vertexaisearch.cloud.google.com/r/1"]')!;
      expect(fuente.textContent).toContain('boe.es');
      expect(fuente.target).toBe('_blank');
      expect(fuente.rel).toContain('noopener');
    });

    it('sugerencias de Google Search en un iframe aislado (sandbox sin scripts ni same-origin) y con título accesible', async () => {
      const { f, el } = montar({ capa: SIN_PREVIA });
      await estable(f);
      boton(el, `Buscar festivos oficiales ${ANIO}`)!.click();
      await estable(f);
      const iframe = el.querySelector<HTMLIFrameElement>('iframe')!;
      const sandbox = iframe.getAttribute('sandbox')!;
      expect(sandbox).not.toContain('allow-scripts');
      expect(sandbox).not.toContain('allow-same-origin');
      expect(iframe.title).toContain('Google');
      expect(iframe.srcdoc).toContain('festivos madrid');
      expect(iframe.srcdoc).toContain('class="chip"');
    });

    it('sin searchEntryPoint no hay iframe', async () => {
      const { f, el } = montar({ capa: SIN_PREVIA, buscar: async () => ({ ...RESULTADO_OK, searchEntryPointHtml: undefined }) });
      await estable(f);
      boton(el, `Buscar festivos oficiales ${ANIO}`)!.click();
      await estable(f);
      expect(el.querySelector('iframe')).toBeNull();
    });

    it('mientras busca: aria-busy, botón deshabilitado y mensaje de estado', async () => {
      let fin!: (v: unknown) => void;
      const { f, el } = montar({ capa: SIN_PREVIA, buscar: () => new Promise((r) => { fin = r; }) });
      await estable(f);
      const b = boton(el, `Buscar festivos oficiales ${ANIO}`)!;
      b.click();
      f.detectChanges();
      expect(el.querySelector('[aria-busy="true"]')).not.toBeNull();
      expect(b.disabled).toBe(true);
      expect(el.querySelector('[role="status"]')?.textContent).toContain('Buscando');
      fin(RESULTADO_OK);
      for (let i = 0; i < 10; i++) await Promise.resolve();
      await estable(f);
      expect(el.querySelector('[aria-busy="true"]')).toBeNull();
    });

    it('con búsqueda previa pide confirmación con fecha y usuario; cancelar no busca', async () => {
      const { f, festivos, el } = montar();
      await estable(f);
      boton(el, `Buscar festivos oficiales ${ANIO}`)!.click();
      await estable(f);
      expect(el.textContent).toContain(`Ya se buscó el 03/02/${ANIO} por Ana Pérez. ¿Volver a buscar?`);
      expect(festivos.buscar).not.toHaveBeenCalled();
      boton(el, 'Cancelar')!.click();
      await estable(f);
      expect(festivos.buscar).not.toHaveBeenCalled();
      expect(el.textContent).not.toContain('¿Volver a buscar?');
    });

    it('confirmar la nueva búsqueda la ejecuta', async () => {
      const { f, svc, festivos, el } = montar();
      await estable(f);
      boton(el, `Buscar festivos oficiales ${ANIO}`)!.click();
      await estable(f);
      boton(el, 'Sí, volver a buscar')!.click();
      await estable(f);
      expect(festivos.buscar).toHaveBeenCalledTimes(1);
      expect(svc.guardarFusion).toHaveBeenCalledTimes(1);
    });

    it('enfriamiento de 24 h: botón deshabilitado y "Podrás volver a buscar a partir de"', async () => {
      const reciente: CapaAnio = { ...SIN_PREVIA, ultimaBusquedaIa: { ejecutadaAt: new Date().toISOString(), ejecutadaPor: 'u1', propuestos: 1 } };
      const { f, festivos, el } = montar({ capa: reciente });
      await estable(f);
      const b = boton(el, `Buscar festivos oficiales ${ANIO}`)!;
      expect(b.disabled).toBe(true);
      expect(el.textContent).toContain('Podrás volver a buscar a partir de');
      expect(b.getAttribute('aria-describedby')).toBeTruthy();
      b.click();
      await estable(f);
      expect(festivos.buscar).not.toHaveBeenCalled();
    });

    it('error de la búsqueda: alerta amable y no se guarda nada', async () => {
      const { f, svc, el } = montar({ capa: SIN_PREVIA, buscar: async () => ({ ok: false, mensaje: 'El asistente está saturado.' }) });
      await estable(f);
      boton(el, `Buscar festivos oficiales ${ANIO}`)!.click();
      await estable(f);
      expect(el.querySelector('[role="alert"]')?.textContent).toContain('El asistente está saturado.');
      expect(svc.guardarFusion).not.toHaveBeenCalled();
      expect(el.textContent).not.toContain('días propuestos');
    });

    it('si falla el guardado: alerta y sin panel de resultados', async () => {
      const { f, svc, el } = montar({ capa: SIN_PREVIA });
      await estable(f);
      svc.guardarFusion.mockRejectedValueOnce(new Error('permission-denied'));
      boton(el, `Buscar festivos oficiales ${ANIO}`)!.click();
      await estable(f);
      expect(el.querySelector('[role="alert"]')?.textContent).toContain('No se pudo guardar');
      expect(el.textContent).not.toContain('días propuestos');
    });

    it('cambiar de año limpia el panel de resultados', async () => {
      const { f, el } = montar({ capa: SIN_PREVIA });
      await estable(f);
      boton(el, `Buscar festivos oficiales ${ANIO}`)!.click();
      await estable(f);
      expect(el.textContent).toContain('3 días propuestos');
      const sel = el.querySelector<HTMLSelectElement>('select[name="anio"]')!;
      sel.value = String(ANIO + 1);
      sel.dispatchEvent(new Event('change'));
      await estable(f);
      expect(el.textContent).not.toContain('3 días propuestos');
    });
  });

  it('con días confirmados no hay aviso', async () => {
    const { f, el } = montar();
    await estable(f);
    expect(el.textContent).not.toContain('No hay días inhábiles confirmados');
  });

  it('cambiar de año recarga la capa', async () => {
    const { f, svc, el } = montar();
    await estable(f);
    const sel = el.querySelector<HTMLSelectElement>('select[name="anio"]')!;
    sel.value = String(ANIO + 1);
    sel.dispatchEvent(new Event('change'));
    await estable(f);
    expect(svc.obtenerCapa).toHaveBeenLastCalledWith('ca-madrid', ANIO + 1);
  });

  it('incluye capas de partidos judiciales presentes en los casos', async () => {
    const { f, svc, el } = montar({ casos: [{ id: 'k1', partidoJudicialId: '28-1' }] });
    await estable(f);
    const opciones = Array.from(el.querySelectorAll('select[name="capa"] option')).map((o) => (o as HTMLOptionElement).value);
    expect(opciones).toContain('pj-28-1');
    const sel = el.querySelector<HTMLSelectElement>('select[name="capa"]')!;
    sel.value = 'pj-28-1';
    sel.dispatchEvent(new Event('change'));
    await estable(f);
    expect(svc.obtenerCapa).toHaveBeenLastCalledWith('pj-28-1', ANIO);
  });

  it('carga los casos si aún no están cargados', async () => {
    const { f, casosSvc } = montar();
    await estable(f);
    expect(casosSvc.loadCasos).toHaveBeenCalled();
  });

  it('solo lectura: sin acciones de edición', async () => {
    const { f, el } = montar({ puedeEditar: false });
    await estable(f);
    expect(boton(el, 'Confirmar')).toBeUndefined();
    expect(boton(el, 'Quitar')).toBeUndefined();
    expect(el.querySelector('form')).toBeNull();
    expect(el.textContent).toContain('Solo lectura');
  });

  it('confirmar un día propuesto y recargar', async () => {
    const { f, svc, el } = montar();
    await estable(f);
    boton(el, 'Confirmar día')!.click();
    await estable(f);
    expect(svc.confirmar).toHaveBeenCalledWith('ca-madrid', ANIO, `${ANIO}-05-02`);
    expect(svc.obtenerCapa).toHaveBeenCalledTimes(2);
  });

  it('confirmar todos los propuestos', async () => {
    const { f, svc, el } = montar();
    await estable(f);
    boton(el, 'Confirmar todos los propuestos')!.click();
    await estable(f);
    expect(svc.confirmarTodos).toHaveBeenCalledWith('ca-madrid', ANIO);
  });

  it('quitar pide confirmación y solo entonces elimina', async () => {
    const { f, svc, el } = montar();
    await estable(f);
    boton(el, 'Quitar Año Nuevo')!.click();
    await estable(f);
    expect(svc.quitar).not.toHaveBeenCalled();
    expect(el.textContent).toContain('¿Quitar este día inhábil?');
    boton(el, 'Cancelar')!.click();
    await estable(f);
    expect(svc.quitar).not.toHaveBeenCalled();
    boton(el, 'Quitar Año Nuevo')!.click();
    await estable(f);
    boton(el, 'Sí, quitar')!.click();
    await estable(f);
    expect(svc.quitar).toHaveBeenCalledWith('ca-madrid', ANIO, `${ANIO}-01-01`);
  });

  it('añadir día manual con fecha, nombre y ámbito', async () => {
    const { f, svc, el } = montar();
    await estable(f);
    const set = (id: string, v: string, ev = 'input') => {
      const c = el.querySelector<HTMLInputElement | HTMLSelectElement>(`#${id}`)!;
      c.value = v;
      c.dispatchEvent(new Event(ev));
    };
    set('dia-fecha', `${ANIO}-12-24`);
    set('dia-nombre', 'Nochebuena local');
    set('dia-ambito', 'local', 'change');
    f.detectChanges();
    el.querySelector('form')!.dispatchEvent(new Event('submit'));
    await estable(f);
    expect(svc.añadirManual).toHaveBeenCalledWith('ca-madrid', ANIO, { fecha: `${ANIO}-12-24`, nombre: 'Nochebuena local', ambito: 'local' });
  });

  it('no añade si la fecha es de otro año o falta el nombre', async () => {
    const { f, svc, el } = montar();
    await estable(f);
    const c = el.querySelector<HTMLInputElement>('#dia-fecha')!;
    c.value = `${ANIO + 1}-01-06`;
    c.dispatchEvent(new Event('input'));
    f.detectChanges();
    el.querySelector('form')!.dispatchEvent(new Event('submit'));
    await estable(f);
    expect(svc.añadirManual).not.toHaveBeenCalled();
    expect(el.textContent).toContain(`La fecha debe ser de ${ANIO}`);
  });

  it('estado de error con alerta y reintento', async () => {
    const { f, el } = montar({ falla: true });
    await estable(f);
    expect(el.querySelector('[role="alert"]')?.textContent).toContain('No se pudieron cargar');
    expect(boton(el, 'Reintentar')).toBeDefined();
  });

  it('empresa sin comunidad autónoma y sin partidos: estado vacío informativo', async () => {
    const { f, svc, el } = montar({ ca: null });
    await estable(f);
    expect(el.textContent).toContain('no tiene comunidad autónoma');
    expect(el.querySelector('select[name="capa"]')).toBeNull();
    expect(svc.obtenerCapa).not.toHaveBeenCalled();
  });
});
