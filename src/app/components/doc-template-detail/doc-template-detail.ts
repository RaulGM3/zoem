import { Component, OnInit, ChangeDetectionStrategy, ViewChild, ElementRef, inject, input, signal, computed, effect } from '@angular/core';
import { Router } from '@angular/router';
import {
  LucideAngularModule,
  ArrowLeft,
  Copy,
  Check,
  Download,
  Sparkles,
  FileText,
  Trash2,
  Pencil,
  Tag,
  Lock,
  X,
  Link,
} from 'lucide-angular';
import { AnclarCasoDialogComponent } from './anclar-caso-dialog/anclar-caso-dialog';
import { DocTemplateService } from '../../core/services/doc-template.service';
import { ToastService } from '../../core/services/toast.service';
import { PermissionService } from '../../core/services/permission.service';
import { ErrorService } from '../../core/services/error.service';
import { translateFirebaseError } from '../../core/firebase/firebase-error';
import { FocusTrapDirective } from '../../shared/directives/focus-trap.directive';

function escapeHtml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Cuenta ocurrencias no solapadas de `needle` dentro de `haystack`. */
function countOccurrences(haystack: string, needle: string): number {
  if (!needle) return 0;
  let count = 0;
  let pos = 0;
  for (;;) {
    const idx = haystack.indexOf(needle, pos);
    if (idx === -1) return count;
    count++;
    pos = idx + needle.length;
  }
}

/** Devuelve la posición de la ocurrencia número `index` (0-based) de `needle`, o -1. */
function nthIndexOf(haystack: string, needle: string, index: number): number {
  let count = 0;
  let pos = 0;
  for (;;) {
    const idx = haystack.indexOf(needle, pos);
    if (idx === -1) return -1;
    if (count === index) return idx;
    count++;
    pos = idx + needle.length;
  }
}

/**
 * Decodifica entidades HTML (&amp;, &quot;, &#39;, &nbsp;, etc.) a su
 * carácter real, usando el propio parser HTML del navegador vía un
 * `<textarea>` desconectado del DOM (nunca ejecuta scripts ni crea nodos
 * vivos — solo interpreta el fragmento como texto). A diferencia de un
 * decoder manual, cubre cualquier entidad nombrada o numérica sin mantener
 * una tabla de equivalencias propia.
 */
function decodeHtmlEntities(raw: string): string {
  const el = document.createElement('textarea');
  el.innerHTML = raw;
  return el.value;
}

interface DecodedRun {
  rawStart: number;
  rawLen: number;
  decodedStart: number;
  decodedLen: number;
}

/**
 * Escanea un fragmento de texto PLANO (sin entidades con `;` ya troceadas
 * por `buildDecodedRuns`) buscando entidades "legacy" sin `;` final (p.ej.
 * `&nbsp` tal cual, sin terminar) — permitidas por las reglas de parsing
 * legacy de HTML5 y habituales en HTML generado a partir de Word/PDF. En
 * vez de mantener una tabla propia de nombres legacy (hay ~106 y cambiaría
 * con el spec), delega en el propio parser del navegador
 * (`decodeHtmlEntities`): para cada `&nombre` prueba, de más larga a más
 * corta, si esa subcadena decodifica a algo distinto de sí misma — la
 * primera que lo haga es la entidad real (maximal munch, igual que hace el
 * navegador). Si ninguna decodifica, `&` se trata como texto literal.
 */
function pushPlainRunWithLegacyEntities(
  text: string,
  pushRun: (rawLen: number, decoded: string) => void
): void {
  let i = 0;
  while (i < text.length) {
    const amp = text.indexOf('&', i);
    if (amp === -1) {
      pushRun(text.length - i, text.slice(i));
      return;
    }
    if (amp > i) pushRun(amp - i, text.slice(i, amp));

    const nameMatch = /^&([a-zA-Z]+)/.exec(text.slice(amp));
    let consumed = 0;
    if (nameMatch) {
      const name = nameMatch[1];
      for (let len = name.length; len >= 2; len--) {
        const candidate = '&' + name.slice(0, len);
        const decoded = decodeHtmlEntities(candidate);
        if (decoded !== candidate) {
          pushRun(candidate.length, decoded);
          consumed = candidate.length;
          break;
        }
      }
    }
    if (consumed === 0) {
      pushRun(1, '&');
      consumed = 1;
    }
    i = amp + consumed;
  }
}

