import { Component, OnInit, signal, computed, inject, ChangeDetectionStrategy } from '@angular/core';
import { Router } from '@angular/router';
import {
  LucideAngularModule,
  Phone,
  Clock,
  CheckCircle2,
  XCircle,
  Search,
  Bot,
  Sparkles,
  Zap,
  FileText,
  X,
  Timer,
  CircleAlert,
  UserPlus,
  UserCheck,
  FolderOpen,
  PhoneOutgoing,
  Archive,
} from 'lucide-angular';
import { LlamadasService } from '../../core/services/llamadas.service';
import { ContactService } from '../../core/services/contact.service';
import type { LlamadaResumen } from '../../interfaces/llamada.interface';
import type { Contact } from '../../interfaces/contact.interface';
import type { Timestamp } from '@angular/fire/firestore';
import { relativeTime } from '../../core/format/relative-time';

@Component({
  selector: 'app-recepcion-ia',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LucideAngularModule],
  templateUrl: './recepcion-ia.html',
})
export class RecepcionIAComponent implements OnInit {
  private readonly llamadasSvc = inject(LlamadasService);
  private readonly contactSvc = inject(ContactService);
  private readonly router = inject(Router);

  readonly PhoneIcon = Phone;
  readonly ClockIcon = Clock;
  readonly CheckCircle2Icon = CheckCircle2;
  readonly XCircleIcon = XCircle;
  readonly SearchIcon = Search;
  readonly BotIcon = Bot;
  readonly SparklesIcon = Sparkles;
  readonly ZapIcon = Zap;
  readonly FileTextIcon = FileText;
  readonly XIcon = X;
  readonly TimerIcon = Timer;
  readonly CircleAlertIcon = CircleAlert;
  readonly UserPlusIcon = UserPlus;
  readonly UserCheckIcon = UserCheck;
  readonly FolderOpenIcon = FolderOpen;
  readonly PhoneOutgoingIcon = PhoneOutgoing;
  readonly ArchiveIcon = Archive;

  readonly loading = this.llamadasSvc.loading;

  readonly filterEstado = signal('');
  readonly search = signal('');
  readonly selectedLlamada = signal<LlamadaResumen | null>(null);

  private readonly contactPhoneSet = computed(() => {
    const normalize = (p: string) => p.replace(/\D/g, '');
    const phones = new Set<string>();
    for (const c of this.contactSvc.contacts()) {
      if (c.phone) phones.add(normalize(c.phone));
      if (c.mobile) phones.add(normalize(c.mobile));
    }
    return phones;
  });

  readonly filtered = computed(() => {
    const q = this.search().toLowerCase();
    const estado = this.filterEstado();
    return this.llamadasSvc.llamadas().filter((ll) => {
      const matchQ =
        !q ||
        (ll.datosCapturados?.nombreCliente ?? '').toLowerCase().includes(q) ||
        (ll.datosCapturados?.descripcionCaso ?? '').toLowerCase().includes(q) ||
        ll.resumen.toLowerCase().includes(q);
      const matchE = !estado || ll.estado === estado;
      return matchQ && matchE;
    });
  });

  readonly stats = computed(() => {
    const l = this.llamadasSvc.llamadas();
    const total = l.length;
    const exitosas = l.filter((ll) => ll.exitosa).length;
    const urgentes = l.filter((ll) => ll.datosCapturados?.nivelUrgencia === 'urgente').length;
    const avgDuracion =
      total > 0 ? Math.round(l.reduce((s, ll) => s + ll.duracionSegundos, 0) / total) : 0;
    return { total, exitosas, urgentes, avgDuracion };
  });

  readonly ultimaInteraccion = computed(() => {
    const l = this.llamadasSvc.llamadas();
    return l.length ? l[0].creadoEn : null;
  });

  ngOnInit(): void {
    this.llamadasSvc.loadLlamadas();
    this.contactSvc.loadContacts();
  }

