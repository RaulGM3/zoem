import { Component, signal, computed } from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  LucideAngularModule,
  LucideIconData,
  Phone,
  MessageCircle,
  Mail,
  Clock,
  CheckCircle2,
  XCircle,
  Eye,
  TrendingUp,
  BarChart3,
  Search,
  Filter,
  Bot,
  Sparkles,
  ChevronRight,
  User,
  Zap,
} from 'lucide-angular';
import { IA_CONTACTS } from '../../data/dummy-data';
import type { IaContact } from '../../interfaces';

@Component({
  selector: 'app-recepcion-ia',
  standalone: true,
  imports: [RouterLink, LucideAngularModule],
  templateUrl: './recepcion-ia.html',
})
export class RecepcionIAComponent {
  readonly PhoneIcon = Phone;
  readonly MessageCircleIcon = MessageCircle;
  readonly MailIcon = Mail;
  readonly ClockIcon = Clock;
  readonly CheckCircle2Icon = CheckCircle2;
  readonly XCircleIcon = XCircle;
  readonly EyeIcon = Eye;
  readonly TrendingUpIcon = TrendingUp;
  readonly BarChart3Icon = BarChart3;
  readonly SearchIcon = Search;
  readonly FilterIcon = Filter;
  readonly BotIcon = Bot;
  readonly SparklesIcon = Sparkles;
  readonly ChevronRightIcon = ChevronRight;
  readonly UserIcon = User;
  readonly ZapIcon = Zap;

  contacts = IA_CONTACTS;
  filterType = signal('');
  search = signal('');

  filtered = computed(() => {
    const t = this.filterType();
    const q = this.search().toLowerCase();
    return this.contacts.filter((c) => {
      const matchT = !t || c.tipo === t;
      const matchQ = !q || c.cliente.nombre.toLowerCase().includes(q) || c.descripcion.toLowerCase().includes(q);
      return matchT && matchQ;
    });
  });

  stats = {
    total: this.contacts.length,
    llamadas: this.contacts.filter((c) => c.tipo === 'llamada').length,
    whatsapp: this.contacts.filter((c) => c.tipo === 'whatsapp').length,
    email: this.contacts.filter((c) => c.tipo === 'email').length,
    pendientes: this.contacts.filter((c) => c.estado === 'pendiente').length,
    resueltos: this.contacts.filter((c) => c.estado === 'resuelto').length,
    avgScore: Math.round(this.contacts.reduce((s, c) => s + c.puntuacion, 0) / this.contacts.length),
  };

  getTypeIcon(tipo: string): LucideIconData {
    if (tipo === 'llamada') return Phone;
    if (tipo === 'whatsapp') return MessageCircle;
    return Mail;
  }

  getTypeClass(tipo: string): string {
    if (tipo === 'llamada') return 'bg-green-100 text-green-700';
    if (tipo === 'whatsapp') return 'bg-emerald-100 text-emerald-700';
    return 'bg-blue-100 text-blue-700';
  }

  getUrgencyClass(urgencia: string): string {
    const map: Record<string, string> = {
      urgente: 'bg-red-100 text-red-700',
      alta: 'bg-orange-100 text-orange-700',
      normal: 'bg-amber-100 text-amber-700',
      baja: 'bg-slate-100 text-slate-500',
    };
    return map[urgencia] || 'bg-slate-100 text-slate-500';
  }

  getStatusClass(estado: string): string {
    const map: Record<string, string> = {
      pendiente: 'bg-amber-100 text-amber-700',
      en_proceso: 'bg-blue-100 text-blue-700',
      resuelto: 'bg-green-100 text-green-700',
      descartado: 'bg-slate-100 text-slate-500',
    };
    return map[estado] || 'bg-slate-100 text-slate-500';
  }

  getScoreColor(score: number): string {
    if (score >= 80) return 'text-green-600';
    if (score >= 60) return 'text-amber-600';
    return 'text-red-500';
  }

  getStatusLabel(estado: string): string {
    const map: Record<string, string> = {
      pendiente: 'Pendiente',
      en_proceso: 'En proceso',
      resuelto: 'Resuelto',
      descartado: 'Descartado',
    };
    return map[estado] || estado;
  }
}
