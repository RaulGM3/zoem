import { Component, ChangeDetectionStrategy, input, output, signal, effect } from '@angular/core';
import { LucideAngularModule, User, X, Mail, Phone, Hash } from 'lucide-angular';
import type { Caso, CasoEstado, CasoPrioridad, CasoTipo, Contact } from '../../../../interfaces';
import { getContactDisplayName } from '../../../../interfaces';

export interface CasoInfoFormData {
  titulo: string;
  descripcion?: string;
  tipo: CasoTipo;
  estado: CasoEstado;
  prioridad: CasoPrioridad;
  vencimiento?: string;
}

@Component({
  selector: 'app-caso-info-tab',
  host: { style: 'display: block' },
  imports: [LucideAngularModule],
  templateUrl: './caso-info-tab.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CasoInfoTabComponent {
  readonly caso = input.required<Caso>();
  readonly editing = input.required<boolean>();
  readonly saving = input.required<boolean>();
  readonly linkedContacts = input.required<Contact[]>();
  readonly searchResults = input.required<Contact[]>();
  readonly contactSearch = input.required<string>();
  readonly noResults = input(false);
  /** Gating de permisos (`Casos.editar`): oculta añadir/quitar contactos si no aplica. */
  readonly canEdit = input(true);

  readonly cancelEdit = output<void>();
  readonly saveInfo = output<CasoInfoFormData>();
  readonly searchChange = output<string>();
  readonly addContact = output<string>();
  readonly removeContact = output<string>();

  readonly UserIcon = User;
  readonly XIcon = X;
  readonly MailIcon = Mail;
  readonly PhoneIcon = Phone;
  readonly HashIcon = Hash;

  readonly editTitulo = signal('');
  readonly editDescripcion = signal('');
  readonly editTipo = signal<CasoTipo>('Legal');
  readonly editEstado = signal<CasoEstado>('pendiente');
  readonly editPrioridad = signal<CasoPrioridad>('media');
  readonly editVencimiento = signal('');

  readonly contactToDelete = signal<Contact | null>(null);

  readonly tipos: readonly CasoTipo[] = ['Legal', 'Fiscal', 'Laboral', 'Mercantil', 'Civil'];
  readonly estados: readonly CasoEstado[] = ['pendiente', 'en_proceso', 'cerrado', 'urgente', 'archivado'];
  readonly prioridades: readonly CasoPrioridad[] = ['alta', 'media', 'baja'];

  constructor() {
    effect(() => {
      if (this.editing()) {
        const c = this.caso();
        this.editTitulo.set(c.titulo);
        this.editDescripcion.set(c.descripcion ?? '');
        this.editTipo.set(c.tipo);
        this.editEstado.set(c.estado);
        this.editPrioridad.set(c.prioridad);
        this.editVencimiento.set(c.vencimiento ?? '');
      }
    });
  }

  submit(): void {
    const titulo = this.editTitulo().trim();
    if (!titulo) return;
    this.saveInfo.emit({
      titulo,
      descripcion: this.editDescripcion().trim() || undefined,
      tipo: this.editTipo(),
      estado: this.editEstado(),
      prioridad: this.editPrioridad(),
      vencimiento: this.editVencimiento() || undefined,
    });
  }

  displayName(c: Contact): string {
    return getContactDisplayName(c);
  }

  getContactId(c: Contact): string | undefined {
    return c.type === 'persona_fisica' ? c.nif : c.cif;
  }

  getContactIdLabel(c: Contact): string {
    if (c.type === 'persona_fisica') return c.nifType?.toUpperCase() ?? 'NIF';
    return c.cifType?.toUpperCase() ?? 'CIF';
  }

  getContactPhone(c: Contact): string | undefined {
    return c.mobile ?? c.phone;
  }

  askRemoveContact(c: Contact): void {
    this.contactToDelete.set(c);
  }

  confirmRemoveContact(): void {
    const c = this.contactToDelete();
    if (c) this.removeContact.emit(c.id);
    this.contactToDelete.set(null);
  }

  cancelRemoveContact(): void {
    this.contactToDelete.set(null);
  }

  onSearchInput(value: string): void {
    // Primera letra siempre en mayúscula. El filtrado en el padre normaliza a
    // minúsculas, así que esto es puramente cosmético y no rompe la búsqueda.
    const capitalized = value.length > 0 ? value.charAt(0).toUpperCase() + value.slice(1) : value;
    this.searchChange.emit(capitalized);
  }

  getEstadoStyle(estado: string): { background: string; color: string } {
    const mix = (v: string) => `color-mix(in srgb,${v} 12%,transparent)`;
    const map: Record<string, { background: string; color: string }> = {
      pendiente:  { background: mix('var(--warning)'), color: 'var(--warning)' },
      en_proceso: { background: mix('var(--brand)'),   color: 'var(--brand)' },
      cerrado:    { background: 'var(--surface-2)',     color: 'var(--text-muted)' },
      urgente:    { background: mix('var(--danger)'),   color: 'var(--danger)' },
      archivado:  { background: 'var(--surface-2)',     color: 'var(--text-faint)' },
    };
    return map[estado] ?? { background: 'var(--surface-2)', color: 'var(--text-muted)' };
  }

  getTipoStyle(tipo: string): { background: string; color: string } {
    const mix = (v: string) => `color-mix(in srgb,${v} 12%,transparent)`;
    const map: Record<string, { background: string; color: string }> = {
      Legal:     { background: mix('var(--accent-ia)'), color: 'var(--accent-ia)' },
      Fiscal:    { background: mix('var(--brand)'),     color: 'var(--brand)' },
      Laboral:   { background: mix('var(--warning)'),   color: 'var(--warning)' },
      Mercantil: { background: mix('var(--success)'),   color: 'var(--success)' },
      Civil:     { background: 'var(--surface-2)',       color: 'var(--text-muted)' },
    };
    return map[tipo] ?? { background: 'var(--surface-2)', color: 'var(--text-muted)' };
  }
}
