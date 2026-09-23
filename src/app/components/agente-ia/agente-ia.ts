import {
  ChangeDetectionStrategy, Component, ElementRef, computed, inject, signal, viewChild,
} from '@angular/core';
import { Router } from '@angular/router';
import {
  LucideAngularModule, Bot, Send, Sparkles, RotateCcw, Zap, TriangleAlert,
} from 'lucide-angular';
import { AgentChatService } from '../../core/agent/agent-chat.service';
import { PermissionService } from '../../core/services/permission.service';

/**
 * Modo de conversación.
 * `soporte` y `analisis` son de consulta: el registry esconde las herramientas
 * que escriben, así el agente no puede abrir formularios sin que se lo pidan.
 */
type AgenteMode = 'soporte' | 'analisis' | 'acciones';

const SUGERENCIAS: Record<AgenteMode, string[]> = {
  soporte: [
    '¿Qué casos tengo en proceso?',
    'Busca el contacto de NOMBRE',
    'Llévame a Facturación',
  ],
  analisis: [
    '¿Cuántos casos urgentes hay abiertos?',
    'Resume mis casos de tipo Laboral abiertos',
    '¿Qué contactos tengo como potenciales?',
  ],
  acciones: [
    'Abre el caso CASO',
    'Crea un contacto llamado NOMBRE con DNI NUMERO y agrega a notas NOTAS',
    'Prepárame un caso nuevo de tipo Civil para NOMBRE CLIENTE',
  ],
};

/**
 * Un "hueco" es una palabra en MAYÚSCULAS de 2+ letras dentro de una sugerencia.
 * Las consecutivas se agrupan: "NOMBRE CLIENTE" es un solo hueco, no dos.
 * Devolvemos una regex nueva en cada llamada porque el flag /g guarda estado
 * en `lastIndex` y compartir la instancia entre llamadas da resultados fantasma.
 */
const huecoRegex = () => /[A-ZÑ]{2,}(?:\s+[A-ZÑ]{2,})*/g;

interface Segmento {
  readonly texto: string;
  readonly hueco: boolean;
}

/** Parte la sugerencia en trozos para poder resaltar los huecos en el botón. */
function dividirEnSegmentos(texto: string): Segmento[] {
  const segmentos: Segmento[] = [];
  let cursor = 0;

  for (const m of texto.matchAll(huecoRegex())) {
    const inicio = m.index ?? -1;
    if (inicio < 0) continue;
    if (inicio > cursor) segmentos.push({ texto: texto.slice(cursor, inicio), hueco: false });
    segmentos.push({ texto: m[0], hueco: true });
    cursor = inicio + m[0].length;
  }
  if (cursor < texto.length) segmentos.push({ texto: texto.slice(cursor), hueco: false });

  return segmentos;
}

/** Primer hueco que empieza en `desde` o después. `null` si ya no quedan. */
function siguienteHueco(texto: string, desde: number): { inicio: number; fin: number } | null {
  for (const m of texto.matchAll(huecoRegex())) {
    const inicio = m.index ?? -1;
    if (inicio >= desde) return { inicio, fin: inicio + m[0].length };
  }
  return null;
}

const MODO_COLOR: Record<AgenteMode, { tab: string; punto: string }> = {
  soporte: { tab: 'border-b-2 border-blue-600 text-blue-600', punto: 'bg-blue-600' },
  analisis: { tab: 'border-b-2 border-emerald-600 text-emerald-600', punto: 'bg-emerald-600' },
  acciones: { tab: 'border-b-2 border-violet-600 text-violet-600', punto: 'bg-violet-600' },
};

