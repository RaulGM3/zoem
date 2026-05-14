import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [ReactiveFormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="login-container">
      <div class="login-card">
        <div class="login-header">
          <h1>Bienvenido a Zoem</h1>
          <p>Ingresa con tu cuenta para continuar</p>
        </div>

        <form [formGroup]="form" (ngSubmit)="onSubmit()" novalidate>
          <div class="form-field">
            <label for="email">Correo electrónico</label>
            <input
              id="email"
              type="email"
              formControlName="email"
              autocomplete="email"
              [class.invalid]="emailInvalid()"
              aria-describedby="email-error"
            />
            @if (emailInvalid()) {
              <span id="email-error" class="field-error" role="alert">
                Ingresá un correo válido
              </span>
            }
          </div>

          <div class="form-field">
            <label for="password">Contraseña</label>
            <input
              id="password"
              type="password"
              formControlName="password"
              autocomplete="current-password"
              [class.invalid]="passwordInvalid()"
              aria-describedby="password-error"
            />
            @if (passwordInvalid()) {
              <span id="password-error" class="field-error" role="alert">
                La contraseña es requerida
              </span>
            }
          </div>

          @if (errorMessage()) {
            <div class="error-banner" role="alert">{{ errorMessage() }}</div>
          }

          <button
            type="submit"
            class="btn-primary"
            [disabled]="isLoading()"
            [attr.aria-busy]="isLoading()"
          >
            {{ isLoading() ? 'Ingresando...' : 'Ingresar' }}
          </button>
        </form>

        <div class="divider" aria-hidden="true">
          <span>o</span>
        </div>

        <button
          type="button"
          class="btn-google"
          [disabled]="isLoading()"
          (click)="onGoogleLogin()"
        >
          <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
            <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z"/>
            <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332C2.438 15.983 5.482 18 9 18z"/>
            <path fill="#FBBC05" d="M3.964 10.71c-.18-.54-.282-1.117-.282-1.71s.102-1.17.282-1.71V4.958H.957C.347 6.173 0 7.548 0 9s.348 2.827.957 4.042l3.007-2.332z"/>
            <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0 5.482 0 2.438 2.017.957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z"/>
          </svg>
          Continuar con Google
        </button>
      </div>
    </div>
  `,
  styles: [`
    .login-container {
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      background: #f5f5f5;
      padding: 1rem;
    }

    .login-card {
      background: white;
      border-radius: 12px;
      padding: 2.5rem;
      width: 100%;
      max-width: 400px;
      box-shadow: 0 4px 24px rgba(0, 0, 0, 0.08);
    }

    .login-header {
      text-align: center;
      margin-bottom: 2rem;

      h1 {
        font-size: 1.5rem;
        font-weight: 700;
        color: #111;
        margin: 0 0 0.5rem;
      }

      p {
        color: #666;
        margin: 0;
        font-size: 0.9rem;
      }
    }

    .form-field {
      display: flex;
      flex-direction: column;
      gap: 0.4rem;
      margin-bottom: 1rem;

      label {
        font-size: 0.875rem;
        font-weight: 500;
        color: #333;
      }

      input {
        padding: 0.625rem 0.875rem;
        border: 1.5px solid #ddd;
        border-radius: 8px;
        font-size: 0.95rem;
        outline: none;
        transition: border-color 0.2s;

        &:focus {
          border-color: #4f46e5;
        }

        &.invalid {
          border-color: #dc2626;
        }
      }
    }

    .field-error {
      font-size: 0.8rem;
      color: #dc2626;
    }

    .error-banner {
      background: #fef2f2;
      border: 1px solid #fecaca;
      border-radius: 8px;
      padding: 0.75rem 1rem;
      color: #dc2626;
      font-size: 0.875rem;
      margin-bottom: 1rem;
    }

    .btn-primary {
      width: 100%;
      padding: 0.75rem;
      background: #4f46e5;
      color: white;
      border: none;
      border-radius: 8px;
      font-size: 0.95rem;
      font-weight: 500;
      cursor: pointer;
      transition: background 0.2s;
      margin-top: 0.5rem;

      &:hover:not(:disabled) {
        background: #4338ca;
      }

      &:disabled {
        opacity: 0.6;
        cursor: not-allowed;
      }
    }

    .divider {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      margin: 1.5rem 0;
      color: #aaa;
      font-size: 0.85rem;

      &::before,
      &::after {
        content: '';
        flex: 1;
        height: 1px;
        background: #e5e7eb;
      }
    }

    .btn-google {
      width: 100%;
      padding: 0.75rem;
      background: white;
      color: #333;
      border: 1.5px solid #ddd;
      border-radius: 8px;
      font-size: 0.95rem;
      font-weight: 500;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 0.75rem;
      transition: background 0.2s, border-color 0.2s;

      &:hover:not(:disabled) {
        background: #f9fafb;
        border-color: #bbb;
      }

      &:disabled {
        opacity: 0.6;
        cursor: not-allowed;
      }
    }
  `],
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
