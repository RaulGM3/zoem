import { Component, signal, computed, inject, ChangeDetectionStrategy } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import {
  LucideAngularModule,
  Users, Search, Plus, Phone, Mail, Building2,
  Eye, Edit, Trash2, ChevronRight, ChevronLeft, UserPlus, TrendingUp,
  GitMerge, Shield, Brain, ArrowRight, X, Check, LoaderCircle,
} from 'lucide-angular';
import { PIPELINE_DEALS } from '../../data/dummy-data';
import { ContactService } from '../../core/services/contact.service';
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
  readonly SearchIcon = Search;
  readonly PlusIcon = Plus;
  readonly PhoneIcon = Phone;
  readonly MailIcon = Mail;
  readonly Building2Icon = Building2;
  readonly EyeIcon = Eye;
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

  readonly contactService = inject(ContactService);
  private readonly fb = inject(FormBuilder);

  activeTab = signal<ContactosTab>('contactos');
  search = signal('');
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
    email: ['', [Validators.required, Validators.email]],
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
    this.contactService.loadContacts();
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
    return this.contactService.contacts().filter((c) => {
      const name = getContactDisplayName(c).toLowerCase();
      const matchQ = !q || name.includes(q) || c.email.toLowerCase().includes(q);
      const matchS = !s || c.status === s;
      const matchT = !t || c.type === t;
      return matchQ && matchS && matchT;
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

  step1Valid = computed(() => {
    const v = this.form.getRawValue();
    const emailOk = !this.form.get('email')?.invalid;
    const mobileOk = !!v.mobile?.trim();
    if (this.formType() === 'persona_fisica') {
      return emailOk && mobileOk && !!v.nombre?.trim() && !!v.apellidos?.trim() && !!v.nif?.trim();
    }
    return emailOk && mobileOk && !!v.razonSocial?.trim() && !!v.cif?.trim();
  });

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
    if (this.form.invalid) return;
    if (!this.editingId() && !this.step1Valid()) {
      this.showErrors.set(true);
      this.formStep.set(1);
      return;
    }
    this.isSaving.set(true);
    try {
      const v = this.form.getRawValue();
      const base = {
        email: v.email!,
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
      if (editId) {
        await this.contactService.updateContact(editId, data as Record<string, unknown>);
      } else {
        await this.contactService.createContact(data);
      }
      this.closeDrawer();
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

  async confirmDelete(id: string) {
    await this.contactService.deleteContact(id);
    this.deleteConfirmId.set(null);
  }
}
