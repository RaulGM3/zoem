import { inject, Injectable, signal } from '@angular/core';
import {
  Firestore,
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  query,
  orderBy,
  serverTimestamp,
} from '@angular/fire/firestore';
import {
  Storage,
  ref,
  uploadBytes,
  uploadString,
  getDownloadURL,
} from '@angular/fire/storage';
import { Auth } from '@angular/fire/auth';
import { CompanyService } from './company.service';
import { DocAuditService } from './doc-audit.service';
import { PermissionService } from './permission.service';
import { stripUndefinedDeep } from '../firebase/sanitize';
import { isVisibleDoc } from '../docs/doc-versioning';
import { canSeePlantilla } from '../permissions/doc-access';
import { DocTemplate, TemplateVariable } from '../../interfaces';
import type { FirmRole } from '../../interfaces/member';
import type { PlantillaVisibility } from '../../interfaces/plantilla-file.interface';

export interface DocTemplateCreate {
  name: string;
  description?: string;
  html: string;
  variables: TemplateVariable[];
  sourceFile?: File;
}

/** Margen bajo el límite de 1MB por documento de Firestore */
const MAX_INLINE_HTML_BYTES = 900_000;

@Injectable({ providedIn: 'root' })
export class DocTemplateService {
  private readonly firestore = inject(Firestore);
  private readonly storage = inject(Storage);
  private readonly auth = inject(Auth);
  private readonly companyService = inject(CompanyService);
  private readonly docAudit = inject(DocAuditService);
  private readonly permissionService = inject(PermissionService);

  readonly templates = signal<DocTemplate[]>([]);
  readonly loading = signal(false);

  templatePath(id: string): string {
    return `companies/${this.companyId}/docTemplates/${id}`;
  }

  private get companyId(): string {
    const id = this.companyService.activeCompany()?.id;
    if (!id) throw new Error('No active company');
    return id;
  }

  private get templatesRef() {
    return collection(this.firestore, 'companies', this.companyId, 'docTemplates');
  }

  async loadTemplates(): Promise<void> {
    this.loading.set(true);
    try {
      const snapshot = await getDocs(query(this.templatesRef, orderBy('name')));
      const uid = this.auth.currentUser?.uid ?? '';
      const role = this.permissionService.userRole();
      const isSuper = this.permissionService.isSuperUser();
      this.templates.set(
        snapshot.docs
          .map(d => ({ id: d.id, ...d.data() }) as DocTemplate)
          .filter(isVisibleDoc)
          .filter(t => canSeePlantilla(t, uid, role, isSuper))
      );
    } finally {
      // El error se propaga al llamador (lo muestra ToastService).
      this.loading.set(false);
    }
  }

  async getTemplate(id: string): Promise<DocTemplate | null> {
    const snap = await getDoc(doc(this.templatesRef, id));
    if (!snap.exists()) return null;
    const template = { id: snap.id, ...snap.data() } as DocTemplate;
    if (!template.html && template.htmlStoragePath) {
      const url = await getDownloadURL(ref(this.storage, template.htmlStoragePath));
      template.html = await (await fetch(url)).text();
    }
    return template;
  }

  async createTemplate(input: DocTemplateCreate): Promise<string> {
    const companyId = this.companyId;
    const docRef = doc(this.templatesRef);

    let sourceStoragePath: string | undefined;
    let sourceDownloadUrl: string | undefined;
    if (input.sourceFile) {
      sourceStoragePath = `companies/${companyId}/docTemplates/${docRef.id}/source/${Date.now()}_${input.sourceFile.name}`;
      const sourceRef = ref(this.storage, sourceStoragePath);
      await uploadBytes(sourceRef, input.sourceFile);
      sourceDownloadUrl = await getDownloadURL(sourceRef);
    }

    const { html, htmlStoragePath } = await this.maybeOffloadHtml(docRef.id, input.html);

    await setDoc(docRef, stripUndefinedDeep({
      companyId,
      name: input.name,
      description: input.description,
      status: 'listo',
      html,
      htmlStoragePath,
      variables: input.variables,
      sourceFileName: input.sourceFile?.name,
      sourceMimeType: input.sourceFile?.type,
      sourceStoragePath,
      sourceDownloadUrl,
      createdBy: this.auth.currentUser?.uid ?? '',
      deleted: false,
      visibleTo: 'all',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    }));

    this.docAudit.log(this.templatePath(docRef.id), 'create', { detail: input.name });

    await this.loadTemplates();
    return docRef.id;
  }

  async updateTemplate(
    id: string,
    data: Partial<Omit<DocTemplate, 'id' | 'companyId' | 'createdAt' | 'updatedAt'>>
  ): Promise<void> {
    let updateData: Record<string, unknown> = { ...data };
    if (typeof data.html === 'string') {
      const { html, htmlStoragePath } = await this.maybeOffloadHtml(id, data.html);
      updateData = { ...updateData, html, htmlStoragePath: htmlStoragePath ?? null };
    }
    await updateDoc(doc(this.templatesRef, id), stripUndefinedDeep({
      ...updateData,
      updatedAt: serverTimestamp(),
    }));
    this.docAudit.log(this.templatePath(id), 'update');
    this.templates.update(list => list.map(t => (t.id === id ? { ...t, ...data } : t)));
  }

  /** Define quién puede ver esta plantilla de documento (rules protegen el get). */
  async setVisibility(
    id: string,
    visibleTo: PlantillaVisibility,
    visibleRoles: FirmRole[] = [],
    visibleUserIds: string[] = [],
  ): Promise<void> {
    await updateDoc(doc(this.templatesRef, id), stripUndefinedDeep({
      visibleTo,
      visibleRoles,
      visibleUserIds,
      updatedAt: serverTimestamp(),
    }));
    this.docAudit.log(this.templatePath(id), 'permission_change', {
      detail: visibleTo === 'all' ? 'Visible para todos' : 'Visibilidad restringida',
    });
    this.templates.update(list =>
      list.map(t => (t.id === id ? { ...t, visibleTo, visibleRoles, visibleUserIds } : t))
    );
  }

  /** Soft delete: la plantilla y sus blobs (fuente/HTML) se conservan. */
  async deleteTemplate(id: string): Promise<void> {
    await updateDoc(doc(this.templatesRef, id), stripUndefinedDeep({
      deleted: true,
      deletedAt: serverTimestamp(),
      deletedBy: this.auth.currentUser?.uid ?? '',
      deletedByNombre: this.permissionService.currentMember()?.nombre ?? '',
    }));
    this.docAudit.log(this.templatePath(id), 'delete');
    this.templates.update(list => list.filter(t => t.id !== id));
  }

  private async maybeOffloadHtml(
    id: string,
    html: string
  ): Promise<{ html: string; htmlStoragePath?: string }> {
    if (new Blob([html]).size <= MAX_INLINE_HTML_BYTES) {
      return { html };
    }
    const htmlStoragePath = `companies/${this.companyId}/docTemplates/${id}/template.html`;
    await uploadString(ref(this.storage, htmlStoragePath), html, 'raw', { contentType: 'text/html' });
    return { html: '', htmlStoragePath };
  }
}
