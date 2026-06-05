import { computed, Injectable, signal } from '@angular/core';
import { inject } from '@angular/core';
import { Firestore, doc, getDoc, setDoc, updateDoc, serverTimestamp } from '@angular/fire/firestore';
import { SystemRole, ZoemUser } from '../../interfaces/user';

@Injectable({ providedIn: 'root' })
export class UserSyncService {
  private readonly firestore = inject(Firestore);

  readonly currentUser = signal<ZoemUser | null>(null);
  readonly isSuperUser = computed(() => this.currentUser()?.isSuperUser ?? false);

  async syncUser(uid: string, email: string, displayName: string | null): Promise<void> {
    const userRef = doc(this.firestore, 'users', uid);
    const snapshot = await getDoc(userRef);
    if (!snapshot.exists()) {
      await setDoc(userRef, {
        email,
        displayName,
        isSuperUser: false,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } else {
      await setDoc(userRef, { displayName, updatedAt: serverTimestamp() }, { merge: true });
    }
    await this.loadCurrentUser(uid);
  }

  async loadCurrentUser(uid: string): Promise<void> {
    const userRef = doc(this.firestore, 'users', uid);
    const snapshot = await getDoc(userRef);
    if (snapshot.exists()) {
      this.currentUser.set({ id: snapshot.id, ...snapshot.data() } as ZoemUser);
    } else {
      this.currentUser.set(null);
    }
  }

  async updateUserCompany(uid: string, companyId: string, role: SystemRole): Promise<void> {
    const userRef = doc(this.firestore, 'users', uid);
    await updateDoc(userRef, { companyId, role, updatedAt: serverTimestamp() });
    this.currentUser.update((u) => u ? { ...u, companyId, role } : u);
  }
}
