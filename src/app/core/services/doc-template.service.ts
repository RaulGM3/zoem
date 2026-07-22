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
import { ErrorService } from './error.service';
import { PermissionService } from './permission.service';
import { stripUndefinedDeep } from '../firebase/sanitize';
import { appendVersion, currentVersion, isVisibleDoc, type VersionedFile } from '../docs/doc-versioning';
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
  private readonly errorService = inject(ErrorService);
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
    // Soft delete: una plantilla eliminada se trata como no encontrada para
    // los llamadores normales (misma lógica que loadTemplates()/isVisibleDoc).
    if (!isVisibleDoc(template)) return null;
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
    let html = input.html;
    let htmlStoragePath: string | undefined;

    try {
      if (input.sourceFile) {
        sourceStoragePath = `companies/${companyId}/docTemplates/${docRef.id}/source/${Date.now()}_${input.sourceFile.name}`;
        const sourceRef = ref(this.storage, sourceStoragePath);
        await uploadBytes(sourceRef, input.sourceFile);
        sourceDownloadUrl = await getDownloadURL(sourceRef);
      }

      ({ html, htmlStoragePath } = await this.maybeOffloadHtml(docRef.id, input.html));

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
    } catch (err) {
      // El Firestore write falló pero el/los blob(s) ya se subieron a Storage.
      // NUNCA llamamos deleteObject() aquí: storage.rules restringe `delete` a
      // isSuper(), así que para cualquier usuario real fallaría con
      // permission-denied y quedaría silenciado. En su lugar dejamos
      // constancia clara de que hay blobs huérfanos que requieren limpieza
      // manual/admin (Cloud Function), y relanzamos el error original para
      // que el ToastService del llamador siga mostrando el error.
      const orphanStoragePaths = [sourceStoragePath, htmlStoragePath].filter(
        (path): path is string => !!path
      );
      if (orphanStoragePaths.length) {
        console.error(
          `[DocTemplateService] createTemplate: setDoc falló y dejó blob(s) huérfano(s) en Storage que requieren limpieza manual/admin: ${orphanStoragePaths.join(', ')}`,
          err
        );
        void this.errorService.log(err, {
          serviceName: 'DocTemplateService',
          methodName: 'createTemplate',
          params: { orphanStoragePaths },
        });
      }
      throw err;
    }

    this.docAudit.log(this.templatePath(docRef.id), 'create', { detail: input.name });

    await this.loadTemplates();
    return docRef.id;
  }

  async updateTemplate(
    id: string,
    data: Partial<Omit<DocTemplate, 'id' | 'companyId' | 'createdAt' | 'updatedAt'>>
  ): Promise<void> {
    let updateData: Record<string, unknown> = { ...data };
    let versionBump: { version: number; versions: DocTemplate['versions'] } | undefined;
    const orphanStoragePaths: string[] = [];

    try {
      if (typeof data.html === 'string') {
        const current = await this.getTemplate(id);
        // Versionado: "nada se sobreescribe" — igual que CasoDocFile, archivamos
        // tanto el contenido saliente como el entrante en Storage antes de tocar
        // el doc, y hacemos crecer `versions` vía appendVersion().
        if (current && current.html !== data.html) {
          const basePath = `companies/${this.companyId}/docTemplates/${id}/versions`;
          const oldVersionNumber = currentVersion(current);

          let currentForVersioning: VersionedFile = current;
          if (!current.versions || current.versions.length === 0) {
            const oldPath = `${basePath}/v${oldVersionNumber}.html`;
            await uploadString(ref(this.storage, oldPath), current.html, 'raw', { contentType: 'text/html' });
            orphanStoragePaths.push(oldPath);
            const oldDownloadUrl = await getDownloadURL(ref(this.storage, oldPath));
            currentForVersioning = {
              ...current,
              storagePath: oldPath,
              downloadUrl: oldDownloadUrl,
              mimeType: 'text/html',
              sizeBytes: new Blob([current.html]).size,
            };
          }

          const newPath = `${basePath}/v${oldVersionNumber + 1}.html`;
          await uploadString(ref(this.storage, newPath), data.html, 'raw', { contentType: 'text/html' });
          orphanStoragePaths.push(newPath);
          const newDownloadUrl = await getDownloadURL(ref(this.storage, newPath));

          const versionPatch = appendVersion(currentForVersioning, {
            name: data.name ?? current.name,
            storagePath: newPath,
            downloadUrl: newDownloadUrl,
            mimeType: 'text/html',
            sizeBytes: new Blob([data.html]).size,
          });
          versionBump = { version: versionPatch.version, versions: versionPatch.versions };
          updateData = { ...updateData, ...versionBump };
        }

        const { html, htmlStoragePath } = await this.maybeOffloadHtml(id, data.html);
        if (htmlStoragePath) orphanStoragePaths.push(htmlStoragePath);
        updateData = { ...updateData, html, htmlStoragePath: htmlStoragePath ?? null };
      }

      await updateDoc(doc(this.templatesRef, id), stripUndefinedDeep({
        ...updateData,
        updatedAt: serverTimestamp(),
      }));
    } catch (err) {
      // Igual que en createTemplate(): si el updateDoc falla después de subir
      // snapshots de versión a Storage, esos blobs quedan huérfanos. NUNCA
      // llamamos deleteObject() (storage.rules restringe `delete` a isSuper()),
      // solo dejamos constancia para limpieza manual/admin y relanzamos.
      if (orphanStoragePaths.length) {
        console.error(
          `[DocTemplateService] updateTemplate: falló y dejó blob(s) huérfano(s) en Storage que requieren limpieza manual/admin: ${orphanStoragePaths.join(', ')}`,
          err
        );
        void this.errorService.log(err, {
          serviceName: 'DocTemplateService',
          methodName: 'updateTemplate',
          params: { id, orphanStoragePaths },
        });
      }
      throw err;
    }

    this.docAudit.log(this.templatePath(id), 'update', versionBump ? { version: versionBump.version } : undefined);
    this.templates.update(list => list.map(t => (t.id === id ? { ...t, ...data, ...versionBump } : t)));
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
