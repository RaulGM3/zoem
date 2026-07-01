import { computed, inject, Injectable, signal } from '@angular/core';
import {
  Auth,
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateProfile,
  type User,
} from '@angular/fire/auth';
import { Router } from '@angular/router';
import { UserSyncService } from '../core/services/user-sync.service';
import { CompanyService } from '../core/services/company.service';
import { UsersService } from '../core/services/users';
import { PushNotificationService } from '../core/services/push-notification.service';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly auth = inject(Auth);
  private readonly router = inject(Router);
  private readonly userSync = inject(UserSyncService);
  private readonly companyService = inject(CompanyService);
  private readonly usersService = inject(UsersService);
  private readonly pushNotifications = inject(PushNotificationService);

  readonly user = signal<User | null>(null);
  readonly isLoading = signal(true);
  readonly isAuthenticated = computed(() => !!this.user());

  constructor() {
    onAuthStateChanged(this.auth, async (user) => {
      this.user.set(user);
      try {
        if (user) {
          await this.userSync.syncUser(user.uid, user.email ?? '', user.displayName);
          await this.companyService.loadMyCompanies(user.uid);
          // Cargar los miembros de la empresa activa acá garantiza que el rol del
          // usuario esté disponible app-wide (sidebar, dashboard) sin importar por
          // qué ruta entre. El permissionGuard ya no es el único que los carga.
          await this.usersService.loadMembers();
          void this.pushNotifications.init();
        } else {
          this.userSync.currentUser.set(null);
          this.companyService.activeCompany.set(null);
          this.usersService.members.set([]);
          const currentUrl = this.router.url;
          const isPublicRoute = currentUrl.startsWith('/login') || currentUrl.startsWith('/invite');
          if (!isPublicRoute) {
            this.router.navigate(['/login']);
          }
        }
      } catch (err) {
        // Un fallo de sincronización (red, permisos, Firestore offline) NO debe
        // dejar la app colgada en el spinner. Logueamos y liberamos isLoading
        // en el finally para que el usuario llegue al login / a un estado usable.
        console.error('[auth] error sincronizando sesión:', err);
      } finally {
        this.isLoading.set(false);
      }
    });
  }

  async loginWithEmail(email: string, password: string): Promise<void> {
    await signInWithEmailAndPassword(this.auth, email, password);
  }

  async loginWithGoogle(): Promise<void> {
    await signInWithPopup(this.auth, new GoogleAuthProvider());
  }

  async registerWithEmail(email: string, password: string, displayName?: string): Promise<string> {
    const { user } = await createUserWithEmailAndPassword(this.auth, email, password);
    if (displayName) {
      await updateProfile(user, { displayName });
    }
    return user.uid;
  }

  async logout(): Promise<void> {
    await signOut(this.auth);
  }
}
