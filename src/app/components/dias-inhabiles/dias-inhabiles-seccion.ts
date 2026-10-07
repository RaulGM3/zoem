import {
  ChangeDetectionStrategy, Component, computed, effect, inject, signal, untracked,
} from '@angular/core';
import { DomSanitizer, type SafeHtml } from '@angular/platform-browser';
import { FormBuilder, ReactiveFormsModule, Validators, type AbstractControl, type ValidationErrors } from '@angular/forms';
import { LucideAngularModule, Check, CheckCheck, ExternalLink, Plus, Search, Trash2, TriangleAlert } from 'lucide-angular';
import { OverlayShellComponent } from '../../shared/components/overlay-shell/overlay-shell';
import { CalendariosJudicialesService } from '../../core/services/calendarios-judiciales.service';
import { CasosService } from '../../core/services/casos.service';
import { CompanyService } from '../../core/services/company.service';
import { PermissionService } from '../../core/services/permission.service';
import { ToastService } from '../../core/services/toast.service';
import { UsersService } from '../../core/services/users';
import { UserSyncService } from '../../core/services/user-sync.service';
import { FestivosIaService, type BusquedaFestivosOk } from '../../core/services/festivos-ia.service';
import { capaBusquedaDesdeId, puedeBuscar } from '../../core/plazos/festivos-ia';
import type { AmbitoDiaRojo, CapaAnio, DiaRojo } from '../../core/plazos/dias-rojos';
import { formatearFechaEs } from '../../core/plazos/plazo-evento';
import {
  AMBITO_LABEL, agruparPorAmbito, capasEnUso, fechaConDiaSemana, hayConfirmados, textoDescarte,
} from '../../core/plazos/vista-dias-inhabiles';

/**
 * Configuración > Días inhábiles (BETA): revisión y edición de las capas de días rojos
 * (comunidad autónoma y partidos judiciales) que usa el cómputo de plazos procesales.
 * Solo los días confirmados cuentan; los propuestos esperan revisión humana.
 */
@Component({
  selector: 'app-dias-inhabiles-seccion',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, LucideAngularModule, OverlayShellComponent],
  templateUrl: './dias-inhabiles-seccion.html',
})
export class DiasInhabilesSeccionComponent {
  private readonly calendarios = inject(CalendariosJudicialesService);
  private readonly company = inject(CompanyService);
  private readonly casosService = inject(CasosService);
  private readonly permission = inject(PermissionService);
  private readonly users = inject(UsersService);
  private readonly toast = inject(ToastService);
  private readonly festivos = inject(FestivosIaService);
  private readonly userSync = inject(UserSyncService);
  private readonly sanitizer = inject(DomSanitizer);
  private readonly fb = inject(FormBuilder).nonNullable;

  readonly CheckIcon = Check;
  readonly CheckCheckIcon = CheckCheck;
  readonly ExternalLinkIcon = ExternalLink;
  readonly PlusIcon = Plus;
  readonly SearchIcon = Search;
  readonly Trash2Icon = Trash2;
  readonly AlertIcon = TriangleAlert;

  readonly ambitos = Object.entries(AMBITO_LABEL) as [AmbitoDiaRojo, string][];
  readonly fechaConDiaSemana = fechaConDiaSemana;

  /** Edición permitida a Admin/Gestor (misma regla que firestore.rules para calendariosJudiciales). */
  readonly puedeEditar = computed(() => this.permission.hasRole('Admin', 'Gestor') || this.permission.isSuperUser());

  /** Años seleccionables: el actual y el siguiente. */
  readonly anios: readonly number[] = (() => {
    const actual = new Date().getFullYear();
    return [actual, actual + 1];
  })();
  readonly anio = signal(this.anios[0]);

  readonly capas = computed(() =>
    capasEnUso(this.casosService.casos(), this.company.activeCompany()?.ca),
  );
  private readonly capaElegida = signal<string | null>(null);
  readonly capaActiva = computed(() => {
    const elegida = this.capaElegida();
    const capas = this.capas();
    return capas.find((c) => c.id === elegida) ?? capas[0] ?? null;
  });

  readonly capa = signal<CapaAnio | undefined>(undefined);
  readonly cargando = signal(false);
  readonly error = signal(false);
  readonly ocupado = signal(false);
  readonly diaAQuitar = signal<DiaRojo | null>(null);