  isKnownContact(ll: LlamadaResumen): boolean {
    const phone = ll.datosCapturados?.telefono;
    if (!phone) return false;
    return this.contactPhoneSet().has(phone.replace(/\D/g, ''));
  }

  getMatchedContact(ll: LlamadaResumen): Contact | undefined {
    const phone = ll.datosCapturados?.telefono;
    if (!phone) return undefined;
    const normalized = phone.replace(/\D/g, '');
    return this.contactSvc.contacts().find((c) => {
      if (c.phone && c.phone.replace(/\D/g, '') === normalized) return true;
      if (c.mobile && c.mobile.replace(/\D/g, '') === normalized) return true;
      return false;
    });
  }

  openTranscript(llamada: LlamadaResumen): void {
    this.selectedLlamada.set(llamada);
  }

  closeTranscript(): void {
    this.selectedLlamada.set(null);
  }

  abrirCaso(_ll: LlamadaResumen): void {
    this.router.navigate(['/casos']);
  }

  agregarContacto(ll: LlamadaResumen): void {
    const query: Record<string, string> = { newContact: '1' };
    const d = ll.datosCapturados;
    if (d?.nombreCliente) {
      const parts = d.nombreCliente.trim().split(/\s+/);
      query['nombre'] = parts[0];
      if (parts.length > 1) query['apellidos'] = parts.slice(1).join(' ');
    }
    if (d?.telefono) query['mobile'] = d.telefono;
    if (d?.descripcionCaso) query['notes'] = d.descripcionCaso;
    this.router.navigate(['/contactos'], { queryParams: query });
  }

  async descartarLlamada(ll: LlamadaResumen): Promise<void> {
    await this.llamadasSvc.descartarLlamada(ll.conversationId);
  }

  formatDate(ts: Timestamp): string {
    return ts.toDate().toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' });
  }

  formatTime(ts: Timestamp): string {
    return ts.toDate().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
  }

  formatDuracion(seconds: number): string {
    if (seconds < 60) return `${seconds}s`;
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return s > 0 ? `${m}m ${s}s` : `${m}m`;
  }

  formatRelative(ts: Timestamp): string {
    return relativeTime(ts.toDate());
  }

  getUrgencyClass(u?: string): string {
    const map: Record<string, string> = {
      urgente: 'bg-red-100 text-red-700',
      alta: 'bg-orange-100 text-orange-700',
      normal: 'bg-amber-100 text-amber-700',
      baja: 'bg-slate-100 text-slate-500',
    };
    return map[u ?? ''] ?? 'bg-slate-100 text-slate-500';
  }

  getUrgencyLabel(u?: string): string {
    const map: Record<string, string> = { urgente: 'Urgente', alta: 'Alta', normal: 'Normal', baja: 'Baja' };
    return map[u ?? ''] ?? (u ?? '—');
  }

  getEstadoClass(estado: string): string {
    const map: Record<string, string> = {
      completada: 'bg-green-100 text-green-700',
      fallida: 'bg-red-100 text-red-700',
      interrumpida: 'bg-amber-100 text-amber-700',
    };
    return map[estado] ?? 'bg-slate-100 text-slate-500';
  }

  getEstadoLabel(estado: string): string {
    const map: Record<string, string> = {
      completada: 'Completada',
      fallida: 'Fallida',
      interrumpida: 'Interrumpida',
    };
    return map[estado] ?? estado;
  }

  getEspecialidadLabel(e?: string): string {
    const map: Record<string, string> = {
      FraudeOnline: 'Fraude Online',
      Divorcios: 'Divorcios',
      Herencias: 'Herencias',
      LaboralDespido: 'Laboral / Despido',
      AccidenteTrafico: 'Tráfico',
      DerechoPenal: 'Penal',
      DerechoMercantil: 'Mercantil',
    };
    return map[e ?? ''] ?? (e ?? '');
  }
}
