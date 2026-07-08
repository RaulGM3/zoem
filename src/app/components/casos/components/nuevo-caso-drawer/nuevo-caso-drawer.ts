import { Component, ChangeDetectionStrategy, input, output, signal, computed, effect, inject } from '@angular/core';
import { LucideAngularModule, X, Plus, Search } from 'lucide-angular';
import type { CasoEstado, CasoPrioridad, CasoTipo, CreateCasoData } from '../../../../interfaces';
import type { CasoPlantilla } from '../../../../interfaces';
import type { Contact } from '../../../../interfaces';
import { getContactDisplayName } from '../../../../interfaces';
import { ContactService } from '../../../../core/services/contact.service';
import { UsersService } from '../../../../core/services/users';

@Component({
  selector: 'app-nuevo-caso-drawer',
  imports: [LucideAngularModule],
  templateUrl: './nuevo-caso-drawer.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NuevoCasoDrawerComponent {
  private readonly contactService = inject(ContactService);
  readonly usersService = inject(UsersService);

  readonly visible = input.required<boolean>();
  readonly plantillas = input.required<CasoPlantilla[]>();
  readonly saving = input.required<boolean>();
  readonly initialContact = input<Contact | null>(null);
  readonly initialData = input<{ titulo?: string; descripcion?: string; tipo?: CasoTipo; prioridad?: CasoPrioridad; estado?: CasoEstado } | null>(null);

  readonly saved = output<CreateCasoData>();
  readonly closed = output<void>();
  readonly crearContacto = output<void>();

  readonly XIcon = X;
  readonly PlusIcon = Plus;
  readonly SearchIcon = Search;

  readonly estados: readonly CasoEstado[] = ['pendiente', 'en_proceso', 'cerrado', 'urgente', 'archivado'];
  readonly tipos: readonly CasoTipo[] = ['Legal', 'Fiscal', 'Laboral', 'Mercantil', 'Civil'];
  readonly prioridades: readonly CasoPrioridad[] = ['alta', 'media', 'baja'];

  readonly formTitulo = signal('');
  readonly formDescripcion = signal('');
  readonly formTipo = signal<CasoTipo>('Legal');
  readonly formEstado = signal<CasoEstado>('pendiente');
  readonly formPrioridad = signal<CasoPrioridad>('media');
  readonly formVencimiento = signal('');
  readonly formSinVencimiento = signal(false);
  readonly formPlantillaId = signal('');
  readonly formEncargadoId = signal('');

  readonly clienteSeleccionado = signal<Contact | null>(null);
  readonly buscadorQuery = signal('');
  readonly showDropdown = signal(false);

  readonly contactosFiltrados = computed(() => {
    const q = this.buscadorQuery().trim().toLowerCase();
    if (!q) return [];
    return this.contactService.contacts().filter(c => {
      const nombre = getContactDisplayName(c).toLowerCase();
      const nif = c.type === 'persona_fisica' ? (c.nif ?? '').toLowerCase() : (c.cif ?? '').toLowerCase();
      const email = c.email.toLowerCase();
      const phone = `${c.phone ?? ''} ${c.mobile ?? ''}`.toLowerCase();
      return nombre.includes(q) || nif.includes(q) || email.includes(q) || phone.includes(q);
    }).slice(0, 8);
  });

  readonly showErrors = signal(false);
  readonly canSubmit = computed(() => !!this.formTitulo().trim() && !!this.clienteSeleccionado());

  constructor() {
    effect(() => {
      if (this.visible()) {
        this.resetForm();
        if (this.contactService.contacts().length === 0) {
          this.contactService.loadContacts();
        }
        if (this.usersService.members().length === 0) {
          this.usersService.loadMembers();
        }
        const preContact = this.initialContact();
        if (preContact) {
          this.clienteSeleccionado.set(preContact);
          this.formEncargadoId.set(preContact.assignedTo ?? '');
        }
        const data = this.initialData();
        if (data?.titulo)      this.formTitulo.set(data.titulo);
        if (data?.descripcion) this.formDescripcion.set(data.descripcion);
        if (data?.tipo)        this.formTipo.set(data.tipo);
        if (data?.prioridad)   this.formPrioridad.set(data.prioridad);
        if (data?.estado)      this.formEstado.set(data.estado);
      }
    });
  }

  private resetForm(): void {
    this.formTitulo.set('');
    this.formDescripcion.set('');
    this.formTipo.set('Legal');
    this.formEstado.set('pendiente');
    this.formPrioridad.set('media');
    this.formVencimiento.set('');
    this.formSinVencimiento.set(false);
    this.formPlantillaId.set('');
    this.formEncargadoId.set('');
    this.clienteSeleccionado.set(null);
    this.buscadorQuery.set('');
    this.showDropdown.set(false);
    this.showErrors.set(false);
  }

  onPlantillaChange(id: string): void {
    this.formPlantillaId.set(id);
    const plantilla = this.plantillas().find(p => p.id === id);
    if (plantilla?.tipo) this.formTipo.set(plantilla.tipo);
  }

  onBuscadorInput(value: string): void {
    this.buscadorQuery.set(value);
    this.showDropdown.set(true);
  }

  onBuscadorBlur(): void {
    setTimeout(() => this.showDropdown.set(false), 200);
  }

  selectCliente(c: Contact): void {
    this.clienteSeleccionado.set(c);
    this.formEncargadoId.set(c.assignedTo ?? '');
    this.buscadorQuery.set('');
    this.showDropdown.set(false);
  }

  clearCliente(): void {
    this.clienteSeleccionado.set(null);
    this.formEncargadoId.set('');
    this.buscadorQuery.set('');
  }

  displayName(c: Contact): string {
    return getContactDisplayName(c);
  }

  submit(): void {
    const titulo = this.formTitulo().trim();
    const cliente = this.clienteSeleccionado();
    if (!titulo || !cliente) {
      this.showErrors.set(true);
      return;
    }
    this.saved.emit({
      titulo,
      descripcion: this.formDescripcion().trim() || undefined,
      tipo: this.formTipo(),
      estado: this.formEstado(),
      prioridad: this.formPrioridad(),
      vencimiento: this.formSinVencimiento() ? undefined : (this.formVencimiento() || undefined),
      contactoIds: [cliente.id],
      plantillaId: this.formPlantillaId() || undefined,
      encargadoId: this.formEncargadoId() || undefined,
    });
  }
}