  readonly grupos = computed(() => agruparPorAmbito(this.capa()?.diasRojos ?? []));
  readonly sinConfirmados = computed(() => !this.cargando() && !this.error() && !hayConfirmados(this.capa()));
  readonly hayPropuestos = computed(() => (this.capa()?.diasRojos ?? []).some((d) => d.estado === 'propuesto'));
  readonly ultimaBusqueda = computed(() => {
    const b = this.capa()?.ultimaBusquedaIa;
    if (!b) return null;
    const miembro = this.users.members().find((m) => m.userId === b.ejecutadaPor);
    const nombre = miembro ? `${miembro.nombre} ${miembro.apellido ?? ''}`.trim() : 'un usuario del despacho';
    return { fecha: formatearFechaEs(b.ejecutadaAt.slice(0, 10)), nombre };
  });

  // ---- búsqueda de festivos oficiales con IA (manual, con enfriamiento de 24 h)
  readonly buscando = signal(false);
  readonly confirmarRebusqueda = signal(false);
  readonly errorBusqueda = signal<string | null>(null);
  readonly resultado = signal<BusquedaFestivosOk | null>(null);
  readonly textoDescarte = textoDescarte;
  private readonly ahoraIso = signal(new Date().toISOString());

  readonly textoPropuestos = computed(() => {
    const n = this.resultado()?.añadidos ?? 0;
    return `${n} ${n === 1 ? 'día propuesto' : 'días propuestos'}`;
  });
  readonly estadoBusqueda = computed(() => puedeBuscar(this.capa()?.ultimaBusquedaIa, this.ahoraIso()));
  readonly disponibleDesde = computed(() => {
    const e = this.estadoBusqueda();
    return e.puede ? null : new Date(e.desde).toLocaleString('es-ES', { dateStyle: 'short', timeStyle: 'short' });
  });
  readonly botonBuscarDeshabilitado = computed(
    () => this.buscando() || this.cargando() || this.error() || !this.estadoBusqueda().puede || !capaBusquedaDesdeId(this.capaActiva()?.id ?? ''),
  );

  /**
   * HTML de las sugerencias de Google Search (searchEntryPoint). Es contenido de Google que Google exige
   * mostrar con su estilo, así que hay que saltarse la sanitización de Angular (que borraría su <style>).
   * Es seguro porque se pinta SOLO dentro de un <iframe sandbox> sin `allow-scripts` ni `allow-same-origin`:
   * no puede ejecutar código ni tocar la sesión, el DOM o el almacenamiento de la app.
   * El <base target="_blank"> hace que los enlaces abran en pestaña nueva (permitido por allow-popups).
   */
  readonly sugerenciasGoogle = computed<SafeHtml | null>(() => {
    const html = this.resultado()?.searchEntryPointHtml;
    return html ? this.sanitizer.bypassSecurityTrustHtml(`<base target="_blank">${html}`) : null;
  });

  readonly form = this.fb.group({
    fecha: ['', [Validators.required, (c: AbstractControl): ValidationErrors | null => this.validarAnio(c)]],
    nombre: ['', [Validators.required, Validators.maxLength(120)]],
    ambito: ['personalizado' as AmbitoDiaRojo, Validators.required],
  });
  readonly intentoEnvio = signal(false);

  private peticion = 0;

  constructor() {
    if (this.casosService.casos().length === 0) void this.casosService.loadCasos();
    effect(() => {
      const capa = this.capaActiva();
      const anio = this.anio();
      untracked(() => {
        this.resultado.set(null);
        this.errorBusqueda.set(null);
        this.form.controls.fecha.updateValueAndValidity();
        if (capa) void this.cargar(capa.id, anio);
      });
    });
  }

  private validarAnio(c: AbstractControl): ValidationErrors | null {
    const v = c.value as string;
    return v && !v.startsWith(`${this.anio()}-`) ? { otroAnio: true } : null;
  }

  elegirCapa(id: string): void {
    this.capaElegida.set(id);
  }

  elegirAnio(valor: string): void {
    this.anio.set(Number(valor));
  }

