import { Component, signal, computed, inject, ChangeDetectionStrategy } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { RouterLink, ActivatedRoute, Router } from '@angular/router';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import {
  LucideAngularModule,
  Users, Plus, Phone, Mail, Building2,
  Edit, Trash2, ChevronRight, ChevronLeft, UserPlus, TrendingUp,
  GitMerge, Shield, Brain, ArrowRight, X, Check, LoaderCircle, StickyNote, Briefcase,
} from 'lucide-angular';
import { PIPELINE_DEALS } from '../../data/dummy-data';
import { ContactService } from '../../core/services/contact.service';
import { SearchService } from '../../core/services/search.service';
import { PermissionService } from '../../core/services/permission.service';
import { ToastService } from '../../core/services/toast.service';
import {
  Contact, PersonaFisica, PersonaJuridica, ContactStatus,
  getContactDisplayName, getContactInitials,
} from '../../interfaces';

type ContactPayload =
  | Omit<PersonaFisica, 'id' | 'companyId' | 'createdAt' | 'updatedAt'>
  | Omit<PersonaJuridica, 'id' | 'companyId' | 'createdAt' | 'updatedAt'>;

type ContactosTab = 'contactos' | 'pipeline' | 'rgpd' | 'herramientas';

const RGPD_CONSENTIMIENTOS = [
  { id: 'CON-001', nombre: 'Innovatech Industries S.L.', marketing: true, perfilado: true, terceros: false },
  { id: 'CON-002', nombre: 'María García López', marketing: true, perfilado: false, terceros: false },
  { id: 'CON-003', nombre: 'Consultora Global S.L.', marketing: true, perfilado: true, terceros: true },
  { id: 'CON-004', nombre: 'StartUp Ventures S.L.', marketing: false, perfilado: false, terceros: false },
  { id: 'CON-005', nombre: 'Carlos Rodríguez Fernández', marketing: false, perfilado: false, terceros: false },
];