@Component({
  selector: 'app-agente-ia',
  imports: [LucideAngularModule],
  templateUrl: './agente-ia.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AgenteIAComponent {
  private readonly chat = inject(AgentChatService);
  private readonly router = inject(Router);
  private readonly perm = inject(PermissionService);

  readonly BotIcon = Bot;
  readonly SendIcon = Send;
  readonly SparklesIcon = Sparkles;
  readonly RotateCcwIcon = RotateCcw;
  readonly ZapIcon = Zap;
  readonly AlertIcon = TriangleAlert;

  readonly modo = signal<AgenteMode>('acciones');
  readonly inputText = signal('');

  private readonly chatInput = viewChild<ElementRef<HTMLTextAreaElement>>('chatInput');

  readonly mensajes = this.chat.mensajes;
  readonly escribiendo = this.chat.pensando;
  readonly error = this.chat.error;

  readonly sugerencias = computed(() =>
    SUGERENCIAS[this.modo()].map((texto) => ({ texto, segmentos: dividirEnSegmentos(texto) })),
  );
  readonly hayMensajes = computed(() => this.mensajes().length > 0);
  readonly puedeEnviar = computed(() => !!this.inputText().trim() && !this.escribiendo());

  readonly modos: { value: AgenteMode; label: string }[] = [
    { value: 'soporte', label: 'Soporte' },
    { value: 'analisis', label: 'Análisis' },
    { value: 'acciones', label: 'Acciones' },
  ];

  getModoTabClass(m: AgenteMode): string {
    const base = 'px-4 py-2 text-sm font-medium ';
    return base + (this.modo() === m ? MODO_COLOR[m].tab : 'text-slate-500 hover:text-slate-700');
  }

  getModoIndicator(m: AgenteMode): string {
    return MODO_COLOR[m].punto;
  }

  cambiarModo(m: AgenteMode): void {
    this.modo.set(m);
    this.chat.limpiar();
  }

  limpiar(): void {
    this.chat.limpiar();
  }

  /**
   * Las sugerencias son plantillas, no comandos. Rellenan el input y dejan el
   * primer hueco SELECCIONADO, como un snippet del editor: la primera tecla que
   * pulses lo reemplaza. Si no hay huecos, el cursor va al final.
   */
  usarSugerencia(texto: string): void {
    this.inputText.set(texto);
    const el = this.chatInput()?.nativeElement;
    if (!el) return;
    // El binding [value] se aplica tras la detección de cambios; escribimos el
    // DOM aquí para que la selección caiga en la posición correcta ya mismo.
    el.value = texto;
    el.focus();
    const hueco = siguienteHueco(texto, 0);
    el.setSelectionRange(hueco?.inicio ?? texto.length, hueco?.fin ?? texto.length);
    this.autoGrow(el);
  }

  /**
   * Selecciona el siguiente hueco. Devuelve `false` cuando ya no quedan, y ahí
   * dejamos pasar el Tab nativo: si lo capturáramos siempre tendríamos una
   * trampa de teclado y se cae WCAG 2.1.2.
   */
  private saltarAlSiguienteHueco(): boolean {
    const el = this.chatInput()?.nativeElement;
    if (!el) return false;

    const hueco = siguienteHueco(el.value, el.selectionEnd ?? 0);
    if (!hueco) return false;

    el.setSelectionRange(hueco.inicio, hueco.fin);
    return true;
  }

  onInput(event: Event): void {
    const el = event.target as HTMLTextAreaElement;
    this.inputText.set(el.value);
    this.autoGrow(el);
  }

  /**
   * El textarea arranca en una línea y crece con el contenido. Resetear a 'auto'
   * antes de leer scrollHeight es obligatorio: si no, nunca encoge al borrar.
   * El tope lo pone `max-h-40` en la plantilla, que activa el scroll interno.
   */
  private autoGrow(el: HTMLTextAreaElement): void {
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }

  enviar(texto?: string): void {
    const msg = (texto ?? this.inputText()).trim();
    if (!msg || this.escribiendo()) return;

    this.inputText.set('');
    const el = this.chatInput()?.nativeElement;
    if (el) {
      el.value = '';
      this.autoGrow(el);
    }
    void this.chat.send(msg, {
      soloLectura: this.modo() !== 'acciones',
      contexto: this.contexto(),
    });
  }

  onKeydown(event: KeyboardEvent): void {
    if (event.key === 'Tab' && !event.shiftKey && this.saltarAlSiguienteHueco()) {
      event.preventDefault();
      return;
    }
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.enviar();
    }
  }

  /**
   * Contexto vivo para el system prompt. Saber en qué pantalla está el usuario
   * es lo que permite que "créame un caso aquí" o "ábreme este" tengan sentido.
   */
  private contexto(): string {
    const rol = this.perm.userRole() ?? 'sin rol asignado';
    return `- Pantalla actual: ${this.router.url}\n- Rol del usuario: ${rol}`;
  }
}
