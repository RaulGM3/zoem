import {
  ChangeDetectionStrategy, Component, ElementRef, OnInit, computed, effect, inject, input, output, signal,
  untracked, viewChild,
} from '@angular/core';
import { FormControl, FormGroup, FormRecord, ReactiveFormsModule, Validators } from '@angular/forms';
import { LucideAngularModule, X, ExternalLink, Copy } from 'lucide-angular';
import { FocusTrapDirective } from '../../directives/focus-trap.directive';
import { AVISO_DEMO_SIN_ENVIOS, esEmpresaDemo } from '../../../core/planes/demo';
import { AccionEjecucionService, type EjecutarAccionResultado } from '../../../core/services/accion-ejecucion.service';
import { DocTemplateService } from '../../../core/services/doc-template.service';
import { CompanyService } from '../../../core/services/company.service';
import { CANAL_LABELS, type Accion, type Canal } from '../../../interfaces/accion.interface';
import { getContactDisplayName, type Contact } from '../../../interfaces/contact.interface';
import type { Caso, Hito } from '../../../interfaces/caso.interface';
import type { TemplateVariable } from '../../../interfaces/doc-template.interface';
import { construirContextoAccion } from '../../../core/acciones/contexto-accion';
import { interpolarTexto, clavesFaltantes } from '../../../core/acciones/interpolar-texto';
import { prefillVariables } from '../../../core/acciones/prefill-variables';
import { canalDisponible } from '../../../core/acciones/url-canal';
import { hitoSugerido } from '../../../core/acciones/hito-sugerido';
import type { FormatoRedaccion, TextoRedactado } from '../../../core/acciones/redaccion-ia';
import { RedactorIaComponent } from '../redactor-ia/redactor-ia';
import { CupoComponent } from '../cupo/cupo';
import { estadoCupo } from '../../../core/planes/derechos';
import { MejoraPlanService } from '../../../core/planes/mejora-plan.service';
import { PlanService } from '../../../core/planes/plan.service';
import { UsoService } from '../../../core/planes/uso.service';

type Fase = 'editando' | 'preparando' | 'listo' | 'error';

/**
 * Modal de ejecución de una acción (contacto o caso).
 *
 * Flujo en dos pasos por los bloqueadores de popups: "Preparar" (async: docx,
 * subida, enlace firmado, registro) y después "Abrir en {canal}", cuyo click
 * abre la app SIN ningún await previo (gesto de usuario válido).
 */