/**
 * Tokeniza `html` directamente (sin pasar por el DOM ni por Angular) en
 * "runs" de texto visible, cada uno con su offset crudo (`rawStart/rawLen`,
 * posición real dentro de `html`) y su offset decodeado (`decodedStart/
 * decodedLen`, posición dentro del stream de texto plano resultante). El
 * marcado (`<...>`) nunca genera runs — así ni el conteo de ocurrencias ni el
 * reemplazo pueden caer nunca dentro de una etiqueta o un atributo.
 *
 * Este stream decodeado es, por construcción, exactamente lo que un humano
 * lee al renderizar el documento, sin depender de cómo el sanitizer de
 * Angular o el parser del navegador serialicen `renderedForEdit()` — por
 * eso no hace falta "revertir" nada del DOM vivo.
 */
function buildDecodedRuns(html: string): { stream: string; runs: DecodedRun[] } {
  const chunks = html.split(/(<[^>]+>)/g);
  const runs: DecodedRun[] = [];
  let stream = '';
  let rawPos = 0;
  let decodedPos = 0;

  const pushRun = (rawLen: number, decoded: string) => {
    if (rawLen === 0 && decoded.length === 0) return;
    runs.push({ rawStart: rawPos, rawLen, decodedStart: decodedPos, decodedLen: decoded.length });
    stream += decoded;
    rawPos += rawLen;
    decodedPos += decoded.length;
  };

  for (const chunk of chunks) {
    if (!chunk) continue;
    if (/^<[^>]+>$/.test(chunk)) {
      rawPos += chunk.length;
      continue;
    }
    // Trocea el texto por entidades para no perder precisión rawoffset<->decodedoffset:
    // cada entidad es un run atómico propio (nunca se parte a la mitad).
    // Las referencias numéricas (`&#169`, `&#x2014`) las decodifica el
    // navegador incluso sin `;` final, así que el `;` es opcional aquí. Las
    // entidades con nombre SIN `;` (p.ej. `&nbsp` legacy) no las cubre este
    // regex — de eso se encarga pushPlainRunWithLegacyEntities() sobre los
    // tramos de texto plano restantes.
    const entityRegex = /&(#x[0-9a-fA-F]+;?|#\d+;?|[a-zA-Z][a-zA-Z0-9]*;)/g;
    let lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = entityRegex.exec(chunk))) {
      if (match.index > lastIndex) {
        const plain = chunk.slice(lastIndex, match.index);
        pushPlainRunWithLegacyEntities(plain, pushRun);
      }
      pushRun(match[0].length, decodeHtmlEntities(match[0]));
      lastIndex = entityRegex.lastIndex;
    }
    if (lastIndex < chunk.length) {
      const plain = chunk.slice(lastIndex);
      pushPlainRunWithLegacyEntities(plain, pushRun);
    }
  }

  return { stream, runs };
}

/** Mapea un offset del stream decodeado de vuelta a un offset crudo dentro de `html`. */
function mapDecodedOffsetToRaw(runs: DecodedRun[], offset: number): number {
  for (const run of runs) {
    const decodedEnd = run.decodedStart + run.decodedLen;
    if (offset <= decodedEnd) {
      if (run.decodedLen === run.rawLen) {
        return run.rawStart + (offset - run.decodedStart);
      }
      // Run irregular (una entidad decodeada a longitud distinta): solo se
      // confía en los bordes del run, nunca en una posición intermedia.
      return offset - run.decodedStart <= run.decodedLen / 2 ? run.rawStart : run.rawStart + run.rawLen;
    }
  }
  const last = runs[runs.length - 1];
  return last ? last.rawStart + last.rawLen : 0;
}

