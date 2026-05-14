import { Component, signal, computed, ChangeDetectionStrategy, afterNextRender, ElementRef, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  LucideAngularModule, Bot, Send, ThumbsUp, ThumbsDown, Copy,
  Sparkles, Search, Zap, RotateCcw,
} from 'lucide-angular';

type AgenteMode = 'soporte' | 'analisis' | 'acciones';

interface Mensaje {
  id: string;
  texto: string;
  entrante: boolean;
  modo?: AgenteMode;
  hora: string;
}

const RESPUESTAS: Record<AgenteMode, string[]> = {
  soporte: [
    'Entendido. Para gestionar esa solicitud, ve a **Proyectos** → selecciona el proyecto → pestaña "Tareas". Puedes añadir, editar y asignar tareas desde allí.',
    'Claro que sí. Para emitir una factura, accede a **Facturación** → "Nueva factura". Rellena los datos del cliente, proyecto y líneas de concepto.',
    'Para añadir un contacto nuevo, ve a **Contactos** → botón "Nuevo contacto". Completa el formulario con los datos de la empresa o persona.',
  ],
  analisis: [
    'Analizando tus datos...\n\n📊 **Resumen del mes:**\n- Ingresos: 21.300 € (+44%)\n- Proyectos activos: 3\n- Conversión de leads: 34%\n\nTu mejor servicio este mes ha sido **Desarrollo** con 42% de los ingresos.',
    'He revisado tus facturas pendientes:\n\n⚠️ **3 facturas sin cobrar** por un total de **15.000 €**\n- StartUp Ventures: 5.000 € — 15 días vencida\n- Retail Pro: 3.200 € — 32 días vencida\n\nRecomiendo iniciar el proceso de cobro inmediatamente.',
    'Comparando este trimestre con el anterior:\n\n📈 Ingresos +28% | 🤝 Clientes nuevos: +5 | ⏱ Tiempo medio proyecto: -3 días\n\nTendencia positiva en todos los indicadores clave.',
  ],
  acciones: [
    '✅ Entendido. ¿Quieres que cree un recordatorio de pago para la factura de StartUp Ventures? Necesito tu confirmación para proceder.',
    '✅ Puedo preparar el resumen mensual para enviarlo a tus clientes. ¿Confirmas el envío a los 5 clientes activos?',
    '✅ He detectado 2 tareas con fecha límite esta semana. ¿Quieres que las marque como urgentes y notifique a los responsables?',
  ],
};

const SUGERENCIAS: Record<AgenteMode, string[]> = {
  soporte: ['¿Cómo añado una tarea a un proyecto?', '¿Cómo emito una factura?', '¿Cómo invito a un usuario?'],
  analisis: ['¿Cómo van los ingresos este mes?', 'Analiza mis facturas pendientes', 'Compara este trimestre con el anterior'],
  acciones: ['Crea un recordatorio de pago', 'Prepara el resumen mensual', 'Marca las tareas urgentes'],
};

@Component({
  selector: 'app-agente-ia',
  imports: [LucideAngularModule, FormsModule],
  templateUrl: './agente-ia.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AgenteIAComponent {
  readonly BotIcon = Bot;
  readonly SendIcon = Send;
  readonly ThumbsUpIcon = ThumbsUp;
  readonly ThumbsDownIcon = ThumbsDown;
  readonly CopyIcon = Copy;
  readonly SparklesIcon = Sparkles;
  readonly SearchIcon = Search;
  readonly ZapIcon = Zap;
  readonly RotateCcwIcon = RotateCcw;

  modo = signal<AgenteMode>('soporte');
  mensajes = signal<Mensaje[]>([]);
  inputText = signal('');
  escribiendo = signal(false);

  sugerencias = computed(() => SUGERENCIAS[this.modo()]);
  hayMensajes = computed(() => this.mensajes().length > 0);

  modos: { value: AgenteMode; label: string; color: string }[] = [
    { value: 'soporte', label: 'Soporte', color: 'text-blue-600' },
    { value: 'analisis', label: 'Análisis', color: 'text-emerald-600' },
    { value: 'acciones', label: 'Acciones', color: 'text-violet-600' },
  ];

  getModoTabClass(m: AgenteMode): string {
    const activo = this.modo() === m;
    const colores: Record<AgenteMode, string> = {
      soporte: activo ? 'border-b-2 border-blue-600 text-blue-600' : '',
      analisis: activo ? 'border-b-2 border-emerald-600 text-emerald-600' : '',
      acciones: activo ? 'border-b-2 border-violet-600 text-violet-600' : '',
    };
    return 'px-4 py-2 text-sm font-medium ' + (activo ? colores[m] : 'text-slate-500 hover:text-slate-700');
  }

  getModoIndicator(m: AgenteMode): string {
    const colores: Record<AgenteMode, string> = {
      soporte: 'bg-blue-600',
      analisis: 'bg-emerald-600',
      acciones: 'bg-violet-600',
    };
    return colores[m];
  }

  cambiarModo(m: AgenteMode) {
    this.modo.set(m);
    this.mensajes.set([]);
  }

  enviar(texto?: string) {
    const msg = (texto ?? this.inputText()).trim();
    if (!msg) return;

    const ahora = new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });

    this.mensajes.update(prev => [
      ...prev,
      { id: crypto.randomUUID(), texto: msg, entrante: false, hora: ahora },
    ]);
    this.inputText.set('');
    this.escribiendo.set(true);

    const respuestas = RESPUESTAS[this.modo()];
    const respuesta = respuestas[Math.floor(Math.random() * respuestas.length)];

    setTimeout(() => {
      this.escribiendo.set(false);
      this.mensajes.update(prev => [
        ...prev,
        { id: crypto.randomUUID(), texto: respuesta, entrante: true, modo: this.modo(), hora: new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }) },
      ]);
    }, 1200);
  }

  limpiar() {
    this.mensajes.set([]);
  }

  onKeydown(event: KeyboardEvent) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.enviar();
    }
  }
}
