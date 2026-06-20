import type { Timestamp } from '@angular/fire/firestore';

/**
 * Mapeo agentId → company para las llamadas de RecepciónIA.
 *
 * Vive en su PROPIA colección `agentMappings` (NO en `companies`).
 * El doc id ES el agentId: así las security rules resuelven
 * `agentId → companyId` con un get() directo (las rules no hacen queries)
 * y una empresa solo ve las llamadas de los agentId que tiene registrados.
 *
 * Se crea/edita EXCLUSIVAMENTE desde superuser (enforced por las rules).
 */
export interface AgentMapping {
  /** doc id == agentId */
  agentId: string;
  companyId: string;
  /** Denormalizado para listar sin join. */
  companyName?: string;
  /** Alias humano del agente (opcional). */
  label?: string;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}
