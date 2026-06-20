import {
  Component, input, computed, signal, inject, effect,
  ChangeDetectionStrategy,
} from '@angular/core';
import { Router } from '@angular/router';
import { DecimalPipe } from '@angular/common';
import {
  LucideAngularModule, ArrowLeft, Edit, Phone, Mail, MapPin,
  Building2, Calendar, FileText, Receipt, MessageSquare, Tag,
  ChevronRight, User, FolderPlus, Upload, Folder, FolderOpen,
  Check, X, Pencil, Download, Trash2,
} from 'lucide-angular';
import { INVOICES } from '../../data/dummy-data';
import { ContactService } from '../../core/services/contact.service';
import { ContactFolderService } from '../../core/services/contact-folder.service';
import { ToastService } from '../../core/services/toast.service';
import { ContactFileService } from '../../core/services/contact-file.service';
import { CasosService } from '../../core/services/casos.service';
import { LlamadasService } from '../../core/services/llamadas.service';
import {
  Contact, ContactFolder, ContactFile, Caso,
  getContactDisplayName, getContactInitials,
} from '../../interfaces';
import type { LlamadaResumen } from '../../interfaces/llamada.interface';

type ContactoTab = 'general' | 'casos' | 'facturas' | 'comunicaciones' | 'documentos';

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
  readonly FileTextIcon = FileText;
  readonly ReceiptIcon = Receipt;
  readonly MessageSquareIcon = MessageSquare;
  readonly TagIcon = Tag;
  readonly ChevronRightIcon = ChevronRight;
  readonly UserIcon = User;
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
  private readonly contactService = inject(ContactService);
  private readonly casosService = inject(CasosService);
  private readonly llamadasService = inject(LlamadasService);

  activeTab = signal<ContactoTab>('general');

  // Document browser state
  currentFolderId = signal<string | null>(null);
  folderPath = signal<ContactFolder[]>([]);
  isCreatingFolder = signal(false);
  newFolderName = signal('');
  renamingFolderId = signal<string | null>(null);
  renameValue = signal('');
  deletingFolderId = signal<string | null>(null);
  deletingFileId = signal<string | null>(null);
  isUploading = signal(false);

  contacto = signal<Contact | null>(null);

  constructor() {
    effect(() => {
      const contactId = this.id();
      if (!contactId) return;
      this.contactService.getContact(contactId).then((c) => this.contacto.set(c));
      this.folderService.loadFolders(contactId);
      this.fileService.loadFiles(contactId);
      this.casosService.loadCasos();
      this.llamadasService.loadLlamadas();
      // Reset browser state when contact changes
      this.currentFolderId.set(null);
      this.folderPath.set([]);
    });
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

  /**
   * Comunicaciones de recepción IA vinculadas al contacto: por `contactId`
   * manual o por match automático de teléfono.
   */
  comunicaciones = computed<LlamadaResumen[]>(() => {
    const c = this.contacto();
    if (!c) return [];
    const id = this.id();
    const phones = new Set(
      [c.phone, c.mobile]
        .filter((p): p is string => !!p)
        .map((p) => p.replace(/\D/g, ''))
    );
    return this.llamadasService.llamadas().filter((ll) => {
      if (ll.contactId === id) return true;
      const tel = ll.datosCapturados?.telefono;
      return !!tel && phones.has(tel.replace(/\D/g, ''));
    });
  });

  totalDocumentos = computed(() => this.fileService.files().length);

  currentFolders = computed(() =>
    this.folderService.folders().filter((f) => f.parentId === this.currentFolderId())
  );

  currentFiles = computed(() =>
    this.fileService.files().filter((f) => f.folderId === this.currentFolderId())
  );

  historialFacturacion = [
    { mes: 'Ene', valor: 4200 },
    { mes: 'Feb', valor: 6800 },
    { mes: 'Mar', valor: 5100 },
    { mes: 'Abr', valor: 9200 },
    { mes: 'May', valor: 8400 },
  ];

  maxFactura = Math.max(...[4200, 6800, 5100, 9200, 8400]);

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

  getStatusClass(status: string): string {
    const map: Record<string, string> = {
      activo: 'bg-green-100 text-green-700',
      potencial: 'bg-blue-100 text-blue-700',
      inactivo: 'bg-slate-100 text-slate-500',
      archivado: 'bg-amber-100 text-amber-700',
    };
    return map[status] ?? 'bg-slate-100 text-slate-600';
  }

  getStatusLabel(status: string): string {
    const map: Record<string, string> = {
      activo: 'Activo', potencial: 'Potencial', inactivo: 'Inactivo', archivado: 'Archivado',
    };
    return map[status] ?? status;
  }

  getCasoEstadoClass(estado: string): string {
    const map: Record<string, string> = {
      pendiente: 'bg-amber-100 text-amber-700',
      en_proceso: 'bg-blue-100 text-blue-700',
      cerrado: 'bg-green-100 text-green-700',
      urgente: 'bg-red-100 text-red-700',
      archivado: 'bg-slate-100 text-slate-500',
    };
    return map[estado] ?? 'bg-slate-100 text-slate-600';
  }

  getCasoEstadoLabel(estado: string): string {
    const map: Record<string, string> = {
      pendiente: 'Pendiente', en_proceso: 'En proceso', cerrado: 'Cerrado',
      urgente: 'Urgente', archivado: 'Archivado',
    };
    return map[estado] ?? estado;
  }

  getCasoPrioridadClass(prioridad: string): string {
    const map: Record<string, string> = {
      alta: 'bg-red-100 text-red-700',
      media: 'bg-amber-100 text-amber-700',
      baja: 'bg-slate-100 text-slate-500',
    };
    return map[prioridad] ?? 'bg-slate-100 text-slate-600';
  }

  verCaso(caso: Caso): void {
    this.router.navigate(['/casos', caso.id]);
  }

  getInvoiceStatusClass(status: string): string {
    const map: Record<string, string> = {
      pagada: 'bg-green-100 text-green-700',
      pendiente: 'bg-amber-100 text-amber-700',
      vencida: 'bg-red-100 text-red-700',
      borrador: 'bg-slate-100 text-slate-500',
    };
    return map[status] ?? 'bg-slate-100 text-slate-600';
  }

  llamadaTitulo(ll: LlamadaResumen): string {
    return ll.tituloResumen?.trim() || ll.resumen || 'Llamada';
  }

  llamadaFecha(ll: LlamadaResumen): string {
    if (!ll.creadoEn) return '—';
    return ll.creadoEn.toDate().toLocaleString('es-ES', {
      day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
    });
  }

  formatDuracion(seconds: number): string {
    if (seconds < 60) return `${seconds}s`;
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return s > 0 ? `${m}m ${s}s` : `${m}m`;
  }

  barHeight(valor: number): string {
    return Math.round((valor / this.maxFactura) * 100) + '%';
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
    this.renamingFolderId.set(folder.id);
    this.renameValue.set(folder.name);
  }

  async confirmRename(folderId: string) {
    const name = this.renameValue().trim();
    if (!name) return;
    await this.toast.run(() => this.folderService.updateFolder(folderId, { name }, this.id()), {
      errorTitle: 'No se pudo renombrar la carpeta',
      onSuccess: () => this.renamingFolderId.set(null),
    });
  }

  async deleteFolder(folderId: string) {
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

  async onFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    const files = Array.from(input.files ?? []);
    if (!files.length) return;
    this.isUploading.set(true);
    try {
      await this.toast.run(
        async () => {
          for (const file of files) {
            await this.fileService.uploadFile(this.id(), this.currentFolderId(), file);
          }
        },
        { successMessage: 'Archivos subidos', errorTitle: 'No se pudieron subir los archivos' }
      );
    } finally {
      this.isUploading.set(false);
      input.value = '';
    }
  }

  async deleteFile(file: ContactFile) {
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
