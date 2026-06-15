import { Timestamp } from '@angular/fire/firestore';

export type TemplateVariableType = 'text' | 'textarea' | 'date' | 'number' | 'currency' | 'email';

export interface TemplateVariable {
  /** snake_case, coincide con el marcador {{key}} en el html */
  key: string;
  label: string;
  type: TemplateVariableType;
  /** Qué dato es y dónde encontrarlo — contrato para el futuro auto-fill desde documentos del caso */
  description?: string;
  required: boolean;
}

export type DocTemplateStatus = 'procesando' | 'revision' | 'listo' | 'error';

export interface DocTemplate {
  id: string;
  companyId: string;
  name: string;
  description?: string;
  status: DocTemplateStatus;
  /** Plantilla HTML con marcadores {{key}}. Vacío si está en htmlStoragePath (límite 1MB Firestore) */
  html: string;
  htmlStoragePath?: string;
  variables: TemplateVariable[];
  sourceFileName?: string;
  sourceMimeType?: string;
  sourceStoragePath?: string;
  sourceDownloadUrl?: string;
  extractionError?: string;
  createdBy?: string;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}
