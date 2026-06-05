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
import { PROJECTS, INVOICES } from '../../data/dummy-data';
import { ContactService } from '../../core/services/contact.service';
import { ContactFolderService } from '../../core/services/contact-folder.service';
import { ContactFileService } from '../../core/services/contact-file.service';
import {
  Contact, ContactFolder, ContactFile,
  getContactDisplayName, getContactInitials,
} from '../../interfaces';

type ContactoTab = 'general' | 'proyectos' | 'facturas' | 'comunicaciones' | 'documentos';

const HISTORIAL_COMUNICACION = [
  { id: 'C-001', tipo: 'llamada', descripcion: 'Llamada de seguimiento semanal', fecha: 'Hoy, 10:30' },
  { id: 'C-002', tipo: 'email', descripcion: 'Propuesta enviada por email', fecha: 'Ayer, 14:00' },
  { id: 'C-003', tipo: 'reunion', descripcion: 'Reunión presencial en oficinas', fecha: 'Hace 1 semana' },
];

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
  private readonly contactService = inject(ContactService);

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
      // Reset browser state when contact changes
      this.currentFolderId.set(null);
      this.folderPath.set([]);
    });
  }

  name = computed(() => {
    const c = this.contacto();
    return c ? getContactDisplayName(c) : '';
  });

  proyectos = computed(() =>
    PROJECTS.filter((p) => p.client === this.name())
  );

  facturas = computed(() =>
    INVOICES.filter((f) => f.client === this.name())
  );

  totalDocumentos = computed(() => this.fileService.files().length);

  currentFolders = computed(() =>
    this.folderService.folders().filter((f) => f.parentId === this.currentFolderId())
  );

  currentFiles = computed(() =>
    this.fileService.files().filter((f) => f.folderId === this.currentFolderId())
  );

  historialComunicacion = HISTORIAL_COMUNICACION;

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

  getProjectStatusClass(status: string): string {
    const map: Record<string, string> = {
      'En curso': 'bg-blue-100 text-blue-700',
      Pendiente: 'bg-amber-100 text-amber-700',
      Completado: 'bg-green-100 text-green-700',
    };
    return map[status] ?? 'bg-slate-100 text-slate-600';
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

  getComunicacionIcon(tipo: string): string {
    return tipo === 'llamada' ? '📞' : tipo === 'email' ? '✉️' : '🤝';
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
    await this.folderService.createFolder({
      contactId: this.id(),
      parentId: this.currentFolderId(),
      name,
    });
    this.newFolderName.set('');
    this.isCreatingFolder.set(false);
  }

  startRename(folder: ContactFolder) {
    this.renamingFolderId.set(folder.id);
    this.renameValue.set(folder.name);
  }

  async confirmRename(folderId: string) {
    const name = this.renameValue().trim();
    if (!name) return;
    await this.folderService.updateFolder(folderId, { name }, this.id());
    this.renamingFolderId.set(null);
  }

  async deleteFolder(folderId: string) {
    await this.deleteFolderRecursive(folderId);
    this.deletingFolderId.set(null);
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
      for (const file of files) {
        await this.fileService.uploadFile(this.id(), this.currentFolderId(), file);
      }
    } finally {
      this.isUploading.set(false);
      input.value = '';
    }
  }

  async deleteFile(file: ContactFile) {
    await this.fileService.deleteFile(file.id, file.storagePath, this.id());
    this.deletingFileId.set(null);
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
