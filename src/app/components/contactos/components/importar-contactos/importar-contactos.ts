import {
  Component, signal, computed, inject,
  ChangeDetectionStrategy, input, output,
} from '@angular/core';
import {
  LucideAngularModule,
  Upload, X, Check, LoaderCircle, AlertTriangle,
  Users, ChevronLeft, FileSpreadsheet,
} from 'lucide-angular';
import { Timestamp } from '@angular/fire/firestore';
import { ContactService } from '../../../../core/services/contact.service';
import { UsersService } from '../../../../core/services/users';
import { ToastService } from '../../../../core/services/toast.service';
import {
  PersonaFisica, PersonaJuridica, ContactStatus, CanalEntrada,
  CONTACT_STATUS_LABELS, CANAL_ENTRADA_LABELS,
} from '../../../../interfaces';

type DestField =
  | 'nombre' | 'apellidos' | 'razonSocial'
  | 'email' | 'mobile' | 'nif'
  | 'status' | 'asunto' | 'notes' | 'canalEntrada' | 'assignedTo'
  | 'calle' | 'codigoPostal' | 'municipio' | 'provincia'
  | 'sectorProfesion' | 'createdAt';

type ContactPayload =
  | Omit<PersonaFisica, 'id' | 'companyId' | 'updatedAt'>
  | Omit<PersonaJuridica, 'id' | 'companyId' | 'updatedAt'>;

const VALID_STATUSES = new Set<string>(Object.keys(CONTACT_STATUS_LABELS));
const VALID_CANALES = new Set<string>(Object.keys(CANAL_ENTRADA_LABELS));

@Component({
  selector: 'app-importar-contactos',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LucideAngularModule],
  templateUrl: './importar-contactos.html',
})
export class ImportarContactosComponent {
  readonly UploadIcon = Upload;
  readonly XIcon = X;
  readonly CheckIcon = Check;
  readonly LoaderIcon = LoaderCircle;
  readonly AlertIcon = AlertTriangle;
  readonly UsersIcon = Users;
  readonly ChevronLeftIcon = ChevronLeft;
  readonly FileIcon = FileSpreadsheet;

  readonly visible = input.required<boolean>();
  readonly closed = output<void>();

  private readonly contactService = inject(ContactService);
  readonly usersService = inject(UsersService);
  private readonly toast = inject(ToastService);

  step = signal<1 | 2 | 3 | 4>(1);
  rawHeaders = signal<string[]>([]);
  rawRows = signal<string[][]>([]);
  fileName = signal('');
  // Clave = nombre de la columna en el Excel · Valor = campo de destino en Zoem (o '' = no importar)
  columnMap = signal<Record<string, DestField | ''>>({});
  userMap = signal<Record<string, string>>({});
  importing = signal(false);
  importProgress = signal({ done: 0, total: 0 });

  readonly stepLabels = ['Subir archivo', 'Columnas', 'Usuarios', 'Importar'];

  // requiredFor: 'canal' → se necesita al menos uno de email/mobile
  readonly fieldDefs: Array<{
    key: DestField;
    label: string;
    tag?: string;
    requiredFor?: 'canal';
  }> = [
    { key: 'nombre',          label: 'Nombre',           tag: 'Persona física'   },
    { key: 'apellidos',       label: 'Apellidos',         tag: 'Persona física'   },
    { key: 'razonSocial',     label: 'Razón Social',      tag: 'Persona jurídica' },
    { key: 'email',           label: 'Email',             requiredFor: 'canal'    },
    { key: 'mobile',          label: 'Teléfono móvil',    requiredFor: 'canal'    },
    { key: 'nif',             label: 'NIF / CIF' },
    { key: 'status',          label: 'Estado' },
    { key: 'asunto',          label: 'Asunto' },
    { key: 'notes',           label: 'Notas' },
    { key: 'canalEntrada',    label: 'Canal de entrada' },
    { key: 'assignedTo',      label: 'Responsable (nombre)' },
    { key: 'calle',           label: 'Calle',             tag: 'Dirección' },
    { key: 'codigoPostal',    label: 'Código Postal',     tag: 'Dirección' },
    { key: 'municipio',       label: 'Municipio',         tag: 'Dirección' },
    { key: 'provincia',       label: 'Provincia',         tag: 'Dirección' },
    { key: 'sectorProfesion', label: 'Sector / Profesión' },
    { key: 'createdAt',       label: 'Fecha de alta' },
  ];

  readonly previewRows = computed(() => this.rawRows().slice(0, 5));

  readonly uniqueAssignedNames = computed(() => {
    const assignedToCol = Object.entries(this.columnMap()).find(([, v]) => v === 'assignedTo')?.[0];
    if (!assignedToCol) return [];
    const idx = this.rawHeaders().indexOf(assignedToCol);
    if (idx < 0) return [];
    return [...new Set(this.rawRows().map(r => (r[idx] ?? '').trim()).filter(Boolean))];
  });

