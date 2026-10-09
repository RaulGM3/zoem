import { Component, signal, computed, inject, effect, ChangeDetectionStrategy } from '@angular/core';
import { SkeletonComponent } from '../../shared/components/skeleton/skeleton';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DecimalPipe } from '@angular/common';
import { RouterLink, ActivatedRoute, Router, type ParamMap } from '@angular/router';
import {
  LucideAngularModule,
  Users, Plus, Phone, Mail, Building2,
  Edit, Trash2, ChevronRight, ChevronLeft, UserPlus, TrendingUp,
  GitMerge, Shield, Brain, ArrowRight, X, Check, StickyNote, Briefcase, Send, SlidersHorizontal,
} from 'lucide-angular';
// import { PIPELINE_DEALS } from '../../data/dummy-data'; // dummy data — tab oculto
import { ContactService } from '../../core/services/contact.service';
import { UsersService } from '../../core/services/users';
import { SearchService } from '../../core/services/search.service';
import { PermissionService } from '../../core/services/permission.service';
import { BloqueoPlanService } from '../../core/planes/bloqueo-plan.service';
import { ToastService } from '../../core/services/toast.service';
import {
  Contact, ContactStatus,
  CONTACT_STATUS_LABELS, CONTACT_STATUS_OPTIONS,
  getContactDisplayName, getContactInitials, getContactStatusStyle,
} from '../../interfaces';
import { ImportarContactosComponent } from './components/importar-contactos/importar-contactos';
import { ContactoDrawerComponent, type ContactoPrefill } from './components/contacto-drawer/contacto-drawer';
import {
  EstadoContactoDialogComponent, type CambioEstadoResult,
} from '../../shared/components/estado-contacto-dialog/estado-contacto-dialog';
import { AccionLanzadorComponent } from '../../shared/components/accion-lanzador/accion-lanzador';
import { BreakpointService } from '../../core/services/breakpoint.service';
import { ActionMenuComponent, type MenuAction } from '../../shared/components/action-menu/action-menu';
import { OverlayShellComponent } from '../../shared/components/overlay-shell/overlay-shell';
import {
  ListCardDirective, ListTableDirective, ResponsiveListComponent,
} from '../../shared/components/responsive-list/responsive-list';
import { SeguimientoContactoService } from '../../core/services/seguimiento-contacto.service';

type ContactosTab = 'contactos' | 'pipeline' | 'rgpd' | 'herramientas';

/** Estados que rota la tarjeta KPI ciclable, en orden de click. */
const KPI_ROTATIVA: readonly { status: ContactStatus; titulo: string; detalle: string }[] = [
  { status: 'potencial', titulo: 'Potenciales', detalle: 'Por convertir en clientes' },
  { status: 'pendiente_pago', titulo: 'Pendientes de pago', detalle: 'Esperando el cobro' },
  { status: 'pendiente_presupuesto', titulo: 'Pendientes de presupuesto', detalle: 'Esperando presupuesto' },
];

@Component({
  selector: 'app-contactos',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SkeletonComponent, 
    RouterLink, LucideAngularModule, DecimalPipe, ImportarContactosComponent, ContactoDrawerComponent,
    EstadoContactoDialogComponent, AccionLanzadorComponent, ActionMenuComponent, OverlayShellComponent,
    ResponsiveListComponent, ListCardDirective, ListTableDirective,
  ],
  templateUrl: './contactos.html',
})
export class ContactosComponent {
  readonly UsersIcon = Users;
  readonly PlusIcon = Plus;
  readonly PhoneIcon = Phone;
  readonly MailIcon = Mail;
  readonly Building2Icon = Building2;
  readonly EditIcon = Edit;
  readonly Trash2Icon = Trash2;
  readonly ChevronRightIcon = ChevronRight;
  readonly ChevronLeftIcon = ChevronLeft;
  readonly UserPlusIcon = UserPlus;
  readonly TrendingUpIcon = TrendingUp;
  readonly GitMergeIcon = GitMerge;
  readonly ShieldIcon = Shield;
  readonly BrainIcon = Brain;
  readonly ArrowRightIcon = ArrowRight;
  readonly XIcon = X;
  readonly CheckIcon = Check;
  readonly StickyNoteIcon = StickyNote;
  readonly BriefcaseIcon = Briefcase;
  readonly SendIcon = Send;
  readonly FiltersIcon = SlidersHorizontal;

