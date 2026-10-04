import { computed, effect, inject, Injectable, signal } from '@angular/core';
import {
  collection,
  doc,
  Firestore,
  limit,
  onSnapshot,
  orderBy,
  query,
  updateDoc,
  where,
  writeBatch,
} from '@angular/fire/firestore';
import { AuthService } from '../../auth/auth.service';
import { CompanyService } from './company.service';

export type NotificacionTipo = 'llamadas' | 'casos' | 'contactos' | 'eventos' | 'hitos';

export interface Notificacion {
  id: string;
  userId: string;
  tipo: NotificacionTipo;
  titulo: string;
  cuerpo: string;
  route: string;
  leida: boolean;
  createdAt: Date | null;
}

const MAX_NOTIFICACIONES = 50;

/**
 * Notificaciones in-app del usuario en la empresa activa (companies/{cid}/notificaciones).
 * La suscripción en vivo sigue a sesión + empresa: se cierra al cambiar de empresa o al
 * cerrar sesión (sin fugas) y la lista se vacía.
 */
@Injectable({ providedIn: 'root' })
export class NotificacionesService {
  private readonly firestore = inject(Firestore);
  private readonly auth = inject(AuthService);
  private readonly company = inject(CompanyService);

  readonly notificaciones = signal<Notificacion[]>([]);
  readonly noLeidas = computed(() => this.notificaciones().filter((n) => !n.leida).length);

  constructor() {
    effect((onCleanup) => {
      const uid = this.auth.user()?.uid;
      const companyId = this.company.activeCompany()?.id;
      if (!uid || !companyId) {
        this.notificaciones.set([]);
        return;
      }
      const q = query(
        collection(this.firestore, 'companies', companyId, 'notificaciones'),
        where('userId', '==', uid),
        orderBy('createdAt', 'desc'),
        limit(MAX_NOTIFICACIONES),
      );
      const unsubscribe = onSnapshot(
        q,
        (snap) => {
          this.notificaciones.set(
            snap.docs.map((d) => {
              const data = d.data() as Record<string, unknown>;
              const created = data['createdAt'] as { toDate?: () => Date } | null | undefined;
              return {
                id: d.id,
                userId: data['userId'] as string,
                tipo: data['tipo'] as NotificacionTipo,
                titulo: (data['titulo'] as string) ?? '',
                cuerpo: (data['cuerpo'] as string) ?? '',
                route: (data['route'] as string) ?? '',
                leida: data['leida'] === true,
                createdAt: created?.toDate?.() ?? null,
              };
            }),
          );
        },
        (err) => console.error('[notificaciones] listener error:', err),
      );
      onCleanup(() => {
        unsubscribe();
        this.notificaciones.set([]);
      });
    });
  }

  async marcarLeida(id: string): Promise<void> {
    const companyId = this.company.activeCompany()?.id;
    if (!companyId) return;
    await updateDoc(doc(this.firestore, 'companies', companyId, 'notificaciones', id), { leida: true });
  }

  async marcarTodasLeidas(): Promise<void> {
    const companyId = this.company.activeCompany()?.id;
    const pendientes = this.notificaciones().filter((n) => !n.leida);
    if (!companyId || pendientes.length === 0) return;
    const batch = writeBatch(this.firestore);
    for (const n of pendientes) {
      batch.update(doc(this.firestore, 'companies', companyId, 'notificaciones', n.id), { leida: true });
    }
    await batch.commit();
  }
}
