import { Component, ChangeDetectionStrategy } from '@angular/core';
import {
  LucideAngularModule, Sparkles, Zap, Globe, Bot, FileCode2,
  CheckCircle2, ArrowRight, Lock, Star,
} from 'lucide-angular';

const WORKFLOWS = [
  { id: 'WF-001', nombre: 'Propuesta comercial automática', descripcion: 'Genera propuestas personalizadas a partir del perfil del cliente', activo: true },
  { id: 'WF-002', nombre: 'Seguimiento post-reunión', descripcion: 'Email y resumen automatizado 2h después de cada reunión', activo: true },
  { id: 'WF-003', nombre: 'Onboarding nuevo cliente', descripcion: 'Secuencia de bienvenida con documentos y primeras tareas', activo: false },
  { id: 'WF-004', nombre: 'Alerta de proyectos en riesgo', descripcion: 'Detecta proyectos con desviación >20% y notifica al equipo', activo: true },
];

const INTEGRACIONES = [
  { nombre: 'Google Workspace', descripcion: 'Gmail, Calendar, Drive sincronizados', conectado: true, icono: '🔵' },
  { nombre: 'Slack', descripcion: 'Notificaciones de proyectos y tareas', conectado: true, icono: '💬' },
  { nombre: 'DocuSign', descripcion: 'Firma electrónica de contratos', conectado: false, icono: '📝' },
  { nombre: 'Stripe', descripcion: 'Cobros y gestión de pagos online', conectado: false, icono: '💳' },
  { nombre: 'Dropbox', descripcion: 'Almacenamiento y backups de documentos', conectado: true, icono: '📦' },
  { nombre: 'WhatsApp Business', descripcion: 'Mensajería directa con clientes', conectado: true, icono: '💚' },
];

@Component({
  selector: 'app-vertey-studio',
  imports: [LucideAngularModule],
  templateUrl: './vertey-studio.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class VerteyStudioComponent {
  readonly SparklesIcon = Sparkles;
  readonly ZapIcon = Zap;
  readonly GlobeIcon = Globe;
  readonly BotIcon = Bot;
  readonly FileCode2Icon = FileCode2;
  readonly CheckCircle2Icon = CheckCircle2;
  readonly ArrowRightIcon = ArrowRight;
  readonly LockIcon = Lock;
  readonly StarIcon = Star;

  workflows = WORKFLOWS;
  integraciones = INTEGRACIONES;

  conectadas = INTEGRACIONES.filter(i => i.conectado).length;
}
