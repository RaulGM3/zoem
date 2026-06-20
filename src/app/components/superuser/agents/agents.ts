import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Bot, Check, LucideAngularModule, Pencil, Plus, Search, Trash2, X } from 'lucide-angular';
import { AgentMappingService } from '../../../core/services/agent-mapping.service';
import { ToastService } from '../../../core/services/toast.service';
import { SuperuserService } from '../../../services/superuser';
import { AgentMapping } from '../../../interfaces/agent-mapping.interface';

@Component({
  selector: 'app-agents',
  imports: [ReactiveFormsModule, LucideAngularModule],
  templateUrl: './agents.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AgentsComponent {
  readonly BotIcon = Bot;
  readonly SearchIcon = Search;
  readonly PlusIcon = Plus;
  readonly EditIcon = Pencil;
  readonly Trash2Icon = Trash2;
  readonly XIcon = X;
  readonly CheckIcon = Check;

  private readonly fb = inject(FormBuilder);
  private readonly svc = inject(AgentMappingService);
  private readonly companiesSvc = inject(SuperuserService);
  private readonly toast = inject(ToastService);

  readonly mappings = toSignal(this.svc.getAll(), { initialValue: [] });
  readonly companies = toSignal(this.companiesSvc.getCompanies(), { initialValue: [] });

  readonly search = signal('');
  readonly showForm = signal(false);
  readonly editing = signal(false);
  readonly saving = signal(false);

  readonly companyName = computed(() => {
    const map = new Map(this.companies().map((c) => [c.id, c.name]));
    return (companyId: string) => map.get(companyId) ?? '—';
  });

  readonly filtered = computed(() => {
    const q = this.search().toLowerCase();
    const list = this.mappings();
    if (!q) return list;
    return list.filter(
      (m) =>
        m.agentId.toLowerCase().includes(q) ||
        (m.label ?? '').toLowerCase().includes(q) ||
        this.companyName()(m.companyId).toLowerCase().includes(q),
    );
  });

  readonly form = this.fb.group({
    agentId: ['', Validators.required],
    companyId: ['', Validators.required],
    label: [''],
  });

  openCreate(): void {
    this.editing.set(false);
    this.form.reset({ agentId: '', companyId: '', label: '' });
    this.form.get('agentId')?.enable();
    this.showForm.set(true);
  }

  openEdit(mapping: AgentMapping): void {
    this.editing.set(true);
    this.form.reset({
      agentId: mapping.agentId,
      companyId: mapping.companyId,
      label: mapping.label ?? '',
    });
    // El agentId es el doc id: no se renombra (se borra y se crea otro).
    this.form.get('agentId')?.disable();
    this.showForm.set(true);
  }

  async save(): Promise<void> {
    if (this.form.invalid || this.saving()) return;
    this.saving.set(true);
    try {
      const raw = this.form.getRawValue();
      await this.toast.run(
        () => this.svc.set({
          agentId: raw.agentId!.trim(),
          companyId: raw.companyId!,
          companyName: this.companyName()(raw.companyId!),
          label: raw.label?.trim() || undefined,
        }),
        {
          successMessage: 'Mapeo guardado',
          errorTitle: 'No se pudo guardar el mapeo',
          onSuccess: () => this.showForm.set(false),
        }
      );
    } finally {
      this.saving.set(false);
    }
  }

  async delete(agentId: string): Promise<void> {
    await this.toast.run(() => this.svc.remove(agentId), {
      successMessage: 'Mapeo eliminado',
      errorTitle: 'No se pudo eliminar el mapeo',
    });
  }
}
