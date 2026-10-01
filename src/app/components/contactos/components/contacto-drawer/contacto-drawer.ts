import {
  Component, ChangeDetectionStrategy, computed, effect, inject, input, output, signal, untracked,
} from '@angular/core';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { LucideAngularModule, Check, LoaderCircle } from 'lucide-angular';
import { ContactService } from '../../../../core/services/contact.service';
import { UsersService } from '../../../../core/services/users';
import { ToastService } from '../../../../core/services/toast.service';
import {
  Contact, PersonaFisica, PersonaJuridica, ContactStatus, CanalEntrada,
  CONTACT_STATUS_OPTIONS, CANAL_ENTRADA_LABELS,
} from '../../../../interfaces';
import { normalizarNif, validarNif } from '../../../../core/fiscal/nif';
import { FocusTrapDirective } from '../../../../shared/directives/focus-trap.directive';

type ContactPayload =
  | Omit<PersonaFisica, 'id' | 'companyId' | 'createdAt' | 'updatedAt'>
  | Omit<PersonaJuridica, 'id' | 'companyId' | 'createdAt' | 'updatedAt'>;

/** Datos con los que puede llegar precargada un alta (Recepción IA, agente). */
export type ContactoPrefill = Partial<Record<'nombre' | 'apellidos' | 'mobile' | 'notes', string>>;

const FORM_DEFAULTS = {
  status: 'activo', nifType: 'dni', cifType: 'cif', pais: 'ES', nacionalidad: 'ES', estadoCivil: 'casado',
};

/**
 * Drawer de alta/edición de un contacto. Persiste por sí mismo y avisa al padre
 * con `saved`; no se desmonta solo: el padre lo quita al recibir `saved`/`closed`.
 */
@Component({
  selector: 'app-contacto-drawer',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LucideAngularModule, ReactiveFormsModule, FocusTrapDirective],
  templateUrl: './contacto-drawer.html',
})
export class ContactoDrawerComponent {
  /** Contacto a editar; `null` para un alta. */
  readonly contact = input<Contact | null>(null);
  /** Datos de partida de un alta. Se ignora al editar. */
  readonly prefill = input<ContactoPrefill | null>(null);

  readonly closed = output<void>();
  /** Guardado correcto: el contacto creado, o `null` si fue una edición. */
  readonly saved = output<Contact | null>();

  readonly CheckIcon = Check;
  readonly Loader2Icon = LoaderCircle;

  private readonly contactService = inject(ContactService);
  readonly usersService = inject(UsersService);
  private readonly toast = inject(ToastService);
  private readonly fb = inject(FormBuilder);

  readonly contactStatuses = CONTACT_STATUS_OPTIONS;

  readonly canalesEntrada: readonly { value: CanalEntrada; label: string }[] = (
    Object.entries(CANAL_ENTRADA_LABELS) as [CanalEntrada, string][]
  ).map(([value, label]) => ({ value, label }));

  readonly editingId = computed(() => this.contact()?.id ?? null);
  formType = signal<'persona_fisica' | 'persona_juridica'>('persona_fisica');
  isSaving = signal(false);
  formStep = signal<1 | 2>(1);
  showErrors = signal(false);

