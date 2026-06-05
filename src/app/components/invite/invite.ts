import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  OnInit,
  signal,
} from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import {
  AbstractControl,
  FormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { toSignal } from '@angular/core/rxjs-interop';
import {
  Building2,
  CircleAlert,
  CircleCheck,
  CircleCheckBig,
  CircleX,
  Eye,
  EyeOff,
  LucideAngularModule,
  Shield,
  UserCheck,
} from 'lucide-angular';
import { InvitationService } from '../../core/services/invitation.service';
import { AuthService } from '../../auth/auth.service';
import { CompanyInvitation } from '../../interfaces/invitation';

type PageState = 'loading' | 'valid' | 'invalid' | 'expired' | 'accepting' | 'accepted' | 'error';

function passwordStrengthValidator(control: AbstractControl): ValidationErrors | null {
  const val = (control.value as string) ?? '';
  if (!val) return null;
  const errors: ValidationErrors = {};
  if (val.length < 8) errors['minLength'] = true;
  if (!/[A-Z]/.test(val)) errors['uppercase'] = true;
  if (!/[a-z]/.test(val)) errors['lowercase'] = true;
  if (!/[0-9]/.test(val)) errors['number'] = true;
  if (!/[@$!%*?&]/.test(val)) errors['special'] = true;
  return Object.keys(errors).length ? errors : null;
}

function passwordMatchValidator(group: AbstractControl): ValidationErrors | null {
  const password = group.get('password')?.value as string;
  const confirm = group.get('confirmPassword')?.value as string;
  return password && confirm && password !== confirm ? { passwordMismatch: true } : null;
}

@Component({
  selector: 'app-invite',
  imports: [LucideAngularModule, RouterLink, ReactiveFormsModule],
  templateUrl: './invite.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class InviteComponent implements OnInit {
  readonly token = input.required<string>();

  readonly CircleAlertIcon = CircleAlert;
  readonly CircleCheckBigIcon = CircleCheckBig;
  readonly Building2Icon = Building2;
  readonly ShieldIcon = Shield;
  readonly UserCheckIcon = UserCheck;
  readonly EyeIcon = Eye;
  readonly EyeOffIcon = EyeOff;
  readonly CircleCheckIcon = CircleCheck;
  readonly CircleXIcon = CircleX;

  private readonly invitationService = inject(InvitationService);
  readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly fb = inject(FormBuilder);

  readonly state = signal<PageState>('loading');
  readonly invitation = signal<CompanyInvitation | null>(null);
  readonly errorMessage = signal<string | null>(null);
  readonly showPassword = signal(false);
  readonly showConfirmPassword = signal(false);

  readonly registerForm = this.fb.group(
    {
      nombre: ['', [Validators.required, Validators.minLength(2)]],
      apellido: ['', [Validators.required, Validators.minLength(2)]],
      telefono: ['', [Validators.required, Validators.pattern(/^[+\d\s\-().]{7,20}$/)]],
      password: ['', [Validators.required, passwordStrengthValidator]],
      confirmPassword: ['', Validators.required],
    },
    { validators: passwordMatchValidator },
  );

  private readonly passwordValue = toSignal(
    this.registerForm.get('password')!.valueChanges,
    { initialValue: '' },
  );

  readonly passwordRequirements = computed(() => {
    const val = this.passwordValue() ?? '';
    return [
      { label: 'Mínimo 8 caracteres', met: val.length >= 8 },
      { label: 'Una letra mayúscula (A-Z)', met: /[A-Z]/.test(val) },
      { label: 'Una letra minúscula (a-z)', met: /[a-z]/.test(val) },
      { label: 'Un número (0-9)', met: /[0-9]/.test(val) },
      { label: 'Un carácter especial (@$!%*?&)', met: /[@$!%*?&]/.test(val) },
    ];
  });

  async ngOnInit(): Promise<void> {
    const inv = await this.invitationService.getInvitationByToken(this.token());
    if (!inv) {
      this.state.set('invalid');
      return;
    }
    if (inv.status === 'accepted') {
      this.state.set('invalid');
      this.errorMessage.set('Esta invitación ya ha sido aceptada.');
      return;
    }
    const now = Date.now() / 1000;
    if (inv.expiresAt.seconds < now) {
      this.invitation.set(inv);
      this.state.set('expired');
      return;
    }
    this.invitation.set(inv);
    this.state.set('valid');
  }

  get currentUserEmail(): string | null {
    return this.auth.user()?.email ?? null;
  }

  get isLoggedIn(): boolean {
    return this.auth.isAuthenticated();
  }

  get isAuthLoading(): boolean {
    return this.auth.isLoading();
  }

  get emailMatches(): boolean {
    const inv = this.invitation();
    if (!inv || !this.currentUserEmail) return false;
    return inv.email === this.currentUserEmail.toLowerCase().trim();
  }

  goToLogin(): void {
    this.router.navigate(['/login'], {
      queryParams: { returnUrl: `/invite/${this.token()}` },
    });
  }

  async registerAndAccept(): Promise<void> {
    if (this.registerForm.invalid) return;
    const inv = this.invitation();
    if (!inv) return;

    const { nombre, apellido, telefono, password } = this.registerForm.value as {
      nombre: string; apellido: string; telefono: string; password: string;
    };
    const displayName = `${nombre.trim()} ${apellido.trim()}`;

    this.state.set('accepting');
    try {
      const uid = await this.auth.registerWithEmail(inv.email, password, displayName);
      await this.invitationService.acceptInvitation(this.token(), inv.email, uid, {
        nombre: nombre.trim(),
        apellido: apellido.trim(),
        telefono: telefono.trim(),
      });
      this.state.set('accepted');
      setTimeout(() => this.router.navigate(['/']), 2000);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Error al crear la cuenta.';
      this.errorMessage.set(msg);
      this.state.set('error');
    }
  }

  async accept(): Promise<void> {
    const userEmail = this.currentUserEmail;
    const uid = this.auth.user()?.uid;
    if (!userEmail || !uid) return;
    this.state.set('accepting');
    try {
      await this.invitationService.acceptInvitation(this.token(), userEmail, uid);
      this.state.set('accepted');
      setTimeout(() => this.router.navigate(['/']), 2000);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Error al aceptar la invitación.';
      this.errorMessage.set(msg);
      this.state.set('error');
    }
  }
}
