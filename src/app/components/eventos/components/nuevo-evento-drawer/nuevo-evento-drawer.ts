import {
  Component, ChangeDetectionStrategy,
  input, output, signal, computed, effect, inject,
} from '@angular/core';
import { LucideAngularModule, X } from 'lucide-angular';
import { UsersService } from '../../../../core/services/users';
import type { CreateEventoData, EventoColor, EventoPrioridad, EventoRecurrencia, RecurrenciaFinTipo } from '../../../../interfaces';
import { EVENTO_COLORS, PRIORIDAD_CONFIG, RECURRENCIA_LABELS } from '../../../../interfaces';
import type { CompanyMember } from '../../../../interfaces/member';

@Component({
  selector: 'app-nuevo-evento-drawer',
  imports: [LucideAngularModule],
  templateUrl: './nuevo-evento-drawer.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NuevoEventoDrawerComponent {
  private readonly usersService = inject(UsersService);

  readonly visible = input.required<boolean>();
  readonly saving = input.required<boolean>();

  readonly saved = output<CreateEventoData>();
  readonly closed = output<void>();

  readonly XIcon = X;

  readonly eventoColors = Object.entries(EVENTO_COLORS) as [EventoColor, (typeof EVENTO_COLORS)[EventoColor]][];
  readonly prioridades = Object.entries(PRIORIDAD_CONFIG) as [EventoPrioridad, (typeof PRIORIDAD_CONFIG)[EventoPrioridad]][];
  readonly recurrencias: EventoRecurrencia[] = ['ninguna', 'diaria', 'semanal', 'mensual', 'anual'];
  readonly recurrenciaLabel = RECURRENCIA_LABELS;

  readonly titulo = signal('');
  readonly descripcion = signal('');
  readonly link = signal('');
  readonly lugar = signal('');
  readonly fecha = signal('');
  readonly horaInicio = signal('09:00');
  readonly horaFin = signal('10:00');
  readonly todoDia = signal(false);
  readonly recurrencia = signal<EventoRecurrencia>('ninguna');
  readonly recurrenciaFinTipo = signal<RecurrenciaFinTipo>('fecha');
  readonly recurrenciaFin = signal('');
  readonly recurrenciaOcurrencias = signal<number | null>(null);
  readonly prioridad = signal<EventoPrioridad>('ninguna');
  readonly color = signal<EventoColor>('azul');
  readonly todaLaCompania = signal(false);
  readonly invitadosSeleccionados = signal<Set<string>>(new Set());
  readonly memberQuery = signal('');

  readonly members = this.usersService.members;

  readonly membersFiltrados = computed(() => {
    const q = this.memberQuery().trim().toLowerCase();
    if (!q) return this.members();
    return this.members().filter(m =>
      m.nombre.toLowerCase().includes(q) || m.email.toLowerCase().includes(q)
    );
  });

  readonly canSubmit = computed(() => !!this.titulo().trim() && !!this.fecha());

  constructor() {
    effect(() => {
      if (this.visible()) {
        this.resetForm();
        if (this.usersService.members().length === 0) {
          this.usersService.loadMembers();
        }
      }
    });
  }

  private resetForm(): void {
    this.titulo.set('');
    this.descripcion.set('');
    this.link.set('');
    this.lugar.set('');
    this.fecha.set('');
    this.horaInicio.set('09:00');
    this.horaFin.set('10:00');
    this.todoDia.set(false);
    this.recurrencia.set('ninguna');
    this.recurrenciaFinTipo.set('fecha');
    this.recurrenciaFin.set('');
    this.recurrenciaOcurrencias.set(null);
    this.prioridad.set('ninguna');
    this.color.set('azul');
    this.todaLaCompania.set(false);
    this.invitadosSeleccionados.set(new Set());
    this.memberQuery.set('');
  }

  toggleInvitado(userId: string): void {
    this.invitadosSeleccionados.update(set => {
      const next = new Set(set);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
  }

  isInvitado(userId: string): boolean {
    return this.invitadosSeleccionados().has(userId);
  }

  getInitials(member: CompanyMember): string {
    const n = member.nombre ?? member.email;
    return n.slice(0, 2).toUpperCase();
  }

  submit(): void {
    if (!this.canSubmit()) return;
    const invitados: CreateEventoData['invitados'] = this.todaLaCompania()
      ? 'todos'
      : [...this.invitadosSeleccionados()];

    const data: CreateEventoData = {
      titulo: this.titulo().trim(),
      fecha: this.fecha(),
      todoDia: this.todoDia(),
      recurrencia: this.recurrencia(),
      prioridad: this.prioridad(),
      color: this.color(),
      invitados,
    };

    if (this.descripcion().trim()) data.descripcion = this.descripcion().trim();
    if (this.link().trim()) data.link = this.link().trim();
    if (this.lugar().trim()) data.lugar = this.lugar().trim();
    if (!this.todoDia()) {
      data.horaInicio = this.horaInicio();
      data.horaFin = this.horaFin();
    }
    if (this.recurrencia() !== 'ninguna') {
      if (this.recurrenciaFinTipo() === 'fecha' && this.recurrenciaFin()) {
        data.recurrenciaFin = this.recurrenciaFin();
      } else if (this.recurrenciaFinTipo() === 'ocurrencias' && this.recurrenciaOcurrencias()) {
        data.recurrenciaOcurrencias = this.recurrenciaOcurrencias()!;
      }
    }

    this.saved.emit(data);
  }
}