@Component({
  selector: 'app-contactos',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, LucideAngularModule, DecimalPipe, ReactiveFormsModule],
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
  readonly Loader2Icon = LoaderCircle;
  readonly StickyNoteIcon = StickyNote;
  readonly BriefcaseIcon = Briefcase;

  readonly contactService = inject(ContactService);
  readonly perm = inject(PermissionService);
  private readonly toast = inject(ToastService);
  private readonly fb = inject(FormBuilder);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly searchSvc = inject(SearchService);

  activeTab = signal<ContactosTab>('contactos');
  /** Búsqueda centralizada en el header — scopeada a "contactos". */
  readonly search = this.searchSvc.termFor('contactos');
  filterStatus = signal('');
  filterType = signal('');
  showDrawer = signal(false);
  editingId = signal<string | null>(null);
  formType = signal<'persona_fisica' | 'persona_juridica'>('persona_fisica');
  isSaving = signal(false);
  deleteConfirmId = signal<string | null>(null);
  formStep = signal<1 | 2>(1);
  showErrors = signal(false);

  pipelineDeals = PIPELINE_DEALS;
  rgpdData = RGPD_CONSENTIMIENTOS;

  form = this.fb.group({
    email: ['', [Validators.email]],
    mobile: [''],
    status: ['activo', Validators.required],
    notes: [''],
    // Persona Física
    nombre: [''],
    apellidos: [''],
    nifType: ['dni'],
    nif: [''],

    nacionalidad: ['ES'],
    estadoCivil: ['casado'],
    // Persona Jurídica
    razonSocial: [''],
    nombreComercial: [''],
    formaJuridica: [''],
    cifType: ['cif'],
    cif: [''],
    sectorActividad: [''],
    website: [''],
    representanteLegalNombre: [''],
    // Dirección
    calle: [''],
    numero: [''],
    codigoPostal: [''],
    municipio: [''],
    provincia: [''],
    pais: ['ES'],
  });

  constructor() {
    this.reloadContacts();
    const p = this.route.snapshot.queryParamMap;
    if (p.get('newContact') === '1') {
      this.formType.set('persona_fisica');
      this.formStep.set(1);
      this.showErrors.set(false);
      this.form.reset({ status: 'activo', nifType: 'dni', cifType: 'cif', pais: 'ES', nacionalidad: 'ES', estadoCivil: 'casado' });
      this.form.patchValue({
        nombre: p.get('nombre') ?? '',
        apellidos: p.get('apellidos') ?? '',
        mobile: p.get('mobile') ?? '',
        notes: p.get('notes') ?? '',
      });
      this.showDrawer.set(true);
    }
  }

  /** Carga la lista mostrando un toast con reintento si la lectura falla. */
  reloadContacts() {
    this.toast.run(() => this.contactService.loadContacts(), {
      errorTitle: 'No se pudieron cargar los contactos',
    });
  }

  etapasPipeline: Array<{ key: string; label: string }> = [
    { key: 'Lead', label: 'Lead' },
    { key: 'Calificado', label: 'Calificado' },
    { key: 'Propuesta', label: 'Propuesta' },
    { key: 'Negociación', label: 'Negociación' },
    { key: 'Ganado', label: 'Ganado' },
  ];

  dealsByEtapa = computed(() => {
    const result: Record<string, typeof this.pipelineDeals> = {};
    for (const etapa of this.etapasPipeline) {
      result[etapa.key] = this.pipelineDeals.filter((d) => d.etapa === etapa.key);
    }
    return result;
  });

  totalPipeline = computed(() => this.pipelineDeals.reduce((s, d) => s + d.importe, 0));
  ganados = computed(() => this.pipelineDeals.filter((d) => d.etapa === 'Ganado'));
  totalGanado = computed(() => this.ganados().reduce((s, d) => s + d.importe, 0));

  conMarketing = computed(() => this.rgpdData.filter((r) => r.marketing).length);
  conPerfilado = computed(() => this.rgpdData.filter((r) => r.perfilado).length);

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
    const map: Record<string, string> = {
      activo: 'Activo', inactivo: 'Inactivo', potencial: 'Potencial', archivado: 'Archivado',
    };
    return map[status] ?? status;
  }

  getStatusClass(status: string): string {
    const map: Record<string, string> = {
      activo: 'bg-green-100 text-green-700',
      inactivo: 'bg-slate-100 text-slate-500',
      potencial: 'bg-violet-100 text-violet-700',
      archivado: 'bg-amber-100 text-amber-700',
    };
    return map[status] ?? 'bg-slate-100 text-slate-600';
  }

  getTypeClass(type: string): string {
    return type === 'persona_fisica'
      ? 'bg-amber-100 text-amber-700'
      : 'bg-blue-100 text-blue-700';
  }

  getSector(c: Contact): string | undefined {
    return c.type === 'persona_fisica' ? c.profesion : c.sectorActividad;
  }

  getPhone(c: Contact): string | undefined {
    return  c.mobile;
  }

  totalBilled(): number {
    return this.contactService.contacts().reduce((sum, c) => sum + (c.totalBilled ?? 0), 0);
  }

  activeCount(): number {
    return this.contactService.contacts().filter((c) => c.status === 'activo').length;
  }

  showStep1Fields = computed(() => !!this.editingId() || this.formStep() === 1);
  showStep2Fields = computed(() => !!this.editingId() || this.formStep() === 2);

  /**
   * Falta una vía de contacto: NI email NI móvil. Regla de negocio: un contacto
   * necesita al menos UNA forma de contacto, no las dos.
   * Método (no computed) a propósito: lee el form, que no es señal.
   */
  missingContactChannel(): boolean {
    const v = this.form.getRawValue();
    return !v.email?.trim() && !v.mobile?.trim();
  }

  /**
   * Valida el paso 1 ANTES de avanzar/guardar. Método (no computed): los
   * Reactive Forms no son signals, así que un computed se quedaría stale.
   */
  step1Valid(): boolean {
    const v = this.form.getRawValue();
    const emailFormatOk = !this.form.get('email')?.invalid; // vacío = válido
    const channelOk = !this.missingContactChannel(); // email O móvil
    const baseOk = emailFormatOk && channelOk;
    if (this.formType() === 'persona_fisica') {
      return baseOk && !!v.nombre?.trim() && !!v.apellidos?.trim();
    }
    return baseOk && !!v.razonSocial?.trim();
  }

  nextStep() {
    if (!this.step1Valid()) {
      this.showErrors.set(true);
      return;
    }
    this.showErrors.set(false);
    this.formStep.set(2);
  }

  prevStep() {
    this.formStep.set(1);
  }

  openNew() {
    this.editingId.set(null);
    this.formType.set('persona_fisica');
    this.formStep.set(1);
    this.showErrors.set(false);
    this.form.reset({
      status: 'activo', nifType: 'dni', cifType: 'cif', pais: 'ES', nacionalidad: 'ES', estadoCivil: 'casado',
    });
    this.showDrawer.set(true);
  }

  openEdit(contact: Contact) {
    this.editingId.set(contact.id);
    this.formType.set(contact.type);
    const dir =
      contact.type === 'persona_fisica' ? contact.direccion : contact.direccionSocial;
    const base = {
      email: contact.email,
      mobile: contact.mobile ?? '',
      status: contact.status,
      notes: contact.notes ?? '',
      calle: dir?.calle ?? '',
      numero: dir?.numero ?? '',
      codigoPostal: dir?.codigoPostal ?? '',
      municipio: dir?.municipio ?? '',
      provincia: dir?.provincia ?? '',
      pais: dir?.pais ?? 'ES',
    };
    if (contact.type === 'persona_fisica') {
      this.form.patchValue({
        ...base,
        nombre: contact.nombre,
        apellidos: contact.apellidos,
        nifType: contact.nifType,
        nif: contact.nif ?? '',
        nacionalidad: contact.nacionalidad ?? 'ES',
        estadoCivil: contact.estadoCivil ?? '',
      });
    } else {
      this.form.patchValue({
        ...base,
        razonSocial: contact.razonSocial,
        nombreComercial: contact.nombreComercial ?? '',
        formaJuridica: contact.formaJuridica ?? '',
        cifType: contact.cifType,
        cif: contact.cif ?? '',
        sectorActividad: contact.sectorActividad ?? '',
        website: contact.website ?? '',
        representanteLegalNombre: contact.representanteLegalNombre ?? '',
      });
    }
    this.showDrawer.set(true);
  }

  async saveContact() {
    // Validación ANTES de tocar Firestore — aplica tanto al crear como al
    // editar (antes el edit se saltaba el chequeo y podía vaciar campos).
    if (!this.step1Valid()) {
      this.showErrors.set(true);
      this.formStep.set(1);
      return;
    }
    this.isSaving.set(true);
    try {
      const v = this.form.getRawValue();
      const base = {
        email: v.email || '',
        mobile: v.mobile || '',
        status: v.status as ContactStatus,
        notes: v.notes || '',
      };
      const direccion = {
        calle: v.calle || '',
        numero: v.numero || '',
        codigoPostal: v.codigoPostal || '',
        municipio: v.municipio || '',
        provincia: v.provincia || '',
        pais: v.pais || 'ES',
      };

      let data: ContactPayload;
      if (this.formType() === 'persona_fisica') {
        data = {
          type: 'persona_fisica',
          ...base,
          nombre: v.nombre!,
          apellidos: v.apellidos!,
          nifType: v.nifType as PersonaFisica['nifType'],
          nif: v.nif || '',
          nacionalidad: v.nacionalidad || 'ES',
          estadoCivil: (v.estadoCivil as PersonaFisica['estadoCivil']) || 'casado',
          direccion,
        };
      } else {
        data = {
          type: 'persona_juridica',
          ...base,
          razonSocial: v.razonSocial!,
          nombreComercial: v.nombreComercial || '',
          formaJuridica: v.formaJuridica || '',
          cifType: v.cifType as 'cif' | 'vat' | 'otro',
          cif: v.cif || '',
          sectorActividad: v.sectorActividad || '',
          website: v.website || '',
          representanteLegalNombre: v.representanteLegalNombre || '',
          direccionSocial: direccion,
        };
      }

      const editId = this.editingId();
      await this.toast.run(
        () =>
          editId
            ? this.contactService.updateContact(editId, data as Record<string, unknown>)
            : this.contactService.createContact(data),
        {
          successMessage: editId ? 'Contacto actualizado' : 'Contacto creado',
          errorTitle: 'No se pudo guardar el contacto',
          // El drawer se cierra SOLO si la escritura terminó bien. Si falla,
          // queda abierto con los datos para reintentar desde el toast.
          onSuccess: () => this.closeDrawer(),
        }
      );
    } finally {
      this.isSaving.set(false);
    }
  }

  closeDrawer() {
    this.showDrawer.set(false);
    this.editingId.set(null);
    this.formStep.set(1);
    this.showErrors.set(false);
    this.form.reset({ status: 'activo', nifType: 'dni', cifType: 'cif', pais: 'ES', nacionalidad: 'ES', estadoCivil: 'casado' });
  }

  abrirCaso(contactId: string): void {
    this.router.navigate(['/casos'], { queryParams: { newCaso: '1', contactId } });
  }

  async confirmDelete(id: string) {
    await this.toast.run(() => this.contactService.deleteContact(id), {
      successMessage: 'Contacto eliminado',
      errorTitle: 'No se pudo eliminar el contacto',
      onSuccess: () => this.deleteConfirmId.set(null),
    });
  }
}