  readonly step3Needed = computed(() => this.uniqueAssignedNames().length > 0);

  readonly step2Valid = computed(() => {
    const vals = Object.values(this.columnMap()) as (DestField | '')[];
    const hasChannel = vals.includes('email') || vals.includes('mobile');
    const hasFisica = vals.includes('nombre') && vals.includes('apellidos');
    const hasJuridica = vals.includes('razonSocial');
    return hasChannel && (hasFisica || hasJuridica);
  });

  readonly canNext = computed(() => {
    if (this.step() === 1) return this.rawRows().length > 0;
    if (this.step() === 2) return this.step2Valid();
    if (this.step() === 3) return true;
    return false;
  });

  readonly validPayloads = computed(() =>
    this._buildPayloads().filter((p): p is ContactPayload => p !== null)
  );

  readonly previewPayloads = computed(() => this.validPayloads().slice(0, 10));
  readonly skippedCount = computed(() => this.rawRows().length - this.validPayloads().length);

  async onFileChange(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    this.fileName.set(file.name);
    await this._parseBuffer(await file.arrayBuffer());
  }

  async onDrop(event: DragEvent): Promise<void> {
    event.preventDefault();
    const file = event.dataTransfer?.files?.[0];
    if (!file) return;
    this.fileName.set(file.name);
    await this._parseBuffer(await file.arrayBuffer());
  }

