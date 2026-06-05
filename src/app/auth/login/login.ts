import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
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

  readonly form = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required]],
  });

  readonly emailInvalid = computed(
    () => !!this.form.get('email')?.invalid && !!this.form.get('email')?.touched
  );

  readonly passwordInvalid = computed(
    () => !!this.form.get('password')?.invalid && !!this.form.get('password')?.touched
  );

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
