import {
  Component,
  ChangeDetectionStrategy,
  signal,
  computed,
  inject,
} from '@angular/core';
import { DatePipe } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { Functions, httpsCallable } from '@angular/fire/functions';
import { LucideAngularModule, ShieldCheck, ShieldAlert, ShieldX, Upload, Loader2 } from 'lucide-angular';
import { CompanyService } from '../../core/services/company.service';

type EstadoCert = 'sin_configurar' | 'activo' | 'expirado';

@Component({
  selector: 'app-credenciales-aeat',
  imports: [LucideAngularModule, ReactiveFormsModule, DatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="space-y-6">
      <div class="flex items-center gap-3">
        <lucide-icon [img]="iconEstado()" class="size-6" [class]="colorEstado()"></lucide-icon>
        <div>
          <p class="font-semibold text-sm">Certificado digital AEAT (Verifactu)</p>
          <p class="text-xs text-neutral-400">{{ descripcionEstado() }}</p>
        </div>
      </div>

      @if (company()?.verifactu?.certTitular) {
        <div class="rounded-lg bg-neutral-800 p-4 text-sm space-y-1">
          <p><span class="text-neutral-400">Titular:</span> {{ company()!.verifactu!.certTitular }}</p>
          <p><span class="text-neutral-400">NIF cert:</span> {{ company()!.verifactu!.certNif }}</p>
          <p><span class="text-neutral-400">Expira:</span> {{ company()!.verifactu!.certExpiry | date:'dd/MM/yyyy' }}</p>
        </div>
      }

      <form [formGroup]="form" (ngSubmit)="subir()" class="space-y-4">
        <div>
          <label class="block text-xs text-neutral-400 mb-1">Archivo .pfx / .p12</label>
          <input
            type="file"
            accept=".pfx,.p12"
            (change)="onFileChange($event)"
            class="block w-full text-sm text-neutral-300 file:mr-3 file:rounded-md file:border-0 file:bg-neutral-700 file:px-3 file:py-1.5 file:text-xs file:text-neutral-200 hover:file:bg-neutral-600"
          />
        </div>

        <div>
          <label class="block text-xs text-neutral-400 mb-1">Contraseña del certificado</label>
          <input
            type="password"
            formControlName="password"
            autocomplete="current-password"
            placeholder="••••••••"
            class="w-full rounded-md bg-neutral-800 border border-neutral-700 px-3 py-2 text-sm text-neutral-100 placeholder:text-neutral-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>

        @if (error()) {
          <p class="text-xs text-red-400">{{ error() }}</p>
        }

        <button
          type="submit"
          [disabled]="!archivoBase64() || form.invalid || cargando()"
          class="flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          @if (cargando()) {
            <lucide-icon [img]="Loader2Icon" class="size-4 animate-spin"></lucide-icon>
          } @else {
            <lucide-icon [img]="UploadIcon" class="size-4"></lucide-icon>
          }
          Guardar certificado
        </button>
      </form>
    </div>
  `,
})
export class CredencialesAeatComponent {
  protected readonly ShieldCheckIcon = ShieldCheck;
  protected readonly ShieldAlertIcon = ShieldAlert;
  protected readonly ShieldXIcon = ShieldX;
  protected readonly UploadIcon = Upload;
  protected readonly Loader2Icon = Loader2;

  private readonly fb = inject(FormBuilder);
  private readonly functions = inject(Functions);
  private readonly companyService = inject(CompanyService);

  readonly company = this.companyService.activeCompany;

  readonly cargando = signal(false);
  readonly error = signal<string | null>(null);
  readonly archivoBase64 = signal<string | null>(null);

  readonly form = this.fb.group({
    password: ['', Validators.required],
  });

  readonly estadoCert = computed((): EstadoCert => {
    const v = this.company()?.verifactu;
    if (!v?.certExpiry) return 'sin_configurar';
    return new Date(v.certExpiry) > new Date() ? 'activo' : 'expirado';
  });

  readonly iconEstado = computed(() => {
    const e = this.estadoCert();
    if (e === 'activo') return this.ShieldCheckIcon;
    if (e === 'expirado') return this.ShieldAlertIcon;
    return this.ShieldXIcon;
  });

  readonly colorEstado = computed(() => {
    const e = this.estadoCert();
    if (e === 'activo') return 'text-green-400';
    if (e === 'expirado') return 'text-yellow-400';
    return 'text-neutral-400';
  });

  readonly descripcionEstado = computed(() => {
    const e = this.estadoCert();
    if (e === 'activo') return 'Certificado activo — las facturas se enviarán automáticamente a Verifactu';
    if (e === 'expirado') return 'Certificado expirado — actualízalo para seguir enviando facturas';
    return 'Sin certificado configurado — necesario para cumplir con Verifactu';
  });

  onFileChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // result = "data:application/x-pkcs12;base64,AAAA..." — extraemos solo la parte base64
      this.archivoBase64.set(result.split(',')[1] ?? null);
    };
    reader.readAsDataURL(file);
  }

  async subir(): Promise<void> {
    const pfxBase64 = this.archivoBase64();
    const password = this.form.value.password;
    const companyId = this.company()?.id;

    if (!pfxBase64 || !password || !companyId) return;

    this.cargando.set(true);
    this.error.set(null);

    try {
      const fn = httpsCallable<
        { companyId: string; pfxBase64: string; password: string },
        { certNif: string; certTitular: string; certExpiry: string }
      >(this.functions, 'storeAeatCredential');

      const result = await fn({ companyId, pfxBase64, password });
      const { certNif, certTitular, certExpiry } = result.data;

      await this.companyService.updateCompany(companyId, {
        verifactu: {
          enabled: true,
          certNif,
          certTitular,
          certExpiry,
          certStoredAt: new Date().toISOString(),
        },
      });

      this.form.reset();
      this.archivoBase64.set(null);
    } catch (err) {
      this.error.set(err instanceof Error ? err.message : 'Error al guardar el certificado');
    } finally {
      this.cargando.set(false);
    }
  }
}
