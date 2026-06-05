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
import { UserSyncService } from '../core/services/user-sync.service';
import { CompanyService } from '../core/services/company.service';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly auth = inject(Auth);
  private readonly userSync = inject(UserSyncService);
  private readonly companyService = inject(CompanyService);

  readonly user = signal<User | null>(null);
  readonly isLoading = signal(true);
  readonly isAuthenticated = computed(() => !!this.user());

  constructor() {
    onAuthStateChanged(this.auth, async (user) => {
      this.user.set(user);
      if (user) {
        await this.userSync.syncUser(user.uid, user.email ?? '', user.displayName);
        await this.companyService.loadMyCompanies(user.uid);
      } else {
        this.userSync.currentUser.set(null);
        this.companyService.activeCompany.set(null);
      }
      this.isLoading.set(false);
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
