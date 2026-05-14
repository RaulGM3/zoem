import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  LucideAngularModule,
  LucideIconData,
  Euro,
  Users,
  Calendar,
  Receipt,
  FolderKanban,
  Wallet,
  AlertTriangle,
  Clock,
  CheckCircle2,
  ArrowRight,
  Phone,
  FileText,
  Bot,
  Sparkles,
  ChevronRight,
  TrendingUp,
  Activity,
  Bell,
} from 'lucide-angular';
import { DASHBOARD_STATS, ACTIVITY_FEED, PROJECTS, IA_CONTACTS, CALENDAR_EVENTS } from '../../data/dummy-data';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [RouterLink, LucideAngularModule],
  templateUrl: './dashboard.html',
})
export class DashboardComponent {
  readonly EuroIcon = Euro;
  readonly UsersIcon = Users;
  readonly CalendarIcon = Calendar;
  readonly ReceiptIcon = Receipt;
  readonly FolderKanbanIcon = FolderKanban;
  readonly WalletIcon = Wallet;
  readonly AlertTriangleIcon = AlertTriangle;
  readonly ClockIcon = Clock;
  readonly CheckCircle2Icon = CheckCircle2;
  readonly ArrowRightIcon = ArrowRight;
  readonly PhoneIcon = Phone;
  readonly FileTextIcon = FileText;
  readonly BotIcon = Bot;
  readonly SparklesIcon = Sparkles;
  readonly ChevronRightIcon = ChevronRight;
  readonly TrendingUpIcon = TrendingUp;
  readonly ActivityIcon = Activity;
  readonly BellIcon = Bell;

  stats = DASHBOARD_STATS;
  activityFeed = ACTIVITY_FEED;
  recentProjects = PROJECTS.slice(0, 4);
  recentIA = IA_CONTACTS.slice(0, 3);
  todayEvents = CALENDAR_EVENTS.filter((e) => e.date === '2026-05-14');

  primaryStats = [
    { title: 'Ingresos del Mes', value: this.stats.ingresosMes, change: this.stats.ingresosChange, icon: Euro, color: 'text-green-600', bg: 'bg-green-50', positive: true, href: '/facturacion' },
    { title: 'Contactos Activos', value: String(this.stats.contactosActivos), change: this.stats.contactosChange, icon: Users, color: 'text-blue-600', bg: 'bg-blue-50', positive: true, href: '/contactos' },
    { title: 'Citas Hoy', value: String(this.stats.citasHoy), change: `${this.stats.citasConfirmadas} confirmadas`, icon: Calendar, color: 'text-violet-600', bg: 'bg-violet-50', positive: null, href: '/calendario' },
    { title: 'Facturas Pendientes', value: this.stats.facturasPendientes, change: `${this.stats.facturasPendientesCount} facturas`, icon: Receipt, color: 'text-amber-600', bg: 'bg-amber-50', positive: false, href: '/facturacion' },
  ];

  secondaryStats = [
    { title: 'Proyectos Activos', value: String(this.stats.proyectosActivos), change: this.stats.proyectosChange, icon: FolderKanban, color: 'text-indigo-600', bg: 'bg-indigo-50', positive: true, href: '/proyectos' },
    { title: 'Flujo de Caja', value: this.stats.flujoCaja, change: 'Saldo disponible', icon: Wallet, color: 'text-emerald-600', bg: 'bg-emerald-50', positive: true, href: '/tesoreria' },
    { title: 'Tareas Urgentes', value: String(this.stats.tareasUrgentes), change: 'Requieren atención', icon: AlertTriangle, color: 'text-red-600', bg: 'bg-red-50', positive: false, href: '/proyectos' },
    { title: 'Horas Registradas', value: `${this.stats.horasRegistradas}h`, change: `Objetivo: ${this.stats.horasObjetivo}h`, icon: Clock, color: 'text-slate-600', bg: 'bg-slate-50', positive: null, href: '/facturacion' },
  ];

  aiAlerts = [
    { type: 'warning', message: 'Factura #2024-086 vencida hace 26 días — Consultora Estratégica' },
    { type: 'info', message: '3 nuevos leads captados por el asistente IA esta semana' },
    { type: 'success', message: 'Proyecto Web Corporativa al 75% — en tiempo para entrega' },
  ];

  getAlertClass(type: string): string {
    if (type === 'warning') return 'bg-amber-50 border-amber-200 text-amber-800';
    if (type === 'success') return 'bg-emerald-50 border-emerald-200 text-emerald-800';
    return 'bg-blue-50 border-blue-200 text-blue-800';
  }

  getProjectStatusClass(status: string): string {
    if (status === 'En curso') return 'bg-blue-100 text-blue-700';
    if (status === 'Pendiente') return 'bg-amber-100 text-amber-700';
    if (status === 'En espera') return 'bg-slate-100 text-slate-600';
    if (status === 'Completado') return 'bg-green-100 text-green-700';
    return 'bg-slate-100 text-slate-600';
  }

  getPriorityClass(priority: string): string {
    if (priority === 'alta') return 'text-red-500';
    if (priority === 'media') return 'text-amber-500';
    return 'text-slate-400';
  }

  getHoursProgress(): number {
    return (this.stats.horasRegistradas / this.stats.horasObjetivo) * 100;
  }

  getActivityIcon(icon: string): LucideIconData {
    const map: Record<string, LucideIconData> = {
      phone: Phone, receipt: Receipt, folder: FolderKanban,
      wallet: Wallet, file: FileText,
    };
    return map[icon] || Activity;
  }
}
