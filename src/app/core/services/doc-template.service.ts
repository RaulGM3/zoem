import { inject, Injectable, signal } from '@angular/core';
import {
  Firestore,
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  runTransaction,
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

  /**
   * @param includeDeleted Si es `true`, no filtra plantillas soft-deleted
   * EN EL RESULTADO client-side. Los llamadores normales (browse/detalle vía
   * navegación directa) deben dejarlo en `false` (soft delete = "no
   * encontrada"). Los llamadores que regeneran/muestran un documento YA
   * anclado a un caso (p.ej. caso-doc-generador) pasan `true`.
   * NOTA (Judgment Day round 2): las Firestore rules del `allow get` SÍ
   * filtran por `resource.data.deleted != true` (se restauró tras detectarse
   * que quitarlo dejaba leer el HTML completo de cualquier plantilla
   * "eliminada" a cualquier miembro, sin verificar server-side que la
   * lectura viniera de un caso realmente anclado). Como consecuencia,
   * `includeDeleted: true` YA NO tiene efecto real para una plantilla que se
   * eliminó DESPUÉS de anclarse: el `getDoc()` de abajo falla con
   * `permission-denied` antes de llegar al filtro client-side. Los llamadores
   * de este flag deben capturar y tratar `permission-denied` como caso
   * esperado (ver caso-doc-generador.ts). Arreglo definitivo pendiente:
   * un doc de anclaje verificable server-side (p.ej.
   * `docTemplateAnchors/{templateId}`) o una Cloud Function callable.
   */
  async getTemplate(id: string, includeDeleted = false): Promise<DocTemplate | null> {
    const snap = await getDoc(doc(this.templatesRef, id));
    if (!snap.exists()) return null;
    const template = { id: snap.id, ...snap.data() } as DocTemplate;
    // Soft delete: una plantilla eliminada se trata como no encontrada para
    // los llamadores normales (misma lógica que loadTemplates()/isVisibleDoc).
    if (!includeDeleted && !isVisibleDoc(template)) return null;
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
      this.reportOrphans('createTemplate', orphanStoragePaths, err);
    }

    this.docAudit.log(this.templatePath(docRef.id), 'create', { detail: input.name });

    await this.loadTemplates();
    return docRef.id;
  }

  /**
   * @param currentTemplate Template actual YA CARGADO en memoria por el
   * llamador (p.ej. el signal `template()` del componente). Si se pasa, se
   * usa en vez de releer con `getTemplate(id)` — evita un getDoc/Storage
   * fetch redundante en ediciones de un solo campo (promoteToVariable,
   * demoteToStatic, etc.) que se disparan repetidamente en un flujo normal
   * de edición. Si se omite, se comporta como antes (fetch interno).
   */
  async updateTemplate(
    id: string,
    data: Partial<Omit<DocTemplate, 'id' | 'companyId' | 'createdAt' | 'updatedAt'>>,
    currentTemplate?: DocTemplate
  ): Promise<void> {
    let updateData: Record<string, unknown> = { ...data };
    let versionBump: { version: number; versions: DocTemplate['versions'] } | undefined;
    const orphanStoragePaths: string[] = [];

    try {
      if (typeof data.html === 'string') {
        const html = data.html; // narrowed a `string` para las closures de abajo
        const current = currentTemplate !== undefined ? currentTemplate : await this.getTemplate(id);

        const offloaded = await this.maybeOffloadHtml(id, html);
        if (offloaded.htmlStoragePath) orphanStoragePaths.push(offloaded.htmlStoragePath);
        updateData = { ...updateData, html: offloaded.html, htmlStoragePath: offloaded.htmlStoragePath ?? null };

        // Versionado: "nada se sobreescribe" — igual que CasoDocFile, archivamos
        // tanto el contenido saliente como el entrante en Storage antes de tocar
        // el doc, y hacemos crecer `versions` vía appendVersion().
        if (current && current.html !== html) {
          const basePath = `companies/${this.companyId}/docTemplates/${id}/versions`;
          // Leemos version/versions FRESCOS justo antes de construir las rutas
          // de Storage, en vez de derivarlos de `current` (que puede ser el
          // `currentTemplate` pasado por el llamador — potencialmente un
          // snapshot bastante viejo del signal del componente — o un
          // getTemplate() ya no-tan-reciente de arriba). Bajo una carrera
          // (dos ediciones casi simultáneas sobre la misma plantilla
          // compartida), esto reduce la ventana en la que el número horneado
          // en el nombre de archivo de Storage puede divergir del que
          // finalmente persiste la transacción de abajo. No la elimina del
          // todo: Storage no es transaccional con Firestore, así que sigue
          // existiendo un hueco (más pequeño) entre esta lectura y la
          // lectura fresca de la transacción — ver comentario ahí.
          const freshSnapForPath = await getDoc(doc(this.templatesRef, id));
          const freshDataForPath = freshSnapForPath.data() as DocTemplate | undefined;
          // `versions` FRESCO (no el `current` pasado por el llamador, que
          // puede ser un snapshot en memoria desactualizado) decide si esto
          // es la primera versión: decidirlo contra `current.versions` podía
          // archivar contenido viejo equivocado (o dejar de archivarlo)
          // bajo ediciones concurrentes. Usa la misma fuente fresca que
          // `oldVersionNumber` para que ambas decisiones estén sincronizadas.
          const freshVersionsForPath = freshDataForPath?.versions ?? current.versions;
          const oldVersionNumber = currentVersion({
            ...current,
            version: freshDataForPath?.version ?? current.version,
            versions: freshVersionsForPath,
          });
          // Sufijo único por intento (timestamp + random): dos ediciones casi
          // simultáneas pueden calcular el mismo `oldVersionNumber` (lectura no
          // transaccional, ver arriba), pero ya NUNCA colisionan sobre el mismo
          // objeto de Storage — cada upload va a su propio path.
          const uniqueSuffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

          let archivedOld: { storagePath: string; downloadUrl: string } | undefined;
          if (!freshVersionsForPath || freshVersionsForPath.length === 0) {
            const oldPath = `${basePath}/v${oldVersionNumber}-${uniqueSuffix}.html`;
            await uploadString(ref(this.storage, oldPath), current.html, 'raw', { contentType: 'text/html' });
            orphanStoragePaths.push(oldPath);
            const oldDownloadUrl = await getDownloadURL(ref(this.storage, oldPath));
            archivedOld = { storagePath: oldPath, downloadUrl: oldDownloadUrl };
          }

          const newPath = `${basePath}/v${oldVersionNumber + 1}-${uniqueSuffix}.html`;
          await uploadString(ref(this.storage, newPath), html, 'raw', { contentType: 'text/html' });
          orphanStoragePaths.push(newPath);
          const newDownloadUrl = await getDownloadURL(ref(this.storage, newPath));

          // El número de versión y el array `versions` se leen y escriben de
          // forma ATÓMICA dentro de una transacción de Firestore: si dos
          // ediciones casi simultáneas corren esto en paralelo, Firestore
          // reintenta automáticamente la que pierde la carrera con una
          // lectura fresca, así que ninguna de las dos entries de `versions`
          // se pierde (antes eran un getDoc suelto + updateDoc separado, sin
          // ninguna garantía de atomicidad entre ambos).
          // Si la lectura transaccional (más fresca que `freshDataForPath`)
          // contradice la decisión de archivar tomada arriba — otra edición
          // concurrente ya añadió `versions` en el hueco entre ambas
          // lecturas — `archivedOld` queda sin usar: el blob que se subió a
          // `oldPath` se vuelve huérfano en un camino de ÉXITO (la tx no
          // falla), así que NO pasa por el catch/reportOrphans de abajo. Se
          // marca aquí para loguearlo explícitamente después de resolver la
          // transacción, sin relanzar (el guardado en sí fue correcto).
          let archivedOldUnused = false;
          versionBump = await runTransaction(this.firestore, async (tx) => {
            const freshSnap = await tx.get(doc(this.templatesRef, id));
            const freshData = freshSnap.data() as DocTemplate | undefined;

            let currentForVersioning: VersionedFile = {
              ...current,
              version: freshData?.version ?? current.version,
              versions: freshData?.versions ?? current.versions,
            };
            const isStillFirstVersion = !currentForVersioning.versions || currentForVersioning.versions.length === 0;
            if (archivedOld && isStillFirstVersion) {
              currentForVersioning = {
                ...currentForVersioning,
                storagePath: archivedOld.storagePath,
                downloadUrl: archivedOld.downloadUrl,
                mimeType: 'text/html',
                sizeBytes: new Blob([current.html]).size,
              };
            }
            archivedOldUnused = !!archivedOld && !isStillFirstVersion;

            const versionPatch = appendVersion(currentForVersioning, {
              name: data.name ?? current.name,
              storagePath: newPath,
              downloadUrl: newDownloadUrl,
              mimeType: 'text/html',
              sizeBytes: new Blob([html]).size,
            });
            const bump = { version: versionPatch.version, versions: versionPatch.versions };
            tx.update(doc(this.templatesRef, id), stripUndefinedDeep({
              ...updateData,
              ...bump,
              updatedAt: serverTimestamp(),
            }));
            return bump;
          });
          updateData = { ...updateData, ...versionBump };

          if (archivedOldUnused && archivedOld) {
            console.error(
              `[DocTemplateService] updateTemplate: carrera detectada — el blob archivado en "${archivedOld.storagePath}" quedó huérfano (otra edición concurrente ya había versionado el documento) y requiere limpieza manual/admin.`
            );
            void this.errorService.log(new Error('Orphaned archived-old blob due to concurrent version race'), {
              serviceName: 'DocTemplateService',
              methodName: 'updateTemplate',
              params: { id, orphanStoragePaths: [archivedOld.storagePath] },
            });
          }
        }
      }

      // Si hubo bump de versión, la transacción de arriba ya hizo el único
      // write atómico (incluye html/htmlStoragePath/version/versions). Si no,
      // hacemos el updateDoc normal aquí.
      if (!versionBump) {
        await updateDoc(doc(this.templatesRef, id), stripUndefinedDeep({
          ...updateData,
          updatedAt: serverTimestamp(),
        }));
      }
    } catch (err) {
      // Igual que en createTemplate(): si el write falla después de subir
      // snapshots de versión a Storage, esos blobs quedan huérfanos. NUNCA
      // llamamos deleteObject() (storage.rules restringe `delete` a isSuper()),
      // solo dejamos constancia para limpieza manual/admin y relanzamos.
      this.reportOrphans('updateTemplate', orphanStoragePaths, err, { id });
    }

    this.docAudit.log(this.templatePath(id), 'update', versionBump ? { version: versionBump.version } : undefined);
    this.templates.update(list => list.map(t => (t.id === id ? { ...t, ...data, ...versionBump } : t)));
  }

  /**
   * Registra (console.error + ErrorService) blob(s) huérfano(s) en Storage
   * dejados por un write de Firestore que falló, y relanza `err`. Usado por
   * createTemplate() y updateTemplate() — ambos suben a Storage antes de
   * escribir en Firestore y no pueden hacer rollback del blob (storage.rules
   * restringe `delete` a isSuper()).
   */
  private reportOrphans(
    method: string,
    orphanStoragePaths: string[],
    err: unknown,
    extraParams?: Record<string, unknown>
  ): never {
    if (orphanStoragePaths.length) {
      console.error(
        `[DocTemplateService] ${method}: falló y dejó blob(s) huérfano(s) en Storage que requieren limpieza manual/admin: ${orphanStoragePaths.join(', ')}`,
        err
      );
      void this.errorService.log(err, {
        serviceName: 'DocTemplateService',
        methodName: method,
        params: { ...extraParams, orphanStoragePaths },
      });
    }
    throw err;
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