const VAR_KEY_PATTERN = /^[a-zA-Z0-9_]+$/;

import { DocGenerationService } from '../../core/services/doc-generation.service';
import type { DocTemplate, TemplateVariable } from '../../interfaces';

@Component({
  selector: 'app-doc-template-detail',
  imports: [LucideAngularModule, AnclarCasoDialogComponent, FocusTrapDirective],
  templateUrl: './doc-template-detail.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DocTemplateDetailComponent implements OnInit {
  private readonly router = inject(Router);
  private readonly templateService = inject(DocTemplateService);
  private readonly toast = inject(ToastService);
  private readonly errorService = inject(ErrorService);
  readonly perm = inject(PermissionService);
  protected readonly generationService = inject(DocGenerationService);
  @ViewChild('previewContent') private readonly previewContent?: ElementRef<HTMLElement>;
  @ViewChild('newVarKeyInput') private readonly newVarKeyInput?: ElementRef<HTMLInputElement>;

  readonly id = input.required<string>();

  readonly ArrowLeftIcon = ArrowLeft;
  readonly CopyIcon = Copy;
  readonly CheckIcon = Check;
  readonly DownloadIcon = Download;
  readonly SparklesIcon = Sparkles;
  readonly FileTextIcon = FileText;
  readonly Trash2Icon = Trash2;
  readonly PencilIcon = Pencil;
  readonly TagIcon = Tag;
  readonly LockIcon = Lock;
  readonly XIcon = X;
  readonly LinkIcon = Link;

  readonly showAnclarDialog = signal(false);

  readonly template = signal<DocTemplate | null>(null);
  readonly loading = signal(true);
  readonly values = signal<Record<string, string>>({});
  readonly copied = signal(false);
  readonly downloading = signal(false);
  readonly confirmingDelete = signal(false);
  readonly editMode = signal(false);
  readonly pendingSelection = signal('');
  // Representación EXACTA del texto seleccionado tal como existe dentro de
  // Índice (0-based) de la ocurrencia de `pendingSelection` dentro del stream
  // de texto decodeado de `t.html` (ver buildDecodedRuns), calculado en
  // onPreviewMouseUp() contra la posición de la selección en el DOM vivo.
  // Permite reemplazar en promoteToVariable() SOLO esa ocurrencia concreta,
  // no todas las coincidencias del documento.
  private readonly pendingSelectionIndex = signal(0);
  // Última selección (texto + rango) ya procesada por
  // handlePreviewSelectionChange(), para no relanzar el formulario en cada
  // (keyup) mientras el usuario sigue extendiendo la MISMA selección con
  // Shift+flechas (solo se procesa cuando el string seleccionado cambia).
  private lastHandledSelectionText: string | null = null;
  readonly showNewVarForm = signal(false);
  readonly newVarKey = signal('');
  readonly newVarLabel = signal('');
  readonly makeStaticFor = signal<string | null>(null);
  readonly makeStaticValue = signal('');
  readonly saving = signal(false);
  readonly focusedVar = signal<string | null>(null);

  constructor() {
    effect(() => {
      const key = this.focusedVar();
      if (!key) return;
      setTimeout(() => {
        const container = this.previewContent?.nativeElement;
        if (!container) return;
        const mark = container.querySelector<HTMLElement>(`[data-var-key="${key}"]`);
        mark?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 0);
    });
    // Al aparecer el formulario "promover a variable" (tras seleccionar texto
    // con ratón o teclado), mueve el foco al input de clave — sin esto, un
    // usuario de teclado/lector de pantalla no tenía ninguna indicación de
    // que había aparecido un formulario nuevo (WCAG 2.4.3 / 4.1.3). El
    // setTimeout(0) espera a que Angular pinte el @if antes de buscar el
    // ViewChild (igual que el patrón de arriba con `focusedVar`).
    effect(() => {
      if (!this.showNewVarForm()) return;
      setTimeout(() => this.newVarKeyInput?.nativeElement.focus(), 0);
    });
  }

  readonly rendered = computed(() => {
    const t = this.template();
    const focused = this.focusedVar();
    const vals = this.values();
    if (!t) return '';
    return t.html.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, key: string) => {
      const value = vals[key];
      const isFocused = focused === key;
      const baseClass = isFocused
        ? 'rounded px-0.5 bg-violet-200 text-violet-900 ring-2 ring-violet-400'
        : value
          ? 'rounded bg-emerald-100 px-0.5 text-emerald-800'
          : 'rounded bg-amber-100 px-0.5 text-amber-800';
      const text = value ? escapeHtml(value) : `{{${key}}}`;
      return `<mark data-var-key="${key}" class="${baseClass}">${text}</mark>`;
    });
  });

  readonly renderedForEdit = computed(() => {
    const t = this.template();
    if (!t) return '';
    // Interpola el match COMPLETO (`match`, con su whitespace interno
    // original) en vez de reserializar `{{${key}}}` — así el conteo de
    // caracteres de texto de este <span> en el DOM vivo (usado por
    // computeSelectionDecodedOffset vía TreeWalker) coincide exactamente con
    // el que ve buildDecodedRuns(t.html) sobre el HTML crudo (que no
    // normaliza whitespace dentro de `{{ }}`). Si aquí se canonicalizara el
    // whitespace, cualquier token existente con espacios internos
    // desincronizaría ambos offsets para toda selección posterior.
    return t.html.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (match, key: string) =>
      `<span class="bg-violet-100 text-violet-700 rounded px-0.5 font-mono text-xs" data-var-key="${key}">${match}</span>`
    );
  });

  readonly filledCount = computed(() => {
    const t = this.template();
    if (!t) return 0;
    const values = this.values();
    return t.variables.filter(v => (values[v.key] ?? '').trim()).length;
  });

  readonly requiredPending = computed(() => {
    const t = this.template();
    if (!t) return 0;
    const values = this.values();
    return t.variables.filter(v => v.required && !(values[v.key] ?? '').trim()).length;
  });

  async ngOnInit(): Promise<void> {
    try {
      const template = await this.templateService.getTemplate(this.id());
      this.template.set(template);
    } catch (err) {
      // Las rules de Firestore niegan el `get` tanto si la plantilla está
      // soft-deleted como si la visibilidad restringida excluye al usuario
      // actual (ver firestore.rules, docTemplates/{templateId}). Ambos casos
      // llegan aquí como `permission-denied` y se tratan como "no
      // encontrada" para no filtrar por consola qué plantillas existen.
      // Cualquier OTRO error (red caída, Firestore transitorio, etc.) se
      // registra y se muestra — silenciarlo igual que un 404 ocultaría
      // fallos reales al usuario.
      const info = translateFirebaseError(err);
      if (info.code !== 'permission-denied') {
        // No hace falta un console.error manual aquí: toast.fromError() ya
        // registra el error internamente (con prefijo '[Firebase]') antes de
        // mostrarlo — un console.error adicional solo duplicaría el mismo
        // error dos veces en la consola.
        void this.errorService.log(err, {
          serviceName: 'DocTemplateDetailComponent',
          methodName: 'ngOnInit',
          params: { id: this.id() },
        });
        this.toast.fromError(err, { title: 'No se pudo cargar la plantilla' });
      } else {
        // Caso esperado (soft delete o visibilidad restringida, ver comentario
        // arriba): se registra igual, marcado como `expected`, para que una
        // regresión real de las reglas de Firestore siga siendo observable sin
        // mostrar un toast de error al usuario en el caso normal.
        void this.errorService.log(err, {
          serviceName: 'DocTemplateDetailComponent',
          methodName: 'ngOnInit',
          expected: true,
          params: { id: this.id() },
        });
      }
      this.template.set(null);
    } finally {
      this.loading.set(false);
    }
  }

  setValue(key: string, value: string): void {
    this.values.update(v => ({ ...v, [key]: value }));
  }

  onVarFocus(key: string): void {
    this.focusedVar.set(key);
  }

  inputType(variable: TemplateVariable): string {
    switch (variable.type) {
      case 'date': return 'date';
      case 'number':
      case 'currency': return 'number';
      case 'email': return 'email';
      default: return 'text';
    }
  }

  async copy(): Promise<void> {
    const t = this.template();
    if (!t) return;
    const html = this.generationService.interpolate(t.html, this.values());
    await this.generationService.copyToClipboard(html);
    this.copied.set(true);
    setTimeout(() => this.copied.set(false), 2000);
  }

  async download(): Promise<void> {
    const t = this.template();
    if (!t || this.downloading()) return;
    this.downloading.set(true);
    try {
      const html = this.generationService.interpolate(t.html, this.values());
      await this.generationService.downloadAsDocx(html, t.name);
    } finally {
      this.downloading.set(false);
    }
  }

  async deleteTemplate(): Promise<void> {
    const t = this.template();
    if (!t || !this.perm.can('Documentos', 'eliminar')) return;
    await this.toast.run(() => this.templateService.deleteTemplate(t.id), {
      successMessage: 'Plantilla eliminada',
      errorTitle: 'No se pudo eliminar la plantilla',
      onSuccess: () => this.goBack(),
    });
  }

  toggleEditMode(): void {
    if (!this.perm.can('Documentos', 'editar')) return;
    this.editMode.update(v => !v);
    if (!this.editMode()) {
      this.cancelNewVar();
      this.makeStaticFor.set(null);
    }
  }

  onPreviewMouseUp(): void {
    this.handlePreviewSelectionChange();
  }

  /**
   * Equivalente por teclado de onPreviewMouseUp(): escucha (keyup) sobre el
   * contenedor de preview para detectar una selección de texto extendida con
   * Shift+flechas y reutiliza la misma lógica de handlePreviewSelectionChange()
   * (el guard de `lastHandledSelectionText` evita relanzar el formulario en
   * cada tecla mientras la selección no cambia).
   *
   * NOTA (mejora parcial, best-effort — no cierra WCAG 2.1.1): fuera del modo
   * "caret browsing" de Firefox (no activado por defecto), Shift+flecha sobre
   * un `<div>` sin `contenteditable` NO crea ni extiende una selección de
   * texto en Chrome/Safari/Edge — el navegador simplemente no genera ese
   * comportamiento para contenido no editable. Este handler SÍ ayuda en
   * Firefox con caret browsing activado, pero en el resto de navegadores la
   * interacción "seleccionar texto para promoverlo a variable" sigue siendo,
   * en la práctica, mouse-primary. Es una limitación conocida y aceptada — no
   * se re-diseña este mecanismo (requeriría, p.ej., un modelo de selección
   * propio vía teclado, fuera de alcance por ahora).
   */
  onPreviewKeyUp(): void {
    this.handlePreviewSelectionChange();
  }

  private handlePreviewSelectionChange(): void {
    if (!this.editMode()) return;
    const t = this.template();
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed) return;
    // `Selection.toString()` inserta un '\n' sintético cada vez que la
    // selección cruza el borde de dos elementos de bloque (p.ej. dos <p>
    // consecutivos), incluso cuando no hay ningún carácter real entre ellos
    // en `t.html`. Ni buildDecodedRuns() ni el TreeWalker de
    // computeSelectionDecodedOffset insertan ese separador — ambos leen
    // texto crudo tal cual, así que el stream decodeado nunca contiene ese
    // '\n' de borde de bloque. Se elimina aquí para que `text` siga
    // encontrándose vía nthIndexOf() en ese stream; un '\n' real ya presente
    // dentro de un único nodo de texto (contenido preformateado) es un caso
    // mucho más raro que se acepta como limitación conocida.
    const text = (selection.toString() ?? '').replace(/\n+/g, '').trim();
    if (!text || !t) return;
    // Evita relanzar el formulario en cada (keyup) mientras el usuario sigue
    // extendiendo la MISMA selección (p.ej. mantiene Shift+flecha pulsado):
    // solo se procesa cuando el texto seleccionado cambia respecto a la
    // última vez.
    if (text === this.lastHandledSelectionText) return;
    this.lastHandledSelectionText = text;
    const { stream } = buildDecodedRuns(t.html);
    this.pendingSelection.set(text);
    this.pendingSelectionIndex.set(this.computeSelectionOccurrenceIndex(text, stream, selection));
    this.showNewVarForm.set(true);
  }

  /**
   * Calcula qué ocurrencia (0-based) del texto seleccionado corresponde,
   * contando cuántas veces aparece en el stream de texto DECODEADO de
   * `t.html` (ver buildDecodedRuns) antes del punto de la selección. Tanto el
   * conteo como el reemplazo posterior en promoteToVariable() operan siempre
   * sobre este mismo stream — construido directamente desde `t.html`, sin
   * pasar por el DOM renderizado — así que nunca se desincronizan por
   * sanitización de Angular ni por diferencias de encoding de entidades.
   */
  private computeSelectionOccurrenceIndex(text: string, decodedStream: string, selection: Selection): number {
    const offset = this.computeSelectionDecodedOffset(selection);
    if (offset === null) return 0;
    return countOccurrences(decodedStream.slice(0, offset), text);
  }

  /**
   * Ubica el punto de inicio de la selección dentro del stream de texto
   * DECODEADO, contando caracteres de nodos de texto del DOM vivo (nunca de
   * atributos, así que el `data-var-key` que el sanitizer de Angular elimina
   * no afecta este conteo). Inserta temporalmente un nodo de texto "marcador"
   * único en el punto de inicio de la selección, recorre el contenedor con un
   * `TreeWalker` que solo visita nodos de texto y devuelve la cantidad de
   * caracteres que preceden al marcador. El nodo marcador se elimina siempre
   * en el `finally`, dejando el DOM exactamente como estaba.
   */
  private computeSelectionDecodedOffset(selection: Selection): number | null {
    const container = this.previewContent?.nativeElement;
    if (!container || selection.rangeCount === 0) return null;
    const MARKER = 'ZOEM_SEL_MARKER';
    let markerNode: Text | null = null;
    try {
      const range = selection.getRangeAt(0);
      const markerRange = range.cloneRange();
      markerRange.collapse(true);
      markerNode = document.createTextNode(MARKER);
      markerRange.insertNode(markerNode);

      const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
      let offset = 0;
      let node: Node | null;
      while ((node = walker.nextNode())) {
        const value = node.textContent ?? '';
        const markerIdx = value.indexOf(MARKER);
        if (markerIdx !== -1) return offset + markerIdx;
        offset += value.length;
      }
      return null;
    } catch {
      return null;
    } finally {
      markerNode?.parentNode?.removeChild(markerNode);
    }
  }

  cancelNewVar(): void {
    this.showNewVarForm.set(false);
    this.pendingSelection.set('');
    this.pendingSelectionIndex.set(0);
    // Permite volver a promover la MISMA selección de texto tras cancelar
    // (sin esto, el guard de handlePreviewSelectionChange() la ignoraría por
    // no haber cambiado desde la última vez procesada).
    this.lastHandledSelectionText = null;
    // Devuelve el foco al contenedor de preview (el formulario que lo tenía
    // acaba de desaparecer) — evita que el foco caiga al <body> sin avisar.
    setTimeout(() => this.previewContent?.nativeElement.focus(), 0);
    this.newVarKey.set('');
    this.newVarLabel.set('');
    window.getSelection()?.removeAllRanges();
  }

  async promoteToVariable(): Promise<void> {
    const t = this.template();
    const text = this.pendingSelection();
    const key = this.newVarKey().trim();
    const label = this.newVarLabel().trim();
    if (!t || !text || !key || !label) return;
    if (!this.perm.can('Documentos', 'editar')) return;

    if (!VAR_KEY_PATTERN.test(key)) {
      this.toast.fromError(new Error('La clave solo puede contener letras, números y guiones bajos.'), {
        title: 'Clave de variable inválida',
      });
      return;
    }
    // Nota (limitación conocida, baja prioridad): esta comprobación es
    // client-side contra el snapshot en memoria. Dos ediciones concurrentes
    // podrían pasar ambas esta comprobación antes de que cualquiera escriba,
    // resultando en dos variables con la misma clave. Poco probable (requiere
    // edición simultánea del mismo doc) — no se añade una transacción solo
    // para esto.
    if (t.variables.some(v => v.key === key)) {
      this.toast.fromError(new Error(`Ya existe una variable con la clave "${key}".`), {
        title: 'Clave de variable duplicada',
      });
      return;
    }
    // Recalcula el stream decodeado contra el HTML ACTUAL (por si cambió
    // entre la selección y este clic) y ubica la ocurrencia número
    // `pendingSelectionIndex` (calculada en onPreviewMouseUp) dentro de él.
    // Todo el matching se hace en el dominio de texto decodeado — nunca sobre
    // HTML crudo/encodeado — así que nunca hace falta adivinar si el texto
    // seleccionado estaba entre entidades HTML.
    const { stream, runs } = buildDecodedRuns(t.html);
    const matchStart = nthIndexOf(stream, text, this.pendingSelectionIndex());
    if (matchStart === -1) {
      this.toast.fromError(new Error('El texto seleccionado no se encontró en el documento. Vuelve a seleccionarlo.'), {
        title: 'No se pudo crear la variable',
      });
      return;
    }

    // Reemplaza SOLO la ocurrencia que el usuario seleccionó, no todas las
    // coincidencias del documento — un split/join global corrompería texto no
    // relacionado (ej: "Juan" también dentro de "Juana" o "San Juan"). Los
    // offsets se mapean de vuelta al HTML crudo vía `runs`, que solo cubren
    // texto visible — nunca marcado ni atributos.
    const rawStart = mapDecodedOffsetToRaw(runs, matchStart);
    const rawEnd = mapDecodedOffsetToRaw(runs, matchStart + text.length);
    const newHtml = t.html.slice(0, rawStart) + `{{${key}}}` + t.html.slice(rawEnd);
    const newVariables: TemplateVariable[] = [
      ...t.variables,
      { key, label, type: 'text', required: false },
    ];

    this.saving.set(true);
    try {
      await this.toast.run(
        () => this.templateService.updateTemplate(t.id, { html: newHtml, variables: newVariables }, t),
        {
          errorTitle: 'No se pudo crear la variable',
          onSuccess: () => {
            this.template.update(prev => prev ? { ...prev, html: newHtml, variables: newVariables } : prev);
            this.cancelNewVar();
          },
        }
      );
    } finally {
      this.saving.set(false);
    }
  }

  startDemote(variable: TemplateVariable): void {
    this.makeStaticFor.set(variable.key);
    this.makeStaticValue.set(variable.label);
  }

  cancelDemote(): void {
    this.makeStaticFor.set(null);
    this.makeStaticValue.set('');
  }

  async demoteToStatic(): Promise<void> {
    const t = this.template();
    const key = this.makeStaticFor();
    const value = this.makeStaticValue().trim();
    if (!t || !key) return;
    if (!this.perm.can('Documentos', 'editar')) return;

    const regex = new RegExp(`\\{\\{\\s*${escapeRegExp(key)}\\s*\\}\\}`, 'g');
    const newHtml = t.html.replace(regex, value);
    const newVariables = t.variables.filter(v => v.key !== key);

    this.saving.set(true);
    try {
      await this.toast.run(
        () => this.templateService.updateTemplate(t.id, { html: newHtml, variables: newVariables }, t),
        {
          errorTitle: 'No se pudo convertir la variable',
          onSuccess: () => {
            this.template.update(prev => prev ? { ...prev, html: newHtml, variables: newVariables } : prev);
            this.cancelDemote();
          },
        }
      );
    } finally {
      this.saving.set(false);
    }
  }

  goBack(): void {
    this.router.navigate(['/documentos']);
  }
}
