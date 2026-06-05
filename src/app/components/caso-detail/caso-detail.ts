import {
  Component, OnInit, signal, computed,
  ChangeDetectionStrategy, inject,
} from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { DecimalPipe } from '@angular/common';
import {
  LucideAngularModule,
  ArrowLeft, Edit2, Check, X, Plus, Trash2, User,
  TrendingUp, TrendingDown, Minus, ChevronRight,
  CheckCircle2, Circle, Clock, XCircle, Loader,
} from 'lucide-angular';
import { CasosService } from '../../core/services/casos.service';
import { GestoriaService } from '../../core/services/gestoria.service';
import { ContactService } from '../../core/services/contact.service';
import { UsersService } from '../../core/services/users';
import {
  Caso, CasoEstado, CasoPrioridad, CasoTipo,
  Hito, HitoEstado, MovimientoTipo,
  getContactDisplayName,
} from '../../interfaces';

type Tab = 'info' | 'hitos' | 'gestoria';

@Component({
  selector: 'app-caso-detail',
  imports: [LucideAngularModule, RouterLink, DecimalPipe],
  templateUrl: './caso-detail.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CasoDetailComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  readonly casosService = inject(CasosService);
  readonly gestoriaService = inject(GestoriaService);
  readonly contactService = inject(ContactService);
  readonly usersService = inject(UsersService);

  readonly ArrowLeftIcon = ArrowLeft;
  readonly Edit2Icon = Edit2;
  readonly CheckIcon = Check;
  readonly XIcon = X;
  readonly PlusIcon = Plus;
  readonly Trash2Icon = Trash2;
  readonly UserIcon = User;
  readonly TrendingUpIcon = TrendingUp;
  readonly TrendingDownIcon = TrendingDown;
  readonly MinusIcon = Minus;
  readonly ChevronRightIcon = ChevronRight;
  readonly CheckCircle2Icon = CheckCircle2;
  readonly CircleIcon = Circle;
  readonly ClockIcon = Clock;
  readonly XCircleIcon = XCircle;
  readonly LoaderIcon = Loader;

  caso = signal<Caso | null>(null);
  loading = signal(true);
  activeTab = signal<Tab>('info');

  // Edit info
  editingInfo = signal(false);
  editTitulo = signal('');
  editDescripcion = signal('');
  editTipo = signal<CasoTipo>('Legal');
  editEstado = signal<CasoEstado>('pendiente');
  editPrioridad = signal<CasoPrioridad>('media');
  editVencimiento = signal('');
  savingInfo = signal(false);

  // Contacts
  contactSearch = signal('');
  contactSearchResults = computed(() => {
    const q = this.contactSearch().toLowerCase().trim();
    if (!q || q.length < 2) return [];
    const linked = this.caso()?.contactoIds ?? [];
    return this.contactService.contacts()
      .filter(c => !linked.includes(c.id) && getContactDisplayName(c).toLowerCase().includes(q))
      .slice(0, 5);
  });
  linkedContacts = computed(() => {
    const ids = this.caso()?.contactoIds ?? [];
    return this.contactService.contacts().filter(c => ids.includes(c.id));
  });

  // Hitos
  showHitoForm = signal(false);
  editingHitoId = signal<string | null>(null);
  hitoTitulo = signal('');
  hitoDescripcion = signal('');
  hitoFechaEstimada = signal('');
  hitoAsignadoA = signal('');
  hitoEstado = signal<HitoEstado>('pendiente');
  savingHito = signal(false);

  hitosProgress = computed(() => {
    const hitos = this.caso()?.hitos ?? [];
    if (hitos.length === 0) return 0;
    const completados = hitos.filter(h => h.estado === 'completado').length;
    return Math.round((completados / hitos.length) * 100);
  });

  // Gestoría
  showMovForm = signal(false);
  movConcepto = signal('');
  movTipo = signal<MovimientoTipo>('ingreso');
  movImporte = signal('');
  movEsEntrada = signal(true);
  movFecha = signal('');
  movNotas = signal('');
  savingMov = signal(false);

  tipos: CasoTipo[] = ['Legal', 'Fiscal', 'Laboral', 'Mercantil', 'Civil'];
  estados: CasoEstado[] = ['pendiente', 'en_proceso', 'cerrado', 'urgente', 'archivado'];
  prioridades: CasoPrioridad[] = ['alta', 'media', 'baja'];
  hitoEstados: HitoEstado[] = ['pendiente', 'en_progreso', 'completado', 'cancelado'];
  movTipos: MovimientoTipo[] = ['ingreso', 'suplido', 'honorario', 'gasto', 'otro'];

  async ngOnInit(): Promise<void> {
    const id = this.route.snapshot.paramMap.get('id')!;
    await Promise.all([
      this.contactService.loadContacts(),
      this.usersService.loadMembers(),
      this.gestoriaService.loadMovimientos(id),
    ]);
    const caso = await this.casosService.getCaso(id);
    this.caso.set(caso);
    this.loading.set(false);
  }

  // ── Info ───────────────────────────────────────────────

  startEditInfo(): void {
    const c = this.caso()!;
    this.editTitulo.set(c.titulo);
    this.editDescripcion.set(c.descripcion ?? '');
    this.editTipo.set(c.tipo);
    this.editEstado.set(c.estado);
    this.editPrioridad.set(c.prioridad);
    this.editVencimiento.set(c.vencimiento ?? '');
    this.editingInfo.set(true);
  }

  async saveInfo(): Promise<void> {
    const id = this.caso()?.id;
    if (!id) return;
    this.savingInfo.set(true);
    try {
      await this.casosService.updateCaso(id, {
        titulo: this.editTitulo().trim(),
        descripcion: this.editDescripcion().trim() || undefined,
        tipo: this.editTipo(),
        estado: this.editEstado(),
        prioridad: this.editPrioridad(),
        vencimiento: this.editVencimiento() || undefined,
      });
      const updated = await this.casosService.getCaso(id);
      this.caso.set(updated);
      this.editingInfo.set(false);
    } finally {
      this.savingInfo.set(false);
    }
  }

  // ── Contacts ───────────────────────────────────────────

  async addContact(contactId: string): Promise<void> {
    const c = this.caso();
    if (!c) return;
    const newIds = [...c.contactoIds, contactId];
    await this.casosService.updateCaso(c.id, { contactoIds: newIds });
    this.caso.set({ ...c, contactoIds: newIds });
    this.contactSearch.set('');
  }

  async removeContact(contactId: string): Promise<void> {
    const c = this.caso();
    if (!c) return;
    const newIds = c.contactoIds.filter(id => id !== contactId);
    await this.casosService.updateCaso(c.id, { contactoIds: newIds });
    this.caso.set({ ...c, contactoIds: newIds });
  }

  getContactName(id: string): string {
    const c = this.contactService.contacts().find(x => x.id === id);
    return c ? getContactDisplayName(c) : id;
  }

  // ── Hitos ──────────────────────────────────────────────

  openNewHitoForm(): void {
    this.editingHitoId.set(null);
    this.hitoTitulo.set('');
    this.hitoDescripcion.set('');
    this.hitoFechaEstimada.set('');
    this.hitoAsignadoA.set('');
    this.hitoEstado.set('pendiente');
    this.showHitoForm.set(true);
  }

  startEditHito(hito: Hito): void {
    this.editingHitoId.set(hito.id);
    this.hitoTitulo.set(hito.titulo);
    this.hitoDescripcion.set(hito.descripcion ?? '');
    this.hitoFechaEstimada.set(hito.fechaEstimada ?? '');
    this.hitoAsignadoA.set(hito.asignadoA ?? '');
    this.hitoEstado.set(hito.estado);
    this.showHitoForm.set(true);
  }

  async saveHito(): Promise<void> {
    const c = this.caso();
    if (!c || !this.hitoTitulo().trim()) return;
    this.savingHito.set(true);
    try {
      const editId = this.editingHitoId();
      const hitoData = {
        titulo: this.hitoTitulo().trim(),
        ...(this.hitoDescripcion().trim() ? { descripcion: this.hitoDescripcion().trim() } : {}),
        ...(this.hitoFechaEstimada() ? { fechaEstimada: this.hitoFechaEstimada() } : {}),
        ...(this.hitoAsignadoA() ? { asignadoA: this.hitoAsignadoA() } : {}),
        estado: this.hitoEstado(),
      };

      if (editId) {
        await this.casosService.updateHito(c.id, editId, hitoData);
        this.caso.update(cur => cur
          ? { ...cur, hitos: cur.hitos.map(h => h.id === editId ? { ...h, ...hitoData } : h) }
          : null
        );
      } else {
        const newHito = await this.casosService.addHito(c.id, { ...hitoData, orden: c.hitos.length });
        this.caso.update(cur => cur ? { ...cur, hitos: [...cur.hitos, newHito] } : null);
      }
      this.showHitoForm.set(false);
    } finally {
      this.savingHito.set(false);
    }
  }

  async deleteHito(hitoId: string): Promise<void> {
    const c = this.caso();
    if (!c) return;
    await this.casosService.deleteHito(c.id, hitoId);
    this.caso.update(cur => cur ? { ...cur, hitos: cur.hitos.filter(h => h.id !== hitoId) } : null);
  }

  async toggleHitoEstado(hito: Hito): Promise<void> {
    const c = this.caso();
    if (!c) return;
    const next: HitoEstado = hito.estado === 'completado' ? 'pendiente' : 'completado';
    await this.casosService.updateHito(c.id, hito.id, { estado: next });
    this.caso.update(cur => cur
      ? { ...cur, hitos: cur.hitos.map(h => h.id === hito.id ? { ...h, estado: next } : h) }
      : null
    );
  }

  getMemberName(userId?: string): string {
    if (!userId) return '—';
    const m = this.usersService.members().find(x => x.userId === userId);
    return m ? `${m.nombre}${m.apellido ? ' ' + m.apellido : ''}` : userId;
  }

  // ── Gestoría ───────────────────────────────────────────

  openMovForm(): void {
    this.movConcepto.set('');
    this.movTipo.set('ingreso');
    this.movImporte.set('');
    this.movEsEntrada.set(true);
    this.movFecha.set(new Date().toISOString().slice(0, 10));
    this.movNotas.set('');
    this.showMovForm.set(true);
  }

  async saveMovimiento(): Promise<void> {
    const c = this.caso();
    if (!c || !this.movConcepto().trim() || !this.movImporte()) return;
    this.savingMov.set(true);
    try {
      await this.gestoriaService.addMovimiento(c.id, {
        tipo: this.movTipo(),
        concepto: this.movConcepto().trim(),
        importe: parseFloat(this.movImporte()),
        esEntrada: this.movEsEntrada(),
        fecha: this.movFecha(),
        notas: this.movNotas().trim() || undefined,
      });
      const updated = await this.casosService.getCaso(c.id);
      this.caso.set(updated);
      this.showMovForm.set(false);
    } finally {
      this.savingMov.set(false);
    }
  }

  async deleteMovimiento(movId: string): Promise<void> {
    const c = this.caso();
    if (!c) return;
    await this.gestoriaService.deleteMovimiento(c.id, movId);
    const updated = await this.casosService.getCaso(c.id);
    this.caso.set(updated);
  }

  // ── Helpers ────────────────────────────────────────────

  getEstadoClass(estado: string): string {
    const map: Record<string, string> = {
      pendiente: 'bg-amber-100 text-amber-700',
      en_proceso: 'bg-blue-100 text-blue-700',
      cerrado: 'bg-slate-100 text-slate-500',
      urgente: 'bg-red-100 text-red-700',
      archivado: 'bg-slate-100 text-slate-400',
    };
    return map[estado] || 'bg-slate-100 text-slate-600';
  }

  getTipoClass(tipo: string): string {
    const map: Record<string, string> = {
      Legal: 'bg-violet-100 text-violet-700',
      Fiscal: 'bg-blue-100 text-blue-700',
      Laboral: 'bg-amber-100 text-amber-700',
      Mercantil: 'bg-emerald-100 text-emerald-700',
      Civil: 'bg-slate-100 text-slate-600',
    };
    return map[tipo] || 'bg-slate-100 text-slate-600';
  }

  getHitoEstadoIcon(estado: HitoEstado): unknown {
    if (estado === 'completado') return this.CheckCircle2Icon;
    if (estado === 'en_progreso') return this.ClockIcon;
    if (estado === 'cancelado') return this.XCircleIcon;
    return this.CircleIcon;
  }

  getHitoEstadoColor(estado: HitoEstado): string {
    if (estado === 'completado') return 'text-emerald-500';
    if (estado === 'en_progreso') return 'text-blue-500';
    if (estado === 'cancelado') return 'text-slate-400';
    return 'text-slate-300';
  }

  getMovTipoClass(tipo: MovimientoTipo): string {
    const map: Record<MovimientoTipo, string> = {
      ingreso: 'bg-emerald-100 text-emerald-700',
      suplido: 'bg-amber-100 text-amber-700',
      honorario: 'bg-violet-100 text-violet-700',
      gasto: 'bg-red-100 text-red-700',
      otro: 'bg-slate-100 text-slate-600',
    };
    return map[tipo];
  }
}
