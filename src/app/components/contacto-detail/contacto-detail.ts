import {
  Component, input, computed, signal, inject, effect, untracked,
  ChangeDetectionStrategy, DestroyRef,
} from '@angular/core';
import { Router } from '@angular/router';
import { DecimalPipe } from '@angular/common';
import {
  LucideAngularModule, ArrowLeft, Edit, Phone, Mail, MapPin,
  Building2, Calendar, Tag, CalendarClock, CircleAlert,
} from 'lucide-angular';
import { INVOICES } from '../../data/dummy-data';
import { ContactService } from '../../core/services/contact.service';
import { ContactFolderService } from '../../core/services/contact-folder.service';
import { ToastService } from '../../core/services/toast.service';
import { ContactFileService } from '../../core/services/contact-file.service';
import { CasosService } from '../../core/services/casos.service';
import { UsersService } from '../../core/services/users';
import { PermissionService } from '../../core/services/permission.service';
import {
  Contact, Caso, Evento,
  CONTACT_STATUS_LABELS, CANAL_ENTRADA_LABELS, ContactStatus, CanalEntrada,
  getContactDisplayName, getContactInitials, getContactStatusStyle,
} from '../../interfaces';
import { EventosService } from '../../core/services/eventos.service';
import { SeguimientoContactoService } from '../../core/services/seguimiento-contacto.service';
import {
  esSeguimiento, esVencido, puedeGestionarSeguimiento,
} from '../../core/contactos/seguimiento';
import {
  EstadoContactoDialogComponent, type CambioEstadoResult,
} from '../../shared/components/estado-contacto-dialog/estado-contacto-dialog';
import { ContactoDocumentosComponent } from './components/contacto-documentos/contacto-documentos';
import { etiquetaDocumentoContacto } from '../../core/fiscal/documento-contacto';

