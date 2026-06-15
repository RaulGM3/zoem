import { inject, Injectable, signal } from '@angular/core';
import {
  Firestore,
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
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
  deleteObject,
} from '@angular/fire/storage';
import { Auth } from '@angular/fire/auth';
import { CompanyService } from './company.service';
import { DocTemplate, TemplateVariable } from '../../interfaces';

export interface DocTemplateCreate {
  name: string;
  description?: string;
  html: string;
  variables: TemplateVariable[];
  sourceFile?: File;
}

/** Margen bajo el límite de 1MB por documento de Firestore */
const MAX_INLINE_HTML_BYTES = 900_000;

function stripUndefined(obj: unknown): unknown {
  if (Array.isArray(obj)) return obj.map(stripUndefined);
  if (obj !== null && typeof obj === 'object') {
    return Object.fromEntries(
      Object.entries(obj as Record<string, unknown>)
        .filter(([, v]) => v !== undefined)
        .map(([k, v]) => [k, stripUndefined(v)])
    );
  }
  return obj;
}

@Injectable({ providedIn: 'root' })
export class DocTemplateService {
  private readonly firestore = inject(Firestore);
  private readonly storage = inject(Storage);
  private readonly auth = inject(Auth);
  private readonly companyService = inject(CompanyService);

  readonly templates = signal<DocTemplate[]>([]);
  readonly loading = signal(false);

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
      this.templates.set(snapshot.docs.map(d => ({ id: d.id, ...d.data() }) as DocTemplate));
    } catch {
      // No active company or Firestore error
    } finally {
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

    await setDoc(docRef, stripUndefined({
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
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    }) as object);

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
    await updateDoc(doc(this.templatesRef, id), {
      ...(stripUndefined(updateData) as Record<string, unknown>),
      updatedAt: serverTimestamp(),
    });
    this.templates.update(list => list.map(t => (t.id === id ? { ...t, ...data } : t)));
  }

  async deleteTemplate(id: string): Promise<void> {
    const template = this.templates().find(t => t.id === id)
      ?? ({ id, ...(await getDoc(doc(this.templatesRef, id))).data() } as DocTemplate);

    for (const path of [template.sourceStoragePath, template.htmlStoragePath]) {
      if (!path) continue;
      try {
        await deleteObject(ref(this.storage, path));
      } catch {
        // El objeto puede no existir en Storage — continuar
      }
    }

    await deleteDoc(doc(this.templatesRef, id));
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
