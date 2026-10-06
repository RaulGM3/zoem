import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Database, LucideAngularModule } from 'lucide-angular';
import { DemoSeedService, type ProgresoSeed, type ResultadoSeed } from '../../../core/services/demo-seed.service';
import { ToastService } from '../../../core/services/toast.service';
import { SuperuserService } from '../../../services/superuser';

/** Empresa demo que se enseña a prospectos. */
const EMPRESA_DEMO = '9vWJhBHGyChniLCpXLKm';

@Component({
  selector: 'app-superuser-demo',
  imports: [ReactiveFormsModule, LucideAngularModule],
  templateUrl: './demo.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DemoComponent {
  readonly DatabaseIcon = Database;

  private readonly fb = inject(FormBuilder);
  private readonly seed = inject(DemoSeedService);
  private readonly toast = inject(ToastService);
  private readonly companiesSvc = inject(SuperuserService);

  readonly companies = toSignal(this.companiesSvc.getCompanies(), { initialValue: [] });

  readonly form = this.fb.nonNullable.group({
    companyId: [EMPRESA_DEMO, Validators.required],
    confirmado: [false, Validators.requiredTrue],
  });

  readonly cargando = signal(false);
  readonly progreso = signal<ProgresoSeed | null>(null);
  readonly resultado = signal<ResultadoSeed | null>(null);
  readonly error = signal<string | null>(null);

  readonly porcentaje = computed(() => {
    const p = this.progreso();
    return p && p.total > 0 ? Math.round((p.hechos / p.total) * 100) : 0;
  });

  readonly filasResultado = computed(() =>
    Object.entries(this.resultado()?.porColeccion ?? {}).sort(([, a], [, b]) => b - a),
  );

  async cargar(): Promise<void> {
    if (this.form.invalid || this.cargando()) return;
    this.cargando.set(true);
    this.resultado.set(null);
    this.error.set(null);
    try {
      const res = await this.seed.cargar(this.form.getRawValue().companyId, (p) => this.progreso.set(p));
      this.resultado.set(res);
      this.form.controls.confirmado.setValue(false);
      this.toast.success(`Demo cargada: ${res.documentos} documentos`);
    } catch (err) {
      console.error('[DemoComponent] seed', err);
      this.error.set(err instanceof Error ? err.message : String(err));
    } finally {
      this.cargando.set(false);
    }
  }
}
