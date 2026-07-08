import { Timestamp } from '@angular/fire/firestore';
import { FirmRole } from './member';

export type InvitationRole = FirmRole;
export type InvitationStatus = 'pending' | 'accepted' | 'expired';

export interface CompanyInvitation {
  id?: string;
  companyId: string;
  companyName: string;
  email: string;
  /** Rol BASE de las security rules (si hay rol custom, es su baseRole). */
  role: InvitationRole;
  /** Rol custom de la empresa asignado en la invitación (opcional). */
  customRoleId?: string;
  customRoleNombre?: string;
  token: string;
  expiresAt: Timestamp;
  status: InvitationStatus;
  createdBy: string;
  createdAt: Timestamp;
}