@Component({
  selector: 'app-accion-ejecutar',
  imports: [LucideAngularModule, ReactiveFormsModule, FocusTrapDirective, RedactorIaComponent, CupoComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './accion-ejecutar.html',
  host: {
    class: 'fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4',
    style: 'background:rgba(15,23,41,0.45)',
    '(click)': 'closed.emit()',
  },
})
export class AccionEjecutarComponent implements OnInit {
  private readonly svc = inject(AccionEjecucionService);
  private readonly docTemplates = inject(DocTemplateService);
  private readonly company = inject(CompanyService);
  private readonly plan = inject(PlanService);
  private readonly uso = inject(UsoService);
  private readonly mejora = inject(MejoraPlanService);

  readonly accion = input.required<Accion>();
  /** Contactos candidatos: el propio contacto, o los del caso. */
  readonly contactos = input.required<Contact[]>();
  readonly caso = input<Caso | null>(null);
  readonly hitos = input<Hito[]>([]);
  /** Hito preseleccionado (p. ej. al sugerir tras completarlo). */
  readonly hitoId = input<string | null>(null);

  readonly closed = output<void>();

  readonly XIcon = X;
  readonly ExternalLinkIcon = ExternalLink;
  readonly CopyIcon = Copy;
  readonly canalLabels = CANAL_LABELS;

  readonly form = new FormGroup({
    asunto: new FormControl('', { nonNullable: true, validators: Validators.required }),
    cuerpo: new FormControl('', { nonNullable: true, validators: Validators.required }),
  });
  readonly docForm = new FormRecord<FormControl<string>>({});

  readonly seleccion = signal<string[]>([]);
  readonly hitoSel = signal('');
  readonly canal = signal<Canal | null>(null);
  readonly fase = signal<Fase>('editando');
  readonly resultado = signal<EjecutarAccionResultado | null>(null);
  readonly aperturaBloqueada = signal(false);
  readonly copiado = signal(false);
  readonly plantillaDoc = signal<{ name: string; variables: TemplateVariable[] } | null>(null);
  readonly plantillaDocError = signal(false);
  /** Valores del formulario espejados a signals para que los `computed` reaccionen. */
  protected readonly valores = signal<TextoRedactado>({ asunto: '', cuerpo: '' });
  private readonly valoresDoc = signal<Record<string, string>>({});

  private readonly abrirBtn = viewChild<ElementRef<HTMLButtonElement>>('abrirBtn');

  readonly contactosSel = computed(() => this.contactos().filter((c) => this.seleccion().includes(c.id)));
  readonly eligeDestinatarios = computed(() => this.accion().ambito === 'caso' && this.contactos().length > 1);
  readonly mostrarHito = computed(() => this.accion().ambito === 'caso' && this.hitos().length > 0);
  readonly hitosOrdenados = computed(() => [...this.hitos()].sort((a, b) => a.orden - b.orden));

  readonly contexto = computed(() =>
    construirContextoAccion({
      contactos: this.contactosSel(),
      caso: this.caso(),
      hito: this.hitos().find((h) => h.id === this.hitoSel()) ?? null,
      empresa: this.company.activeCompany()?.name ?? '',
      hoy: new Date(),
    }),
  );

  readonly canales = computed(() =>
    this.accion().canales.map((canal) => ({ canal, disp: canalDisponible(canal, this.contactosSel()) })),
  );

  readonly formatoRedaccion = computed<FormatoRedaccion>(() => (this.canal() === 'whatsapp' ? 'whatsapp' : 'email'));

  readonly variablesDoc = computed(() => this.plantillaDoc()?.variables ?? []);
  readonly docFaltantes = computed(() => {
    const vals = this.valoresDoc();
    return this.variablesDoc().filter((v) => v.required && !(vals[v.key] ?? '').trim());
  });
  /** Marcadores `{{x}}` que siguen sin valor en el texto final. */
  readonly marcadoresSinResolver = computed(() => {
    const v = this.valores();
    return clavesFaltantes([v.asunto, v.cuerpo], {});
  });

  /** Cupo mensual de ejecuciones (free: 15/mes). Cada "Preparar" crea un registro que cuenta; las rules lo hacen cumplir. */
  protected readonly usadas = computed(() => this.uso.usado('accionesMes'));
  protected readonly limiteMes = computed(() => this.plan.limite('accionesMes'));
  private readonly cupoAgotado = computed(() => estadoCupo(this.usadas(), this.limiteMes()) === 'agotado');

  /** Despacho de ejemplo: no se prepara ni abre ningún mensaje (sin efectos externos). */
  readonly esDemo = computed(() => esEmpresaDemo(this.company.activeCompany()));
  protected readonly avisoDemo = AVISO_DEMO_SIN_ENVIOS;

  readonly puedePreparar = computed(() => {
    const v = this.valores();
    return (
      !this.esDemo() &&
      this.fase() !== 'preparando' &&
      this.canal() !== null &&
      this.contactosSel().length > 0 &&
      v.asunto.trim().length > 0 &&
      v.cuerpo.trim().length > 0 &&
      !this.plantillaDocError() &&
      this.docFaltantes().length === 0
    );
  });

  readonly mensajeEstado = computed(() => {
    switch (this.fase()) {
      case 'preparando':
        return this.accion().docTemplateId ? 'Preparando… generando el documento y el enlace.' : 'Preparando…';
      case 'listo':
        if (this.copiado()) return 'Texto copiado al portapapeles.';
        return this.aperturaBloqueada()
          ? 'El navegador bloqueó la apertura. Usa el enlace o copia el texto.'
          : 'Todo listo. Pulsa el botón para abrir el mensaje.';
      default:
        return '';
    }
  });

  constructor() {
    this.form.valueChanges.subscribe((v) => this.valores.set({ asunto: v.asunto ?? '', cuerpo: v.cuerpo ?? '' }));
    this.docForm.valueChanges.subscribe(() => this.valoresDoc.set(this.docForm.getRawValue()));

    // Rellena asunto/cuerpo al cambiar destinatarios/hito, respetando lo que el usuario editó.
    effect(() => {
      const ctx = this.contexto();
      const a = this.accion();
      untracked(() => {
        this.rellenar(this.form.controls.asunto, interpolarTexto(a.asunto, ctx));
        this.rellenar(this.form.controls.cuerpo, interpolarTexto(a.cuerpo, ctx));
      });
    });

    // Variables del documento: prerrellenar las no editadas.
    effect(() => {
      const vars = this.variablesDoc();
      const pre = prefillVariables(vars, this.contexto());
      untracked(() => {
        for (const v of vars) {
          let ctl = this.docForm.controls[v.key];
          if (!ctl) {
            ctl = new FormControl('', { nonNullable: true });
            this.docForm.addControl(v.key, ctl);
          }
          this.rellenar(ctl, pre[v.key] ?? '');
        }
        this.valoresDoc.set(this.docForm.getRawValue());
      });
    });

    // Mantiene un canal válido seleccionado.
    effect(() => {
      const lista = this.canales();
      const actual = untracked(() => this.canal());
      if (actual && lista.some((c) => c.canal === actual && c.disp.ok)) return;
      this.canal.set(lista.find((c) => c.disp.ok)?.canal ?? null);
    });

    // Al terminar de preparar, el foco va al botón "Abrir".
    effect(() => {
      const btn = this.abrirBtn();
      if (btn) untracked(() => btn.nativeElement.focus());
    });
  }

  ngOnInit(): void {
    this.seleccion.set(this.contactos().map((c) => c.id));
    const pre = this.hitoId();
    this.hitoSel.set(pre ?? hitoSugerido(this.hitos())?.id ?? '');

    const docId = this.accion().docTemplateId;
    if (docId) void this.cargarPlantilla(docId);
  }

  private async cargarPlantilla(id: string): Promise<void> {
    try {
      const t = await this.docTemplates.getTemplate(id);
      if (t) this.plantillaDoc.set({ name: t.name, variables: t.variables });
      else this.plantillaDocError.set(true);
    } catch {
      this.plantillaDocError.set(true);
    }
  }

  /** `setValue` solo si el usuario no tocó el control (los cambios programáticos no lo marcan dirty). */
  private rellenar(control: FormControl<string>, valor: string): void {
    if (!control.dirty) control.setValue(valor);
  }

  /**
   * Vuelca lo redactado por la IA. Marca los controles dirty para que el
   * relleno automático (al cambiar destinatarios o hito) no lo pise.
   */
  aplicarRedaccion(t: TextoRedactado): void {
    const c = this.form.controls;
    c.asunto.setValue(t.asunto || c.asunto.value);
    c.cuerpo.setValue(t.cuerpo);
    c.asunto.markAsDirty();
    c.cuerpo.markAsDirty();
  }

  nombre(c: Contact): string {
    return getContactDisplayName(c);
  }

  estaSeleccionado(id: string): boolean {
    return this.seleccion().includes(id);
  }

  alternarContacto(id: string): void {
    this.seleccion.update((l) => (l.includes(id) ? l.filter((x) => x !== id) : [...l, id]));
  }

  seleccionarHito(id: string): void {
    this.hitoSel.set(id);
  }

  elegirCanal(canal: Canal): void {
    this.canal.set(canal);
  }

  async preparar(): Promise<void> {
    const canal = this.canal();
    if (!this.puedePreparar() || !canal) return;
    if (this.cupoAgotado()) {
      this.mejora.abrir();
      return;
    }
    this.fase.set('preparando');
    this.aperturaBloqueada.set(false);
    this.copiado.set(false);
    const v = this.form.getRawValue();
    const caso = this.caso();
    const hito = this.hitoSel();
    try {
      const res = await this.svc.preparar({
        accion: this.accion(),
        contactos: this.contactosSel(),
        canal,
        asunto: v.asunto,
        cuerpo: v.cuerpo,
        ...(this.accion().docTemplateId ? { valoresDoc: this.docForm.getRawValue() } : {}),
        ...(caso ? { casoId: caso.id } : {}),
        ...(hito ? { hitoId: hito } : {}),
      });
      this.resultado.set(res);
      this.fase.set('listo');
    } catch (e) {
      console.error('[acciones] preparar', e);
      this.fase.set('error');
    }
  }

  /** Handler del click: sin awaits, para conservar el gesto de usuario. */
  abrir(): void {
    const r = this.resultado();
    const canal = this.canal();
    if (!r || !canal) return;
    this.aperturaBloqueada.set(!this.svc.abrir(r.url, canal));
  }

  async copiar(): Promise<void> {
    const r = this.resultado();
    if (!r) return;
    try {
      await navigator.clipboard.writeText(r.cuerpoFinal);
      this.copiado.set(true);
    } catch {
      this.copiado.set(false);
    }
  }

  volverAEditar(): void {
    this.resultado.set(null);
    this.fase.set('editando');
  }
}
