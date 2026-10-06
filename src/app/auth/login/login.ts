import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../auth.service';

@Component({
  selector: 'app-login',
  imports: [ReactiveFormsModule],
  templateUrl: './login.html',
  styleUrl: './login.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LoginComponent {
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly fb = inject(FormBuilder);

  readonly isLoading = signal(false);
  readonly errorMessage = signal('');
  readonly mode = signal<'login' | 'reset'>('login');
  readonly resetSentTo = signal('');
  readonly showPassword = signal(false);

  readonly form = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required]],
  });

  // Métodos y no computed(): el estado del form no es un signal, así que un
  // computed quedaría cacheado con su primer valor y el error nunca se mostraría.
  emailInvalid(): boolean {
    const control = this.form.controls.email;
    return control.invalid && control.touched;
  }

  passwordInvalid(): boolean {
    const control = this.form.controls.password;
    return control.invalid && control.touched;
  }

  constructor() {
    if (this.authService.isAuthenticated()) {
      this.router.navigate(['/']);
    }
  }

  async onSubmit(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.isLoading.set(true);
    this.errorMessage.set('');

    try {
      const { email, password } = this.form.getRawValue();
      await this.authService.loginWithEmail(email!, password!);
      await this.router.navigate(['/']);
    } catch {
      this.errorMessage.set('Correo o contraseña incorrectos.');
    } finally {
      this.isLoading.set(false);
    }
  }

  showReset(): void {
    this.errorMessage.set('');
    this.resetSentTo.set('');
    this.mode.set('reset');
  }

  showLogin(): void {
    this.errorMessage.set('');
    this.mode.set('login');
  }

  async onResetPassword(): Promise<void> {
    const emailControl = this.form.controls.email;
    if (emailControl.invalid) {
      emailControl.markAsTouched();
      return;
    }

    this.isLoading.set(true);
    this.errorMessage.set('');

    try {
      const email = emailControl.value!;
      await this.authService.sendPasswordReset(email);
      // Mensaje genérico: no revelamos si el correo tiene cuenta (enumeración).
      this.resetSentTo.set(email);
    } catch {
      this.errorMessage.set('No se pudo enviar el correo. Revisá la dirección e intentá de nuevo.');
    } finally {
      this.isLoading.set(false);
    }
  }

  async onGoogleLogin(): Promise<void> {
    this.isLoading.set(true);
    this.errorMessage.set('');

    try {
      await this.authService.loginWithGoogle();
      await this.router.navigate(['/']);
    } catch {
      this.errorMessage.set('No se pudo iniciar sesión con Google. Intentá de nuevo.');
    } finally {
      this.isLoading.set(false);
    }
  }
}
