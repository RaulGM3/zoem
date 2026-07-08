import { inject, Injectable } from '@angular/core';
import {
  collection,
  collectionData,
  deleteDoc,
  doc,
  getDoc,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  where,
} from '@angular/fire/firestore';
import { Firestore } from '@angular/fire/firestore';
import { Observable } from 'rxjs';
import { CompanyInvitation, InvitationRole } from '../../interfaces/invitation';
import { UserSyncService } from './user-sync.service';
import { stripUndefinedDeep } from '../firebase/sanitize';

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
    customRole?: { id: string; nombre: string },
  ): Promise<string> {
    const token = crypto.randomUUID();
    const sevenDays = 7 * 24 * 60 * 60 * 1000;
    const expiresAt = Timestamp.fromDate(new Date(Date.now() + sevenDays));
    // El doc id ES el token: las security rules lo resuelven con get() (no se puede query en rules).
    // `role` SIEMPRE es el rol base (lo que validan las rules); el custom viaja aparte.
    await setDoc(doc(this.firestore, 'companyInvitations', token), stripUndefinedDeep({
      companyId,
      companyName,
      email: email.toLowerCase().trim(),
      role,
      ...(customRole ? { customRoleId: customRole.id, customRoleNombre: customRole.nombre } : {}),
      token,
      expiresAt,
      status: 'pending',
      createdBy,
      createdAt: serverTimestamp(),
    }));
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
    const snap = await getDoc(doc(this.firestore, 'companyInvitations', token));
    if (!snap.exists()) return null;
    return { id: snap.id, ...snap.data() } as CompanyInvitation;
  }

  async acceptInvitation(
    token: string,
    userEmail: string,
    uid: string,
    profile?: { nombre: string; apellido: string; telefono: string },
  ): Promise<void> {
    const invitation = await this.getInvitationByToken(token);
    if (!invitation || !invitation.id) throw new Error('Invitación no encontrada');
    if (invitation.status !== 'pending') throw new Error('Esta invitación ya no está activa');

    const now = Timestamp.now();
    if (invitation.expiresAt.seconds < now.seconds) throw new Error('La invitación ha expirado');

    if (invitation.email !== userEmail.toLowerCase().trim()) {
      throw new Error('Esta invitación no está dirigida a tu dirección de correo');
    }

    const normalizedEmail = userEmail.toLowerCase().trim();
    // Membresía determinista: doc id == uid bajo companies/{cid}/members.
    // `inviteId` deja que la regla valide la invitación con un get() directo.
    const memberRef = doc(this.firestore, 'companies', invitation.companyId, 'members', uid);
    await setDoc(memberRef, stripUndefinedDeep({
      companyId: invitation.companyId,
      userId: uid,
      email: normalizedEmail,
      nombre: profile?.nombre ?? '',
      apellido: profile?.apellido ?? '',
      telefono: profile?.telefono ?? '',
      role: invitation.role,
      ...(invitation.customRoleId ? { customRoleId: invitation.customRoleId } : {}),
      departamento: '',
      estado: 'activo',
      inviteId: token,
      ultimoLogin: null,
      createdAt: serverTimestamp(),
    }));

    const systemRole: 'admin' | 'user' = invitation.role === 'Admin' ? 'admin' : 'user';
    await this.userSync.updateUserCompany(uid, invitation.companyId, systemRole);

    await updateDoc(doc(this.firestore, 'companyInvitations', invitation.id), stripUndefinedDeep({
      status: 'accepted',
    }));
  }

  async cancelInvitation(id: string): Promise<void> {
    await deleteDoc(doc(this.firestore, 'companyInvitations', id));
  }
}
