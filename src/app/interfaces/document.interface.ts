export interface AppDocument {
  id: string;
  name: string;
  type: string;
  client: string;
  project?: string;
  size: string;
  createdAt: string;
  updatedAt: string;
  status: 'borrador' | 'revision' | 'firmado' | 'archivado';
}