  readonly contactService = inject(ContactService);
  readonly usersService = inject(UsersService);
  readonly perm = inject(PermissionService);
  protected readonly bp = inject(BreakpointService);
  private readonly toast = inject(ToastService);
  private readonly bloqueo = inject(BloqueoPlanService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly searchSvc = inject(SearchService);
  private readonly seguimientos = inject(SeguimientoContactoService);

  readonly contactStatuses = CONTACT_STATUS_OPTIONS;

  activeTab = signal<ContactosTab>('contactos');
  /** Búsqueda centralizada en el header — scopeada a "contactos". */
  readonly search = this.searchSvc.termFor('contactos');
  filterStatus = signal('');
  filterType = signal('');
  /** Drawer de alta/edición abierto (null = cerrado) y sus datos de partida. */
  readonly drawer = signal<{ contact: Contact | null; prefill: ContactoPrefill | null } | null>(null);
  /** Hoja de filtros (móvil). Comparte las mismas señales que los selects de escritorio. */
  readonly filtrosAbiertos = signal(false);
  /** Filtros activos que oculta la hoja (la búsqueda vive en el header global). */
  readonly filtrosActivos = computed(() => (this.filterStatus() ? 1 : 0) + (this.filterType() ? 1 : 0));
  showImportDrawer = signal(false);
  deleteConfirmId = signal<string | null>(null);

  /** Contacto cuyo estado se está cambiando desde el chip (null = diálogo cerrado). */
  readonly estadoContacto = signal<Contact | null>(null);
  /** Contacto recién creado, al que se le propone el primer compromiso. */
  readonly seguimientoContacto = signal<Contact | null>(null);
  /** Contacto sobre el que se lanza una acción (null = lanzador cerrado). */
  readonly accionContacto = signal<Contact | null>(null);

  // Dummy data — tabs Embudo CRM y RGPD ocultos hasta tener fuente real
  // pipelineDeals = PIPELINE_DEALS;
  // rgpdData = RGPD_CONSENTIMIENTOS;

  constructor() {
    this.reloadContacts();
    this.usersService.loadMembers();
    // Se escucha el stream y NO el snapshot: si el usuario ya está en /contactos
    // (por ejemplo, se lo pide al agente desde esta misma pantalla), Angular
    // reutiliza el componente y el constructor no vuelve a correr. Con el
    // snapshot, la intención de crear se perdía en silencio.
    this.route.queryParamMap
      .pipe(takeUntilDestroyed())
      .subscribe(p => this.abrirDrawerSiLoPidenPorUrl(p));

    const p = this.route.snapshot.queryParamMap;

    // Intención de edición llegada desde contacto-detail.ts (botón "Editar"):
    // esperamos a que la lista termine de cargar para poder localizar el
    // contacto y abrir el drawer de edición con sus datos.
    const editContactId = p.get('editContact');
    if (editContactId) {
      const stopEffect = effect(() => {
        const contacts = this.contactService.contacts();
        if (this.contactService.isLoading() || contacts.length === 0) return;
        const contact = contacts.find((c) => c.id === editContactId);
        if (contact) this.openEdit(contact);
        // Limpia el query param para que un refresh/back no reabra el drawer.
        this.router.navigate([], { relativeTo: this.route, queryParams: {}, replaceUrl: true });
        stopEffect.destroy();
      });
    }
  }

  /**
   * Consume la intención `newContact=1` que llega por URL (desde Recepción IA o
   * desde el agente). Los datos vienen por `history.state`, nunca por la query
   * string: son datos personales. Tras consumirla se limpia el param, porque si
   * no una segunda petición idéntica no cambiaría la URL y el router no
   * volvería a emitir.
   */
  private abrirDrawerSiLoPidenPorUrl(p: ParamMap): void {
    if (p.get('newContact') !== '1') return;

    const datos = (history.state ?? {}) as ContactoPrefill;

    // Objeto nuevo en cada petición: si el drawer ya estaba abierto, el cambio
    // de `prefill` hace que reinicie el formulario con los datos recién llegados.
    this.drawer.set({
      contact: null,
      prefill: { nombre: datos.nombre, apellidos: datos.apellidos, mobile: datos.mobile, notes: datos.notes },
    });

    this.router.navigate([], { relativeTo: this.route, queryParams: {}, replaceUrl: true });
  }

  /** Carga la lista mostrando un toast con reintento si la lectura falla. */
  reloadContacts() {
    this.toast.run(() => this.contactService.loadContacts(), {
      errorTitle: 'No se pudieron cargar los contactos',
    });
  }

  // Derivados de dummy data — tabs Embudo CRM y RGPD ocultos hasta tener fuente real
  // etapasPipeline: Array<{ key: string; label: string }> = [
  //   { key: 'Lead', label: 'Lead' },
  //   { key: 'Calificado', label: 'Calificado' },
  //   { key: 'Propuesta', label: 'Propuesta' },
  //   { key: 'Negociación', label: 'Negociación' },
  //   { key: 'Ganado', label: 'Ganado' },
  // ];

  // dealsByEtapa = computed(() => {
  //   const result: Record<string, typeof this.pipelineDeals> = {};
  //   for (const etapa of this.etapasPipeline) {
  //     result[etapa.key] = this.pipelineDeals.filter((d) => d.etapa === etapa.key);
  //   }
  //   return result;
  // });

  // totalPipeline = computed(() => this.pipelineDeals.reduce((s, d) => s + d.importe, 0));
  // ganados = computed(() => this.pipelineDeals.filter((d) => d.etapa === 'Ganado'));
  // totalGanado = computed(() => this.ganados().reduce((s, d) => s + d.importe, 0));

  // conMarketing = computed(() => this.rgpdData.filter((r) => r.marketing).length);
  // conPerfilado = computed(() => this.rgpdData.filter((r) => r.perfilado).length);

  filtered = computed(() => {
    const q = this.search().toLowerCase();
    const s = this.filterStatus();
    const t = this.filterType();
    return this.contactService.contacts()
      .filter((c) => {
        const name = getContactDisplayName(c).toLowerCase();
        const matchQ = !q
          || name.includes(q)
          || c.email.toLowerCase().includes(q)
          || (c.phone ?? '').toLowerCase().includes(q)
          || (c.mobile ?? '').toLowerCase().includes(q);
        const matchS = !s || c.status === s;
        const matchT = !t || c.type === t;
        return matchQ && matchS && matchT;
      })
      .sort((a, b) => {
        const aMs = a.createdAt?.toMillis() ?? 0;
        const bMs = b.createdAt?.toMillis() ?? 0;
        return bMs - aMs;
      });
  });

  displayName(c: Contact): string {
    return getContactDisplayName(c);
  }

  initials(c: Contact): string {
    return getContactInitials(c);
  }

  typeLabel(type: string): string {
    return type === 'persona_fisica' ? 'Persona Física' : 'Persona Jurídica';
  }

  statusLabel(status: string): string {
    return CONTACT_STATUS_LABELS[status as ContactStatus] ?? status;
  }

  getStatusStyle(status: string): { background: string; color: string } {
    return getContactStatusStyle(status);
  }

  // ── Acciones (mensajes con plantilla) ──────────────────────────────────
  abrirAcciones(c: Contact): void {
    if (!this.perm.can('Contactos', 'editar')) return;
    this.accionContacto.set(c);
  }

  // ── Cambio rápido de estado ───────────────────────────────────────────
  abrirEstado(c: Contact): void {
    if (!this.perm.can('Contactos', 'editar')) return;
    this.estadoContacto.set(c);
  }

  async onEstadoSaved(result: CambioEstadoResult): Promise<void> {
    const c = this.estadoContacto();
    if (!c) return;
    this.estadoContacto.set(null);

    await this.toast.run(
      () => this.seguimientos.cambiarEstado(c, result.status, result.seguimiento),
      {
        successMessage: result.seguimiento ? 'Estado actualizado y seguimiento programado' : 'Estado actualizado',
        errorTitle: 'No se pudo cambiar el estado',
      }
    );
  }

  async onSeguimientoInicialSaved(result: CambioEstadoResult): Promise<void> {
    const c = this.seguimientoContacto();
    this.seguimientoContacto.set(null);
    if (!c || !result.seguimiento) return;

    await this.toast.run(
      () => this.seguimientos.programarSeguimiento(c, result.seguimiento!),
      { successMessage: 'Seguimiento programado', errorTitle: 'No se pudo programar el seguimiento' }
    );
  }

  getTypeStyle(type: string): { background: string; color: string } {
    return type === 'persona_fisica'
      ? { background: 'color-mix(in srgb,var(--warning) 12%,transparent)', color: 'var(--warning)' }
      : { background: 'color-mix(in srgb,var(--brand) 12%,transparent)',   color: 'var(--brand)' };
  }

  getAvatarStyle(type: string): { background: string; color: string } {
    return type === 'persona_fisica'
      ? { background: 'color-mix(in srgb,var(--accent-ia) 15%,transparent)', color: 'var(--accent-ia)' }
      : { background: 'color-mix(in srgb,var(--brand) 15%,transparent)',      color: 'var(--brand)' };
  }

  getSector(c: Contact): string | undefined {
    return c.type === 'persona_fisica' ? c.profesion : c.sectorActividad;
  }

  limpiarFiltros(): void {
    this.filterStatus.set('');
    this.filterType.set('');
  }

  /** Documento fiscal (NIF/CIF) para la tarjeta móvil. */
  documento(c: Contact): string | undefined {
    return c.type === 'persona_fisica' ? c.nif : c.cif;
  }

  /** Nombre del responsable asignado, si lo hay. */
  responsable(c: Contact): string | undefined {
    if (!c.assignedTo) return undefined;
    const m = this.usersService.members().find((x) => x.userId === c.assignedTo);
    return m ? [m.nombre, m.apellido].filter(Boolean).join(' ') : undefined;
  }

  /** Acciones del menú móvil. Misma lógica de permisos que los botones de escritorio. */
  accionesContacto(): MenuAction[] {
    const acciones: MenuAction[] = [{ id: 'caso', label: 'Abrir caso', icon: Briefcase }];
    if (this.perm.can('Contactos', 'editar')) acciones.push({ id: 'edit', label: 'Editar contacto', icon: Edit });
    if (this.perm.can('Contactos', 'eliminar')) acciones.push({ id: 'delete', label: 'Eliminar contacto', icon: Trash2, danger: true });
    return acciones;
  }

  onAccion(id: string, c: Contact): void {
    if (id === 'caso') this.abrirCaso(c.id);
    else if (id === 'edit') this.openEdit(c);
    else if (id === 'delete') this.deleteConfirmId.set(c.id);
  }

  getPhone(c: Contact): string | undefined {
    return  c.mobile;
  }

  // ── KPI rotativa: potenciales → pendientes de pago → pendientes de presupuesto ──
  readonly kpiPasos = KPI_ROTATIVA;
  readonly kpiIndice = signal(0);
  readonly kpiRotativa = computed(() => {
    const paso = KPI_ROTATIVA[this.kpiIndice()];
    const siguiente = KPI_ROTATIVA[(this.kpiIndice() + 1) % KPI_ROTATIVA.length];
    return {
      ...paso,
      total: this.contactService.contacts().filter((c) => c.status === paso.status).length,
      color: getContactStatusStyle(paso.status).color,
      siguiente: siguiente.titulo,
    };
  });

  siguienteKpi(): void {
    this.kpiIndice.update((i) => (i + 1) % KPI_ROTATIVA.length);
  }

  activeCount(): number {
    return this.contactService.contacts().filter((c) => c.status === 'activo').length;
  }

  openNew() {
    if (this.bloqueo.cupoAgotado('contactos')) return;
    this.drawer.set({ contact: null, prefill: null });
  }

  openEdit(contact: Contact) {
    this.drawer.set({ contact, prefill: null });
  }

  closeDrawer() {
    this.drawer.set(null);
  }

  onContactoGuardado(creado: Contact | null) {
    this.closeDrawer();
    // Alta nueva: proponer el primer compromiso sobre el contacto creado.
    if (creado && this.perm.can('Calendario', 'crear')) this.seguimientoContacto.set(creado);
  }

  abrirCaso(contactId: string): void {
    this.router.navigate(['/casos'], { queryParams: { newCaso: '1', contactId } });
  }

  /** La tarjeta usa `routerLink` sobre un `div` (navega con click/mouse), lo
   * que la deja inalcanzable por teclado. Este método replica esa navegación
   * para los handlers de teclado (Enter/Espacio) del template. */
  openContact(contactId: string): void {
    this.router.navigate(['/contactos', contactId]);
  }

  async confirmDelete(id: string) {
    await this.toast.run(() => this.contactService.deleteContact(id), {
      successMessage: 'Contacto eliminado',
      errorTitle: 'No se pudo eliminar el contacto',
      onSuccess: () => this.deleteConfirmId.set(null),
    });
  }
}
