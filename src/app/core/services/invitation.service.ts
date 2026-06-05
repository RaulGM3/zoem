import { inject, Injectable } from '@angular/core';
import {
  addDoc,
  collection,
  collectionData,
  deleteDoc,
  doc,
  getDocs,
  query,
  serverTimestamp,
  Timestamp,
  updateDoc,
  where,
} from '@angular/fire/firestore';
import { Firestore } from '@angular/fire/firestore';
import { Observable } from 'rxjs';
import { CompanyInvitation, InvitationRole } from '../../interfaces/invitation';
import { UserSyncService } from './user-sync.service';

@Injectable({ providedIn: 'root' })
export class InvitationService {
  private readonly firestore = inject(Firestore);
  private readonly userSync = inject(UserSyncService);

  private get col() {
    return collection(this.firestore, 'companyInvitations');
  }

  async createInvitation(
    companyId: string,
    companyName: string,
    email: string,
    role: InvitationRole,
    createdBy: string,
  ): Promise<string> {
    const token = crypto.randomUUID();
    const sevenDays = 7 * 24 * 60 * 60 * 1000;
    const expiresAt = Timestamp.fromDate(new Date(Date.now() + sevenDays));
    await addDoc(this.col, {
      companyId,
      companyName,
      email: email.toLowerCase().trim(),
      role,
      token,
      expiresAt,
      status: 'pending',
      createdBy,
      createdAt: serverTimestamp(),
    });
    return token;
  }

  getInvitationsByCompany(companyId: string): Observable<CompanyInvitation[]> {
    const q = query(this.col, where('companyId', '==', companyId));
    return collectionData(q, { idField: 'id' }) as Observable<CompanyInvitation[]>;
  }

  getAllPendingInvitations(): Observable<CompanyInvitation[]> {
    const q = query(this.col, where('status', '==', 'pending'));
    return collectionData(q, { idField: 'id' }) as Observable<CompanyInvitation[]>;
  }

  async getInvitationByToken(token: string): Promise<CompanyInvitation | null> {
    const q = query(this.col, where('token', '==', token));
    const snap = await getDocs(q);
    if (snap.empty) return null;
    const d = snap.docs[0];
    return { id: d.id, ...d.data() } as CompanyInvitation;
  }

  async acceptInvitation(token: string, userEmail: string): Promise<void> {
    const invitation = await this.getInvitationByToken(token);
    if (!invitation || !invitation.id) throw new Error('Invitación no encontrada');
    if (invitation.status !== 'pending') throw new Error('Esta invitación ya no está activa');

    const now = Timestamp.now();
    if (invitation.expiresAt.seconds < now.seconds) throw new Error('La invitación ha expirado');

    if (invitation.email !== userEmail.toLowerCase().trim()) {
      throw new Error('Esta invitación no está dirigida a tu dirección de correo');
    }

    const normalizedEmail = userEmail.toLowerCase().trim();
    const membersCol = collection(this.firestore, 'companyMembers');
    await addDoc(membersCol, {
      companyId: invitation.companyId,
      userId: normalizedEmail,
      email: normalizedEmail,
      nombre: '',
      role: invitation.role,
      departamento: '',
      estado: 'activo',
      ultimoLogin: null,
      createdAt: serverTimestamp(),
    });

    const systemRole: 'admin' | 'user' = invitation.role === 'Admin' ? 'admin' : 'user';
    await this.userSync.updateUserCompany(userEmail, invitation.companyId, systemRole);

    await updateDoc(doc(this.firestore, 'companyInvitations', invitation.id), {
      status: 'accepted',
    });
  }

  async cancelInvitation(id: string): Promise<void> {
    await deleteDoc(doc(this.firestore, 'companyInvitations', id));
  }
}
