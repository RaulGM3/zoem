import {
  Component, OnInit, signal, computed,
  ChangeDetectionStrategy, inject,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  LucideAngularModule,
  Layers, Plus, X, Edit2, Trash2, ArrowLeft, GripVertical, ChevronDown, ChevronUp,
} from 'lucide-angular';
import { PlantillasService } from '../../core/services/plantillas.service';
import { UsersService } from '../../core/services/users';
import { CasoPlantilla, CasoTipo, HitoPlantilla, PartidaCosto, TipoCosto } from '../../interfaces';

@Component({
  selector: 'app-plantillas',
  imports: [LucideAngularModule, RouterLink],
  templateUrl: './plantillas.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PlantillasComponent implements OnInit {
  readonly plantillasService = inject(PlantillasService);
  readonly usersService = inject(UsersService);

  readonly LayersIcon = Layers;
  readonly PlusIcon = Plus;
  readonly XIcon = X;
  readonly Edit2Icon = Edit2;
  readonly Trash2Icon = Trash2;
  readonly ArrowLeftIcon = ArrowLeft;
  readonly GripVerticalIcon = GripVertical;
  readonly ChevronDownIcon = ChevronDown;
  readonly ChevronUpIcon = ChevronUp;

  showForm = signal(false);
  editingId = signal<string | null>(null);
  saving = signal(false);

  formNombre = signal('');
  formDescripcion = signal('');
  formTipo = signal<CasoTipo | ''>('');
  formHonorarios = signal('');

  formHitos = signal<HitoPlantilla[]>([]);
  formSuplidos = signal<PartidaCosto[]>([]);

  hitoTitulo = signal('');
  hitoDescripcion = signal('');
  hitoDias = signal('0');
  hitoAsignado = signal('');

  suplidoNombre = signal('');
  suplidoTipo = signal<TipoCosto | ''>('');
  suplidoImporte = signal('');

  tipos: CasoTipo[] = ['Legal', 'Fiscal', 'Laboral', 'Mercantil', 'Civil'];

  readonly tiposCosto: { value: TipoCosto; label: string }[] = [
    { value: 'gastos_repercutibles', label: 'Gastos repercutibles' },
    { value: 'suplido', label: 'Suplido' },
    { value: 'intereses_demora', label: 'Intereses de demora' },
    { value: 'saldos_clientes', label: 'Saldos de clientes' },
    { value: 'provisiones_fondos', label: 'Provisiones de fondos' },
    { value: 'cuota_litis', label: 'Cuota litis' },
    { value: 'costas_judiciales', label: 'Costas judiciales' },
  ];

  async ngOnInit(): Promise<void> {
    await Promise.all([
      this.plantillasService.loadPlantillas(),
      this.usersService.loadMembers(),
    ]);
  }

  openNew(): void {
    this.editingId.set(null);
    this.formNombre.set('');
    this.formDescripcion.set('');
    this.formTipo.set('');
    this.formHonorarios.set('');
    this.formHitos.set([]);
    this.formSuplidos.set([]);
    this.clearHitoForm();
    this.clearSuplidoForm();
    this.showForm.set(true);
  }

  async openEdit(p: CasoPlantilla): Promise<void> {
    const full = await this.plantillasService.getPlantilla(p.id);
    if (!full) return;
    this.editingId.set(full.id);
    this.formNombre.set(full.nombre);
    this.formDescripcion.set(full.descripcion ?? '');
    this.formTipo.set(full.tipo ?? '');
    this.formHonorarios.set(full.modeloCostos.honorariosBase?.toString() ?? '');
    this.formHitos.set([...full.hitos]);
    this.formSuplidos.set([...full.modeloCostos.suplidos]);
    this.clearHitoForm();
    this.clearSuplidoForm();
    this.showForm.set(true);
  }

  async save(): Promise<void> {
    if (!this.formNombre().trim()) return;
    this.saving.set(true);
    try {
      const data = {
        nombre: this.formNombre().trim(),
        descripcion: this.formDescripcion().trim() || undefined,
        tipo: this.formTipo() as CasoTipo || undefined,
        hitos: this.formHitos(),
        modeloCostos: {
          honorariosBase: this.formHonorarios() ? parseFloat(this.formHonorarios()) : undefined,
          suplidos: this.formSuplidos(),
        },
      };
      const id = this.editingId();
      if (id) {
        await this.plantillasService.updatePlantilla(id, data);
      } else {
        await this.plantillasService.createPlantilla(data);
      }
      this.showForm.set(false);
    } finally {
      this.saving.set(false);
    }
  }

  async deletePlantilla(id: string): Promise<void> {
    await this.plantillasService.deletePlantilla(id);
  }

  // Hitos de plantilla
  addHito(): void {
    if (!this.hitoTitulo().trim()) return;
    const current = this.formHitos();
    this.formHitos.set([
      ...current,
      {
        id: crypto.randomUUID(),
        titulo: this.hitoTitulo().trim(),
        descripcion: this.hitoDescripcion().trim() || undefined,
        diasDesdeInicio: parseInt(this.hitoDias(), 10) || 0,
        asignadoA: this.hitoAsignado() || undefined,
        orden: current.length,
      },
    ]);
    this.clearHitoForm();
  }

  removeHito(id: string): void {
    this.formHitos.update(list => list.filter(h => h.id !== id));
  }

  moveHito(index: number, dir: -1 | 1): void {
    const list = [...this.formHitos()];
    const target = index + dir;
    if (target < 0 || target >= list.length) return;
    [list[index], list[target]] = [list[target], list[index]];
    list.forEach((h, i) => (h.orden = i));
    this.formHitos.set(list);
  }

  clearHitoForm(): void {
    this.hitoTitulo.set('');
    this.hitoDescripcion.set('');
    this.hitoDias.set('0');
    const members = this.usersService.members();
    this.hitoAsignado.set(members.length === 1 ? members[0].userId : '');
  }

  // Estructura de costos
  addSuplido(): void {
    if (!this.suplidoNombre().trim() || !this.suplidoTipo()) return;
    const importe = this.suplidoImporte() ? parseFloat(this.suplidoImporte()) : undefined;
    this.formSuplidos.update(list => [
      ...list,
      {
        nombre: this.suplidoNombre().trim(),
        tipo: this.suplidoTipo() as TipoCosto,
        ...(importe != null ? { importeEstimado: importe } : {}),
      },
    ]);
    this.clearSuplidoForm();
  }

  removeSuplido(index: number): void {
    this.formSuplidos.update(list => list.filter((_, i) => i !== index));
  }

  clearSuplidoForm(): void {
    this.suplidoNombre.set('');
    this.suplidoTipo.set('');
    this.suplidoImporte.set('');
  }

  getTipoCostoLabel(tipo: TipoCosto): string {
    return this.tiposCosto.find(t => t.value === tipo)?.label ?? tipo;
  }

  getMemberName(userId?: string): string {
    if (!userId) return '—';
    const m = this.usersService.members().find(x => x.userId === userId);
    return m ? `${m.nombre}${m.apellido ? ' ' + m.apellido : ''}` : userId;
  }
}