  form = this.fb.group({
    email: ['', [Validators.email]],
    mobile: [''],
    status: ['activo', Validators.required],
    notes: [''],
    asunto: [''],
    canalEntrada: ['' as CanalEntrada | ''],
    assignedTo: [''],
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
    // Cada vez que cambian los datos de partida (también con el drawer ya
    // abierto: una segunda petición del agente) el formulario arranca de cero.
    effect(() => {
      const contact = this.contact();
      const prefill = this.prefill();
      untracked(() => this.iniciar(contact, prefill));
    });
  }

  private iniciar(contact: Contact | null, prefill: ContactoPrefill | null): void {
    this.formStep.set(1);
    this.showErrors.set(false);
    this.form.reset(FORM_DEFAULTS);
    if (contact) {
      this.cargarContacto(contact);
      return;
    }
    this.formType.set('persona_fisica');
    if (prefill) {
      this.form.patchValue({
        nombre: prefill.nombre ?? '',
        apellidos: prefill.apellidos ?? '',
        mobile: prefill.mobile ?? '',
        notes: prefill.notes ?? '',
      });
    }
  }

  private cargarContacto(contact: Contact): void {
    this.formType.set(contact.type);
    const dir =
      contact.type === 'persona_fisica' ? contact.direccion : contact.direccionSocial;
    const base = {
      email: contact.email,
      mobile: contact.mobile ?? '',
      status: contact.status,
      notes: contact.notes ?? '',
      asunto: contact.asunto ?? '',
      canalEntrada: (contact.canalEntrada ?? '') as CanalEntrada | '',
      assignedTo: contact.assignedTo ?? '',
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
  /**
   * Número de documento español (DNI/NIE o NIF de empresa) con formato o letra de control
   * erróneos. Los documentos extranjeros (pasaporte, VAT, otro) y el vacío no se validan.
   */
  documentoInvalido(): boolean {
    const v = this.form.getRawValue();
    const fisica = this.formType() === 'persona_fisica';
    if (!this.esDocumentoEspanol()) return false;
    const resultado = validarNif(fisica ? (v.nif ?? '') : (v.cif ?? ''));
    return !resultado.ok && resultado.motivo !== 'vacio';
  }

  /** ¿Mostrar el error del número de documento? Tras intentar avanzar o al salir del campo. */
  mostrarErrorDocumento(): boolean {
    const control = this.form.get(this.formType() === 'persona_fisica' ? 'nif' : 'cif');
    return this.documentoInvalido() && (this.showErrors() || !!control?.touched);
  }

  private esDocumentoEspanol(): boolean {
    const v = this.form.getRawValue();
    return this.formType() === 'persona_fisica' ? v.nifType === 'dni' || v.nifType === 'nie' : v.cifType === 'cif';
  }

  /** Español: normalizado (mayúsculas, sin separadores ni prefijo ES); extranjero: tal cual, recortado. */
  private documentoParaGuardar(valor: string | null | undefined): string {
    return this.esDocumentoEspanol() ? normalizarNif(valor ?? '') : (valor ?? '').trim();
  }

  step1Valid(): boolean {
    const v = this.form.getRawValue();
    const emailFormatOk = !this.form.get('email')?.invalid; // vacío = válido
    const channelOk = !this.missingContactChannel(); // email O móvil
    const baseOk = emailFormatOk && channelOk && !this.documentoInvalido();
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

  close() {
    this.closed.emit();
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
        asunto: v.asunto || undefined,
        canalEntrada: (v.canalEntrada || undefined) as CanalEntrada | undefined,
        assignedTo: v.assignedTo || undefined,
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
          nif: this.documentoParaGuardar(v.nif),
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
          cif: this.documentoParaGuardar(v.cif),
          sectorActividad: v.sectorActividad || '',
          website: v.website || '',
          representanteLegalNombre: v.representanteLegalNombre || '',
          direccionSocial: direccion,
        };
      }

      const editId = this.editingId();
      const updatePayload: Record<string, unknown> = editId
        ? this.withClearedPreviousTypeFields(data as Record<string, unknown>)
        : (data as Record<string, unknown>);
      let creado: Contact | null = null;
      await this.toast.run(
        async () => {
          if (editId) {
            await this.contactService.updateContact(editId, updatePayload);
            return;
          }
          creado = await this.contactService.createContact(data);
        },
        {
          successMessage: editId ? 'Contacto actualizado' : 'Contacto creado',
          errorTitle: 'No se pudo guardar el contacto',
          // Se avisa al padre SOLO si la escritura terminó bien. Si falla, el
          // drawer queda abierto con los datos para reintentar desde el toast.
          onSuccess: () => this.saved.emit(creado),
        }
      );
    } finally {
      this.isSaving.set(false);
    }
  }

  /**
   * `updateContact` hace un merge-update en Firestore: si el usuario cambia
   * el tipo de contacto (Persona Física ↔ Jurídica) a mitad de una edición,
   * los campos del tipo ANTERIOR (p.ej. `nombre`/`apellidos`/`nif` al pasar a
   * jurídica) nunca se limpiaban y quedaban conviviendo con los nuevos —
   * documento híbrido/corrupto. Aquí los ponemos explícitamente a `null`
   * antes de enviar el update, solo cuando el tipo realmente cambió.
   */
  private withClearedPreviousTypeFields(data: Record<string, unknown>): Record<string, unknown> {
    const originalType = this.contact()?.type ?? null;
    if (!originalType || originalType === this.formType()) {
      return data;
    }
    const personaFisicaFields = {
      nombre: null, apellidos: null, nifType: null, nif: null,
      nacionalidad: null, estadoCivil: null, profesion: null, direccion: null,
      lugarNacimiento: null,
    };
    const personaJuridicaFields = {
      razonSocial: null, nombreComercial: null, formaJuridica: null, cifType: null,
      cif: null, fechaConstitucion: null, registroMercantil: null, sectorActividad: null,
      website: null, direccionSocial: null, direccionFiscal: null,
      representanteLegalNombre: null, representanteLegalId: null,
    };
    const clearedFields = originalType === 'persona_fisica' ? personaFisicaFields : personaJuridicaFields;
    return { ...clearedFields, ...data };
  }
}