  async cargar(capaId: string, anio: number): Promise<void> {
    const n = ++this.peticion;
    this.ahoraIso.set(new Date().toISOString());
    this.cargando.set(true);
    this.error.set(false);
    try {
      const capa = await this.calendarios.obtenerCapa(capaId, anio);
      if (n !== this.peticion) return;
      this.capa.set(capa);
    } catch {
      if (n !== this.peticion) return;
      this.error.set(true);
    } finally {
      if (n === this.peticion) this.cargando.set(false);
    }
  }

  reintentar(): void {
    const capa = this.capaActiva();
    if (capa) void this.cargar(capa.id, this.anio());
  }

  private async ejecutar(accion: (capaId: string, anio: number) => Promise<void>, ok: string): Promise<void> {
    const capa = this.capaActiva();
    if (!capa || this.ocupado()) return;
    this.ocupado.set(true);
    try {
      await this.toast.run(() => accion(capa.id, this.anio()), {
        successMessage: ok,
        errorTitle: 'No se pudo guardar el cambio',
      });
      await this.cargar(capa.id, this.anio());
    } finally {
      this.ocupado.set(false);
    }
  }

  confirmar(dia: DiaRojo): Promise<void> {
    return this.ejecutar((c, a) => this.calendarios.confirmar(c, a, dia.fecha), 'Día inhábil confirmado');
  }

  confirmarTodos(): Promise<void> {
    return this.ejecutar((c, a) => this.calendarios.confirmarTodos(c, a), 'Días propuestos confirmados');
  }

  pedirQuitar(dia: DiaRojo): void {
    this.diaAQuitar.set(dia);
  }

  cancelarQuitar(): void {
    this.diaAQuitar.set(null);
  }

  async quitarConfirmado(): Promise<void> {
    const dia = this.diaAQuitar();
    if (!dia) return;
    this.diaAQuitar.set(null);
    await this.ejecutar((c, a) => this.calendarios.quitar(c, a, dia.fecha), 'Día inhábil quitado');
  }

  async anadirManual(): Promise<void> {
    this.intentoEnvio.set(true);
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const { fecha, nombre, ambito } = this.form.getRawValue();
    await this.ejecutar(
      (c, a) => this.calendarios.añadirManual(c, a, { fecha, nombre: nombre.trim(), ambito }),
      'Día inhábil añadido',
    );
    this.form.reset({ fecha: '', nombre: '', ambito: 'personalizado' });
    this.intentoEnvio.set(false);
  }

  mostrarError(campo: 'fecha' | 'nombre'): boolean {
    const c = this.form.controls[campo];
    return c.invalid && (c.touched || this.intentoEnvio());
  }

  /** Botón "Buscar": si ya hubo una búsqueda, pide confirmación antes de gastar otra. */
  pedirBusqueda(): void {
    if (this.botonBuscarDeshabilitado()) return;
    if (this.capa()?.ultimaBusquedaIa) this.confirmarRebusqueda.set(true);
    else void this.buscarFestivos();
  }

  cancelarRebusqueda(): void {
    this.confirmarRebusqueda.set(false);
  }

  async confirmarYBuscar(): Promise<void> {
    this.confirmarRebusqueda.set(false);
    await this.buscarFestivos();
  }

  private async buscarFestivos(): Promise<void> {
    const capa = this.capaActiva();
    const anio = this.anio();
    const parametros = capa ? capaBusquedaDesdeId(capa.id) : null;
    const uid = this.userSync.currentUser()?.id;
    if (!capa || !parametros || !uid || this.buscando()) return;
    this.buscando.set(true);
    this.errorBusqueda.set(null);
    this.resultado.set(null);
    try {
      const r = await this.festivos.buscar(parametros, anio);
      if (!r.ok) {
        this.errorBusqueda.set(r.mensaje);
        return;
      }
      try {
        await this.calendarios.guardarFusion(capa.id, anio, r.capa, {
          ejecutadaAt: new Date().toISOString(),
          ejecutadaPor: uid,
          propuestos: r.añadidos,
        });
      } catch {
        this.errorBusqueda.set('No se pudo guardar el resultado de la búsqueda. Inténtalo de nuevo.');
        return;
      }
      // Si el usuario cambió de calendario o de año mientras buscaba, el panel no le corresponde.
      if (this.capaActiva()?.id === capa.id && this.anio() === anio) {
        this.resultado.set(r);
        await this.cargar(capa.id, anio);
      }
    } finally {
      this.buscando.set(false);
    }
  }
}

