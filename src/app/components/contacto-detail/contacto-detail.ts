import {
  Component, input, computed, signal, inject, effect, untracked,
  ChangeDetectionStrategy, DestroyRef,
} from '@angular/core';
import { Router } from '@angular/router';
import { DecimalPipe } from '@angular/common';
import {
  LucideAngularModule, ArrowLeft, Edit, Phone, Mail, MapPin,
  Building2, Calendar, Tag, FolderPlus, Upload, Folder, FolderOpen,
  Check, X, Pencil, Download, Trash2,
} from 'lucide-angular';
import { INVOICES } from '../../data/dummy-data';
import { ContactService } from '../../core/services/contact.service';
import { ContactFolderService } from '../../core/services/contact-folder.service';
import { ToastService } from '../../core/services/toast.service';
import { ContactFileService } from '../../core/services/contact-file.service';
import { UploadQueueService } from '../../core/services/upload-queue.service';
import { CasosService } from '../../core/services/casos.service';
import { UsersService } from '../../core/services/users';
import { PermissionService } from '../../core/services/permission.service';
import {
  Contact, ContactFolder, ContactFile, Caso,
  CONTACT_STATUS_LABELS, CANAL_ENTRADA_LABELS, ContactStatus, CanalEntrada,
  getContactDisplayName, getContactInitials,
} from '../../interfaces';

