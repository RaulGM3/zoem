import {
  Component, ChangeDetectionStrategy, output, signal, inject, computed,
} from '@angular/core';
import { LucideAngularModule, X, Plus, Trash2, Building2, Wallet } from 'lucide-angular';
import { FormsModule } from '@angular/forms';
import { CuentasService } from '../../../../core/services/cuentas.service';
import { CuentaBancaria, CuentaTipo } from '../../../../interfaces';

interface CuentaForm {
  nombre: string;
  tipo: CuentaTipo;
  entidad: string;
  iban: string;
}

const EMPTY_FORM: CuentaForm = { nombre: '', tipo: 'banco', entidad: '', iban: '' };

@Component({
  selector: 'app-cuentas-drawer',
  imports: [LucideAngularModule, FormsModule],
  templateUrl: './cuentas-drawer.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CuentasDrawerComponent {
  private readonly cuentasService = inject(CuentasService);

  readonly closed = output<void>();

  readonly XIcon = X;
  readonly PlusIcon = Plus;
  readonly Trash2Icon = Trash2;
  readonly Building2Icon = Building2;
  readonly WalletIcon = Wallet;

  readonly cuentas = this.cuentasService.cuentas;
  readonly loading = this.cuentasService.loading;

  readonly showForm = signal(false);
  readonly editingId = signal<string | null>(null);
  readonly saving = signal(false);
  readonly deletingId = signal<string | null>(null);

  readonly form = signal<CuentaForm>({ ...EMPTY_FORM });

  readonly isBanco = computed(() => this.form().tipo === 'banco');

  openNew(): void {
    this.editingId.set(null);
    this.form.set({ ...EMPTY_FORM });
    this.showForm.set(true);
  }

  openEdit(cuenta: CuentaBancaria): void {
    this.editingId.set(cuenta.id);
    this.form.set({
      nombre: cuenta.nombre,
      tipo: cuenta.tipo,
      entidad: cuenta.entidad ?? '',
      iban: cuenta.iban ?? '',
    });
    this.showForm.set(true);
  }

  cancelForm(): void {
    this.showForm.set(false);
    this.editingId.set(null);
  }

  setTipo(tipo: CuentaTipo): void {
    this.form.update(f => ({ ...f, tipo, entidad: '', iban: '' }));
  }

  async save(): Promise<void> {
    const f = this.form();
    if (!f.nombre.trim()) return;
    this.saving.set(true);
    try {
      const data = {
        nombre: f.nombre.trim(),
        tipo: f.tipo,
        entidad: f.tipo === 'banco' && f.entidad.trim() ? f.entidad.trim() : undefined,
        iban: f.tipo === 'banco' && f.iban.trim() ? f.iban.trim() : undefined,
      };
      const id = this.editingId();
      if (id) {
        await this.cuentasService.updateCuenta(id, data);
      } else {
        await this.cuentasService.createCuenta(data);
      }
      this.showForm.set(false);
      this.editingId.set(null);
    } finally {
      this.saving.set(false);
    }
  }

  async delete(id: string): Promise<void> {
    this.deletingId.set(id);
    try {
      await this.cuentasService.deleteCuenta(id);
    } finally {
      this.deletingId.set(null);
    }
  }
}
