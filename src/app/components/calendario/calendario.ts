import { Component } from '@angular/core';
import {
  LucideAngularModule,
  LucideIconData,
  Calendar,
  Plus,
  Clock,
  CheckCircle2,
  AlertCircle,
  Phone,
  Users,
  FileText,
  Bell,
} from 'lucide-angular';
import { CALENDAR_EVENTS } from '../../data/dummy-data';
import type { CalendarEvent } from '../../interfaces';

@Component({
  selector: 'app-calendario',
  standalone: true,
  imports: [LucideAngularModule],
  templateUrl: './calendario.html',
})
export class CalendarioComponent {
  readonly CalendarIcon = Calendar;
  readonly PlusIcon = Plus;
  readonly ClockIcon = Clock;
  readonly CheckCircle2Icon = CheckCircle2;
  readonly AlertCircleIcon = AlertCircle;
  readonly PhoneIcon = Phone;
  readonly UsersIcon = Users;
  readonly FileTextIcon = FileText;
  readonly BellIcon = Bell;

  events = CALENDAR_EVENTS;
  today = '2026-05-14';

  todayEvents = this.events.filter((e) => e.date === this.today);
  upcomingEvents = this.events.filter((e) => e.date > this.today);

  getTypeIcon(type: string): LucideIconData {
    const map: Record<string, LucideIconData> = {
      reunion: Users,
      llamada: Phone,
      entrega: FileText,
      recordatorio: Bell,
    };
    return map[type] || Calendar;
  }

  getTypeClass(type: string): string {
    const map: Record<string, string> = {
      reunion: 'bg-violet-100 text-violet-700',
      llamada: 'bg-green-100 text-green-700',
      entrega: 'bg-blue-100 text-blue-700',
      recordatorio: 'bg-amber-100 text-amber-700',
    };
    return map[type] || 'bg-slate-100 text-slate-600';
  }

  getStatusClass(status: string): string {
    const map: Record<string, string> = {
      confirmada: 'bg-green-100 text-green-700',
      pendiente: 'bg-amber-100 text-amber-700',
      cancelada: 'bg-red-100 text-red-700',
    };
    return map[status] || 'bg-slate-100 text-slate-600';
  }

  getTypeLabel(type: string): string {
    const map: Record<string, string> = {
      reunion: 'Reunión',
      llamada: 'Llamada',
      entrega: 'Entrega',
      recordatorio: 'Recordatorio',
    };
    return map[type] || type;
  }
}
