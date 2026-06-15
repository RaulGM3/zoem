import { Component, ChangeDetectionStrategy, input, output, signal, effect } from '@angular/core';
import { LucideAngularModule, User, X } from 'lucide-angular';
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

  readonly cancelEdit = output<void>();
  readonly saveInfo = output<CasoInfoFormData>();
  readonly searchChange = output<string>();
  readonly addContact = output<string>();
  readonly removeContact = output<string>();

  readonly UserIcon = User;
  readonly XIcon = X;

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

  getEstadoClass(estado: string): string {
    const map: Record<string, string> = {
      pendiente: 'bg-amber-100 text-amber-700',
      en_proceso: 'bg-blue-100 text-blue-700',
      cerrado: 'bg-slate-100 text-slate-500',
      urgente: 'bg-red-100 text-red-700',
      archivado: 'bg-slate-100 text-slate-400',
    };
    return map[estado] ?? 'bg-slate-100 text-slate-600';
  }

  getTipoClass(tipo: string): string {
    const map: Record<string, string> = {
      Legal: 'bg-violet-100 text-violet-700',
      Fiscal: 'bg-blue-100 text-blue-700',
      Laboral: 'bg-amber-100 text-amber-700',
      Mercantil: 'bg-emerald-100 text-emerald-700',
      Civil: 'bg-slate-100 text-slate-600',
    };
    return map[tipo] ?? 'bg-slate-100 text-slate-600';
  }
}
