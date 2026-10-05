import * as admin from 'firebase-admin';
import { HttpsError } from 'firebase-functions/v2/https';

// Verifica que el caller sea miembro activo de companyId con uno de los roles dados.
// Los superusuarios (users/{uid}.isSuperUser == true) pasan siempre.
//
// IMPORTANTE: las Cloud Functions corren con el Admin SDK y BYPASSEAN las
// Firestore security rules. La autorización de tenant DEBE hacerse acá, no se
// puede delegar en las rules.
export async function assertCompanyAccess(
  uid: string,
  companyId: string,
  roles: readonly string[] = ['Admin', 'Gestor'],
): Promise<void> {
  const db = admin.firestore();

  const userSnap = await db.doc(`users/${uid}`).get();
  if (userSnap.get('isSuperUser') === true) return;

  const memberSnap = await db.doc(`companies/${companyId}/members/${uid}`).get();
  const member = memberSnap.data();
  if (
    !memberSnap.exists ||
    member?.estado !== 'activo' ||
    !roles.includes(member?.role)
  ) {
    throw new HttpsError(
      'permission-denied',
      'No autorizado para esta empresa',
    );
  }
}
