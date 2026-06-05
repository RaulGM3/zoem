import { Timestamp } from '@angular/fire/firestore';
import { FirmRole } from './member';

export type InvitationRole = FirmRole;
export type InvitationStatus = 'pending' | 'accepted' | 'expired';

export interface CompanyInvitation {
  id?: string;
  companyId: string;
  companyName: string;
  email: string;
  role: InvitationRole;
  token: string;
  expiresAt: Timestamp;
  status: InvitationStatus;
  createdBy: string;
  createdAt: Timestamp;
}