@Component({
  selector: 'app-contacto-detail',
  imports: [LucideAngularModule, DecimalPipe],
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
  readonly FolderPlusIcon = FolderPlus;
  readonly UploadIcon = Upload;
  readonly FolderIcon = Folder;
  readonly FolderOpenIcon = FolderOpen;
  readonly CheckIcon = Check;
  readonly XIcon = X;
  readonly PencilIcon = Pencil;
  readonly DownloadIcon = Download;
  readonly Trash2Icon = Trash2;

  id = input.required<string>();

  private router = inject(Router);
  readonly folderService = inject(ContactFolderService);
  readonly fileService = inject(ContactFileService);
  private readonly toast = inject(ToastService);
  private readonly uploadQueue = inject(UploadQueueService);
  private readonly contactService = inject(ContactService);
  private readonly casosService = inject(CasosService);
  readonly usersService = inject(UsersService);
  readonly perm = inject(PermissionService);

  // Document browser state
  currentFolderId = signal<string | null>(null);
  folderPath = signal<ContactFolder[]>([]);
  isCreatingFolder = signal(false);
  newFolderName = signal('');
  renamingFolderId = signal<string | null>(null);
  renameValue = signal('');
  deletingFolderId = signal<string | null>(null);
  deletingFileId = signal<string | null>(null);

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
      // contacto/carpetas/archivos/casos y reseteando currentFolderId/
      // folderPath a la raíz, perdiendo la navegación de carpetas en curso.
      untracked(() => {
        if (this.usersService.members().length === 0) this.usersService.loadMembers();
      });
      // Reset browser state when contact changes
      this.currentFolderId.set(null);
      this.folderPath.set([]);
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

  totalDocumentos = computed(() => this.fileService.files().length);

  encargadoNombre = computed(() => {
    const c = this.contacto();
    if (!c?.assignedTo) return null;
    const m = this.usersService.members().find(m => m.userId === c.assignedTo);
    return m ? `${m.nombre}${m.apellido ? ' ' + m.apellido : ''}` : null;
  });

  currentFolders = computed(() =>
    this.folderService.folders().filter((f) => f.parentId === this.currentFolderId())
  );

  currentFiles = computed(() =>
    this.fileService.files().filter((f) => f.folderId === this.currentFolderId())
  );

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
    if (c.type === 'persona_fisica') {
      return c.nifType === 'pasaporte' ? 'Pasaporte' : c.nifType?.toUpperCase() ?? 'NIF';
    }
    return c.cifType === 'vat' ? 'VAT' : 'CIF';
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
    const mix = (v: string) => `color-mix(in srgb,${v} 12%,transparent)`;
    const map: Record<string, { background: string; color: string }> = {
      activo:                       { background: mix('var(--success)'),   color: 'var(--success)' },
      potencial:                    { background: mix('var(--accent-ia)'), color: 'var(--accent-ia)' },
      inactivo:                     { background: 'var(--surface-2)',       color: 'var(--text-muted)' },
      cerrado_finalizado:           { background: 'var(--surface-2)',       color: 'var(--text-muted)' },
      pendiente_presupuesto:        { background: mix('var(--warning)'),   color: 'var(--warning)' },
      pendiente_firma_hoja_encargo: { background: mix('var(--warning)'),   color: 'var(--warning)' },
      pendiente_pago:               { background: mix('var(--danger)'),    color: 'var(--danger)' },
      integracion_plantillas:       { background: mix('var(--brand)'),     color: 'var(--brand)' },
    };
    return map[status] ?? { background: 'var(--surface-2)', color: 'var(--text-muted)' };
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

  // --- Document browser ---

  navigateToFolder(folder: ContactFolder) {
    this.currentFolderId.set(folder.id);
    this.folderPath.update((path) => [...path, folder]);
  }

  navigateToRoot() {
    this.currentFolderId.set(null);
    this.folderPath.set([]);
  }

  navigateToBreadcrumb(index: number) {
    const path = this.folderPath();
    this.currentFolderId.set(path[index].id);
    this.folderPath.set(path.slice(0, index + 1));
  }

  async createFolder() {
    if (!this.perm.can('Contactos', 'crear')) return;
    const name = this.newFolderName().trim();
    if (!name) return;
    await this.toast.run(
      () => this.folderService.createFolder({
        contactId: this.id(),
        parentId: this.currentFolderId(),
        name,
      }),
      {
        errorTitle: 'No se pudo crear la carpeta',
        onSuccess: () => {
          this.newFolderName.set('');
          this.isCreatingFolder.set(false);
        },
      }
    );
  }

  startRename(folder: ContactFolder) {
    if (!this.perm.can('Contactos', 'editar')) return;
    this.renamingFolderId.set(folder.id);
    this.renameValue.set(folder.name);
  }

  async confirmRename(folderId: string) {
    if (!this.perm.can('Contactos', 'editar')) return;
    const name = this.renameValue().trim();
    if (!name) return;
    await this.toast.run(() => this.folderService.updateFolder(folderId, { name }, this.id()), {
      errorTitle: 'No se pudo renombrar la carpeta',
      onSuccess: () => this.renamingFolderId.set(null),
    });
  }

  async deleteFolder(folderId: string) {
    if (!this.perm.can('Contactos', 'eliminar')) return;
    await this.toast.run(() => this.deleteFolderRecursive(folderId), {
      successMessage: 'Carpeta eliminada',
      errorTitle: 'No se pudo eliminar la carpeta',
      onSuccess: () => this.deletingFolderId.set(null),
    });
  }

  private async deleteFolderRecursive(folderId: string) {
    const subFolders = this.folderService.folders().filter((f) => f.parentId === folderId);
    for (const sub of subFolders) {
      await this.deleteFolderRecursive(sub.id);
    }
    const files = this.fileService.files().filter((f) => f.folderId === folderId);
    for (const file of files) {
      await this.fileService.deleteFile(file.id, file.storagePath, this.id());
    }
    await this.folderService.deleteFolder(folderId);
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const files = Array.from(input.files ?? []);
    input.value = '';
    if (!this.perm.can('Contactos', 'crear')) return;
    for (const file of files) {
      this.uploadQueue.enqueue(
        () => this.fileService.uploadFile(this.id(), this.currentFolderId(), file),
        file.name,
        { successMessage: `"${file.name}" subido`, errorTitle: 'No se pudo subir el archivo' },
      );
    }
  }

  async deleteFile(file: ContactFile) {
    if (!this.perm.can('Contactos', 'eliminar')) return;
    await this.toast.run(() => this.fileService.deleteFile(file.id, file.storagePath, this.id()), {
      successMessage: 'Archivo eliminado',
      errorTitle: 'No se pudo eliminar el archivo',
      onSuccess: () => this.deletingFileId.set(null),
    });
  }

  getFileIcon(mimeType: string): string {
    if (mimeType === 'application/pdf') return '📄';
    if (mimeType.startsWith('image/')) return '🖼️';
    if (mimeType.includes('word') || mimeType.includes('document')) return '📝';
    if (mimeType.includes('sheet') || mimeType.includes('excel')) return '📊';
    return '📎';
  }

  formatFileSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  volver() {
    this.router.navigate(['/contactos']);
  }
}