@Component({
  selector: 'app-contacto-detail',
  imports: [LucideAngularModule, DecimalPipe, EstadoContactoDialogComponent, ContactoDocumentosComponent],
  templateUrl: './contacto-detail.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ContactoDetailComponent {
  readonly ArrowLeftIcon = ArrowLeft;
  readonly EditIcon = Edit;
  readonly PhoneIcon = Phone;
  readonly MailIcon = Mail;
  readonly MapPinIcon = MapPin;
  readonly Building2Icon = Building2;
  readonly CalendarIcon = Calendar;
  readonly TagIcon = Tag;
  readonly CalendarClockIcon = CalendarClock;
  readonly CircleAlertIcon = CircleAlert;

  id = input.required<string>();

  private router = inject(Router);
  private readonly folderService = inject(ContactFolderService);
  private readonly fileService = inject(ContactFileService);
  private readonly toast = inject(ToastService);
  private readonly contactService = inject(ContactService);
  private readonly casosService = inject(CasosService);
  private readonly eventosService = inject(EventosService);
  private readonly seguimientosService = inject(SeguimientoContactoService);
  readonly usersService = inject(UsersService);
  readonly perm = inject(PermissionService);

  contacto = signal<Contact | null>(null);

  // Notas — borrador editable con autoguardado (ver onNotesInput).
  notesDraft = signal('');
  private notesSaveTimeout: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    effect(() => {
      const contactId = this.id();
      if (!contactId) return;
      void this.loadContactData(contactId);
      // `untracked` es necesario: si no, `members()` queda como dependencia
      // reactiva de TODO el effect, y cuando `loadMembers()` resuelve y
      // `members` cambia, se re-ejecuta el effect completo — recargando
      // contacto/carpetas/archivos/casos sin motivo.
      untracked(() => {
        if (this.usersService.members().length === 0) this.usersService.loadMembers();
      });
    });

    // Mantiene el borrador de notas sincronizado cuando cambia el contacto.
    effect(() => {
      const c = this.contacto();
      this.notesDraft.set(c?.notes ?? '');
    });

    // Cancela el autoguardado de notas pendiente si el usuario navega fuera
    // antes de que dispare — evita escribir en un componente ya destruido.
    inject(DestroyRef).onDestroy(() => {
      if (this.notesSaveTimeout) clearTimeout(this.notesSaveTimeout);
    });
  }

  /**
   * Carga contacto + carpetas + archivos + casos envuelto en ToastService.run,
   * igual que `reloadContacts()` en contactos.ts — antes un fallo de red aquí
   * fallaba en silencio (sin toast) porque el `effect()` no capturaba errores.
   */
  private async loadContactData(contactId: string): Promise<void> {
    await this.toast.run(
      async () => {
        const [c] = await Promise.all([
          this.contactService.getContact(contactId),
          this.folderService.loadFolders(contactId),
          this.fileService.loadFiles(contactId),
          this.casosService.loadCasos(),
          this.eventosService.loadEventos(),
        ]);
        this.contacto.set(c);
      },
      { errorTitle: 'No se pudo cargar la información del contacto' }
    );
  }

  name = computed(() => {
    const c = this.contacto();
    return c ? getContactDisplayName(c) : '';
  });

  /** Casos cuyo `contactoIds` incluye este contacto. */
  casos = computed(() =>
    this.casosService.casos().filter((c) => c.contactoIds?.includes(this.id()))
  );

  facturas = computed(() =>
    INVOICES.filter((f) => f.client === this.name())
  );

  /** Hoy en YYYY-MM-DD, para marcar seguimientos vencidos. */
  private readonly hoy = new Date().toISOString().slice(0, 10);

  /**
   * Compromisos abiertos de este contacto. Se filtran en cliente sobre los
   * eventos de la empresa (que ya se cargan enteros) para no exigir un índice
   * compuesto nuevo en Firestore.
   */
  readonly seguimientos = computed(() =>
    this.eventosService.eventos()
      .filter(e => esSeguimiento(e) && e.origen.contactoId === this.id())
      .sort((a, b) => a.fecha.localeCompare(b.fecha))
  );

  encargadoNombre = computed(() => {
    const c = this.contacto();
    if (!c?.assignedTo) return null;
    const m = this.usersService.members().find(m => m.userId === c.assignedTo);
    return m ? `${m.nombre}${m.apellido ? ' ' + m.apellido : ''}` : null;
  });

  // --- Contact display helpers ---

  getDisplayName(c: Contact): string {
    return getContactDisplayName(c);
  }

  getInitials(c: Contact): string {
    return getContactInitials(c);
  }

  getTypeLabel(c: Contact): string {
    return c.type === 'persona_fisica' ? 'Persona Física' : 'Persona Jurídica';
  }

  getIdentifierLabel(c: Contact): string {
    return etiquetaDocumentoContacto(c);
  }

  getIdentifier(c: Contact): string | undefined {
    return c.type === 'persona_fisica' ? c.nif : c.cif;
  }

  getAddress(c: Contact): string | undefined {
    const dir = c.type === 'persona_fisica' ? c.direccion : c.direccionSocial;
    if (!dir) return undefined;
    return [dir.calle, dir.numero, dir.municipio, dir.provincia]
      .filter(Boolean)
      .join(', ') || undefined;
  }

  getSector(c: Contact): string | undefined {
    return c.type === 'persona_fisica' ? c.profesion : c.sectorActividad;
  }

  getLastContact(c: Contact): string {
    if (!c.lastContact) return '—';
    if (typeof c.lastContact === 'string') return c.lastContact;
    return c.lastContact.toDate().toLocaleDateString('es-ES');
  }

  getStatusStyle(status: string): { background: string; color: string } {
    return getContactStatusStyle(status);
  }

  // ── Cambio de estado y seguimientos ───────────────────────────────────

  /** Contacto en edición de estado (null = diálogo cerrado). */
  readonly editandoEstado = signal(false);

  abrirEstado(): void {
    if (!this.perm.can('Contactos', 'editar')) return;
    this.editandoEstado.set(true);
  }

  async onEstadoSaved(result: CambioEstadoResult): Promise<void> {
    const c = this.contacto();
    this.editandoEstado.set(false);
    if (!c) return;

    await this.toast.run(
      () => this.seguimientosService.cambiarEstado(c, result.status, result.seguimiento),
      {
        successMessage: result.seguimiento ? 'Estado actualizado y seguimiento programado' : 'Estado actualizado',
        errorTitle: 'No se pudo cambiar el estado',
        // `contacto` es un signal local, independiente de contactService.contacts():
        // hay que refrescarlo a mano o el chip seguiría mostrando el estado viejo.
        onSuccess: () => this.contacto.update(prev => (prev ? { ...prev, status: result.status } : prev)),
      }
    );
  }

  /** Quién puede completar o descartar un compromiso: Admin, Gestor o su responsable. */
  puedeGestionar(evento: Evento): boolean {
    return puedeGestionarSeguimiento(
      evento,
      this.perm.currentMember()?.userId ?? null,
      this.perm.userRole(),
      this.perm.isSuperUser(),
    );
  }

  seguimientoVencido(evento: Evento): boolean {
    return esVencido(evento, this.hoy);
  }

  responsableNombre(evento: Evento): string {
    const m = this.usersService.members().find(m => m.userId === evento.responsableId);
    return m ? `${m.nombre}${m.apellido ? ' ' + m.apellido : ''}` : 'Sin asignar';
  }

  async completarSeguimiento(evento: Evento): Promise<void> {
    if (!this.puedeGestionar(evento)) return;
    await this.toast.run(
      () => this.eventosService.updateEvento(evento.id, { estado: 'completado' }),
      { successMessage: 'Seguimiento completado', errorTitle: 'No se pudo completar el seguimiento' }
    );
  }

  getStatusLabel(status: string): string {
    return CONTACT_STATUS_LABELS[status as ContactStatus] ?? status;
  }

  getCanalEntradaLabel(canal: string): string {
    return CANAL_ENTRADA_LABELS[canal as CanalEntrada] ?? canal;
  }

  getAvatarStyle(type: string): { background: string; color: string } {
    return type === 'persona_fisica'
      ? { background: 'color-mix(in srgb,var(--accent-ia) 15%,transparent)', color: 'var(--accent-ia)' }
      : { background: 'color-mix(in srgb,var(--brand) 15%,transparent)',      color: 'var(--brand)' };
  }

  getCasoEstadoStyle(estado: string): { background: string; color: string } {
    const mix = (v: string) => `color-mix(in srgb,${v} 12%,transparent)`;
    const map: Record<string, { background: string; color: string }> = {
      pendiente:  { background: mix('var(--warning)'), color: 'var(--warning)' },
      en_proceso: { background: mix('var(--brand)'),   color: 'var(--brand)' },
      cerrado:    { background: 'var(--surface-2)',     color: 'var(--text-muted)' },
      urgente:    { background: mix('var(--danger)'),  color: 'var(--danger)' },
      archivado:  { background: 'var(--surface-2)',     color: 'var(--text-faint)' },
    };
    return map[estado] ?? { background: 'var(--surface-2)', color: 'var(--text-muted)' };
  }

  getCasoEstadoLabel(estado: string): string {
    const map: Record<string, string> = {
      pendiente: 'Pendiente', en_proceso: 'En proceso', cerrado: 'Cerrado',
      urgente: 'Urgente', archivado: 'Archivado',
    };
    return map[estado] ?? estado;
  }

  getCasoPrioridadStyle(prioridad: string): { background: string; color: string } {
    const mix = (v: string) => `color-mix(in srgb,${v} 12%,transparent)`;
    const map: Record<string, { background: string; color: string }> = {
      alta:  { background: mix('var(--danger)'),  color: 'var(--danger)' },
      media: { background: mix('var(--warning)'), color: 'var(--warning)' },
      baja:  { background: 'var(--surface-2)',     color: 'var(--text-muted)' },
    };
    return map[prioridad] ?? { background: 'var(--surface-2)', color: 'var(--text-muted)' };
  }

  verCaso(caso: Caso): void {
    this.router.navigate(['/casos', caso.id]);
  }

  /** Navega a la lista de contactos con intención de edición: abre el drawer
   * de edición para este contacto ya que el formulario completo vive ahí
   * (contactos.ts / contactos.html), evitando duplicar esa lógica aquí. */
  onEditar(): void {
    if (!this.perm.can('Contactos', 'editar')) return;
    this.router.navigate(['/contactos'], { queryParams: { editContact: this.id() } });
  }

  // --- Notas (autoguardado) ---

  onNotesInput(value: string): void {
    if (!this.perm.can('Contactos', 'editar')) return;
    this.notesDraft.set(value);
    if (this.notesSaveTimeout) clearTimeout(this.notesSaveTimeout);
    this.notesSaveTimeout = setTimeout(() => void this.saveNotes(), 800);
  }

  private async saveNotes(): Promise<void> {
    const c = this.contacto();
    if (!c) return;
    await this.toast.run(
      () => this.contactService.updateContact(c.id, { notes: this.notesDraft() }),
      { errorTitle: 'No se pudieron guardar las notas' }
    );
  }

  getInvoiceStatusStyle(status: string): { background: string; color: string } {
    const mix = (v: string) => `color-mix(in srgb,${v} 12%,transparent)`;
    const map: Record<string, { background: string; color: string }> = {
      pagada:    { background: mix('var(--success)'), color: 'var(--success)' },
      pendiente: { background: mix('var(--warning)'), color: 'var(--warning)' },
      vencida:   { background: mix('var(--danger)'),  color: 'var(--danger)' },
      borrador:  { background: 'var(--surface-2)',     color: 'var(--text-muted)' },
    };
    return map[status] ?? { background: 'var(--surface-2)', color: 'var(--text-muted)' };
  }

  volver() {
    this.router.navigate(['/contactos']);
  }
}
