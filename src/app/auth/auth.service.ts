import { computed, inject, Injectable, signal } from '@angular/core';
import {
  Auth,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  type User,
} from '@angular/fire/auth';
import { UserSyncService } from '../core/services/user-sync.service';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly auth = inject(Auth);
  private readonly userSync = inject(UserSyncService);

  readonly user = signal<User | null>(null);
  readonly isLoading = signal(true);
  readonly isAuthenticated = computed(() => !!this.user());

  constructor() {
    onAuthStateChanged(this.auth, async (user) => {
      this.user.set(user);
      if (user) {
        await this.userSync.syncUser(user.email ?? '', user.displayName);
      } else {
        this.userSync.currentUser.set(null);
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

  async logout(): Promise<void> {
    await signOut(this.auth);
  }
}