  private async _parseBuffer(buffer: ArrayBuffer): Promise<void> {
    const XLSX = await import('xlsx');
    const wb = XLSX.read(buffer, { type: 'array', cellDates: true });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const data = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: '' });

    if (!Array.isArray(data) || data.length < 2) {
      this.rawHeaders.set([]);
      this.rawRows.set([]);
      return;
    }

    const [headers, ...rows] = data as unknown[][];
    const cellToString = (c: unknown): string => {
      if (c instanceof Date) {
        if (isNaN(c.getTime())) return '';
        const y = c.getFullYear();
        const m = String(c.getMonth() + 1).padStart(2, '0');
        const d = String(c.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
      }
      return String(c ?? '');
    };
    this.rawHeaders.set((headers as unknown[]).map(h => cellToString(h).trim()).filter(Boolean));
    this.rawRows.set(
      rows
        .filter(r => r.some(c => cellToString(c).trim()))
        .map(r => r.map(c => cellToString(c)))
    );
    this.columnMap.set({});
    this.userMap.set({});
  }

  setColumnMap(excelCol: string, destField: string): void {
    this.columnMap.update(cm => {
      const next: Record<string, DestField | ''> = {};
      for (const [k, v] of Object.entries(cm)) {
        if (k === excelCol) continue;               // será re-asignado abajo
        if (destField && v === destField) continue; // libera si ya estaba asignado a otro
        next[k] = v as DestField | '';
      }
      if (destField) next[excelCol] = destField as DestField;
      return next;
    });
  }

  setUserMap(excelName: string, userId: string): void {
    this.userMap.update(m => ({ ...m, [excelName]: userId }));
  }

  nextStep(): void {
    const s = this.step();
    if (s === 1 && this.rawRows().length > 0) { this.step.set(2); return; }
    if (s === 2 && this.step2Valid()) {
      this.step.set(this.step3Needed() ? 3 : 4);
      return;
    }
    if (s === 3) { this.step.set(4); return; }
  }

  prevStep(): void {
    const s = this.step();
    if (s === 2) { this.step.set(1); return; }
    if (s === 3) { this.step.set(2); return; }
    if (s === 4) { this.step.set(this.step3Needed() ? 3 : 2); return; }
  }

  isRequired(requiredFor?: 'canal'): boolean {
    return requiredFor === 'canal';
  }

  getAssigneeName(userId?: string): string {
    if (!userId) return '—';
    const m = this.usersService.members().find(x => x.userId === userId);
    return m ? `${m.nombre}${m.apellido ? ' ' + m.apellido : ''}` : userId;
  }

  getPreviewName(p: ContactPayload): string {
    return p.type === 'persona_fisica'
      ? `${p.nombre} ${p.apellidos}`
      : p.razonSocial;
  }

  async runImport(): Promise<void> {
    if (this.importing()) return;
    const payloads = this.validPayloads();
    this.importProgress.set({ done: 0, total: payloads.length });

    await this.toast.run(
      async () => {
        this.importing.set(true);
        try {
          for (const payload of payloads) {
            await this.contactService.createContact(payload);
            this.importProgress.update(p => ({ ...p, done: p.done + 1 }));
          }
        } finally {
          this.importing.set(false);
        }
      },
      {
        successMessage: `${payloads.length} contacto${payloads.length !== 1 ? 's' : ''} importado${payloads.length !== 1 ? 's' : ''} correctamente`,
        errorTitle: 'Error durante la importación',
        onSuccess: () => this.close(),
      },
    );
  }

  close(): void {
    this.step.set(1);
    this.rawHeaders.set([]);
    this.rawRows.set([]);
    this.fileName.set('');
    this.columnMap.set({});
    this.userMap.set({});
    this.importing.set(false);
    this.importProgress.set({ done: 0, total: 0 });
    this.closed.emit();
  }

  private _parseDateToTimestamp(raw: string): Timestamp | null {
    const s = raw.trim();
    if (!s) return null;

    // ISO: yyyy-mm-dd o yyyy/mm/dd (ej: 2020-03-15)
    const isoMatch = s.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);
    if (isoMatch) {
      const d = new Date(+isoMatch[1], +isoMatch[2] - 1, +isoMatch[3]);
      return isNaN(d.getTime()) ? null : Timestamp.fromDate(d);
    }

    // Español: dd/mm/yyyy, dd-mm-yyyy, dd/mm/yy, dd-mm-yy (ej: 15/03/2020 o 15-03-20)
    const esMatch = s.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{2,4})$/);
    if (esMatch) {
      let year = +esMatch[3];
      if (year < 100) year += year >= 50 ? 1900 : 2000;
      const d = new Date(year, +esMatch[2] - 1, +esMatch[1]);
      return isNaN(d.getTime()) ? null : Timestamp.fromDate(d);
    }

    // Fallback: deja que el motor de JS intente parsear (ej: "March 15, 2020")
    const d = new Date(s);
    if (isNaN(d.getTime())) return null;
    const year = d.getFullYear();
    if (year < 1900 || year > 2200) return null;
    return Timestamp.fromDate(d);
  }

  private _buildPayloads(): (ContactPayload | null)[] {
    const headers = this.rawHeaders();
    const rows = this.rawRows();
    const cm = this.columnMap();
    const umap = this.userMap();

    // columnMap es { excelCol → destField } — buscamos el Excel col asignado a un campo
    const get = (row: string[], field: DestField): string => {
      const col = Object.entries(cm).find(([, v]) => v === field)?.[0];
      if (!col) return '';
      const idx = headers.indexOf(col);
      return idx >= 0 ? (row[idx] ?? '').trim() : '';
    };

    const resolveType = (row: string[]): 'persona_fisica' | 'persona_juridica' | null => {
      const nombre = get(row, 'nombre');
      const apellidos = get(row, 'apellidos');
      if (nombre && apellidos) return 'persona_fisica';
      const razonSocial = get(row, 'razonSocial');
      if (razonSocial) return 'persona_juridica';
      return null;
    };

    return rows.map(row => {
      const email = get(row, 'email');
      const mobile = get(row, 'mobile');
      if (!email && !mobile) return null;

      const createdAt = this._parseDateToTimestamp(get(row, 'createdAt')) ?? undefined;
      const type = resolveType(row);
      if (!type) return null;
      const assignedToName = get(row, 'assignedTo');
      const assignedTo = assignedToName ? umap[assignedToName] || undefined : undefined;

      const rawStatus = get(row, 'status');
      const status = (VALID_STATUSES.has(rawStatus) ? rawStatus : 'activo') as ContactStatus;
      const rawCanal = get(row, 'canalEntrada');
      const canalEntrada = (VALID_CANALES.has(rawCanal) ? rawCanal : undefined) as CanalEntrada | undefined;

      const base = {
        email,
        mobile: mobile || undefined,
        status,
        notes: get(row, 'notes') || undefined,
        asunto: get(row, 'asunto') || undefined,
        canalEntrada,
        assignedTo,
        createdAt,
      };

      const direccion = {
        calle: get(row, 'calle') || '',
        codigoPostal: get(row, 'codigoPostal') || '',
        municipio: get(row, 'municipio') || '',
        provincia: get(row, 'provincia') || '',
        pais: 'ES',
      };

      if (type === 'persona_fisica') {
        const nombre = get(row, 'nombre');
        const apellidos = get(row, 'apellidos');
        if (!nombre || !apellidos) return null;
        const payload: Omit<PersonaFisica, 'id' | 'companyId' | 'createdAt' | 'updatedAt'> = {
          type: 'persona_fisica',
          ...base,
          nombre,
          apellidos,
          nifType: 'dni',
          nif: get(row, 'nif') || '',
          profesion: get(row, 'sectorProfesion') || undefined,
          direccion,
        };
        return payload;
      } else {
        const razonSocial = get(row, 'razonSocial');
        if (!razonSocial) return null;
        const payload: Omit<PersonaJuridica, 'id' | 'companyId' | 'createdAt' | 'updatedAt'> = {
          type: 'persona_juridica',
          ...base,
          razonSocial,
          cifType: 'cif',
          cif: get(row, 'nif') || '',
          sectorActividad: get(row, 'sectorProfesion') || undefined,
          direccionSocial: direccion,
        };
        return payload;
      }
    });
  }
}
