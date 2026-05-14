import { Component, signal, computed } from '@angular/core';
import {
  LucideAngularModule,
  LucideIconData,
  FileText,
  Search,
  Plus,
  Download,
  Eye,
  Edit,
  Trash2,
  File,
  FileCheck,
} from 'lucide-angular';
import { DOCUMENTS } from '../../data/dummy-data';

@Component({
  selector: 'app-documentos',
  standalone: true,
  imports: [LucideAngularModule],
  templateUrl: './documentos.html',
})
export class DocumentosComponent {
  readonly FileTextIcon = FileText;
  readonly SearchIcon = Search;
  readonly PlusIcon = Plus;
  readonly DownloadIcon = Download;
  readonly EyeIcon = Eye;
  readonly EditIcon = Edit;
  readonly Trash2Icon = Trash2;
  readonly FileIcon = File;
  readonly FileCheckIcon = FileCheck;

  documents = DOCUMENTS;
  search = signal('');
  filterStatus = signal('');

  revisionCount = computed(() => this.documents.filter((d) => d.status === 'revision').length);
  firmadoCount = computed(() => this.documents.filter((d) => d.status === 'firmado').length);
  borradorCount = computed(() => this.documents.filter((d) => d.status === 'borrador').length);

  filtered = computed(() => {
    const q = this.search().toLowerCase();
    const s = this.filterStatus();
    return this.documents.filter((d) => {
      const matchQ = !q || d.name.toLowerCase().includes(q) || d.client.toLowerCase().includes(q);
      const matchS = !s || d.status === s;
      return matchQ && matchS;
    });
  });

  getStatusClass(status: string): string {
    const map: Record<string, string> = {
      borrador: 'bg-slate-100 text-slate-500',
      revision: 'bg-amber-100 text-amber-700',
      firmado: 'bg-green-100 text-green-700',
      archivado: 'bg-slate-100 text-slate-400',
    };
    return map[status] || 'bg-slate-100 text-slate-600';
  }

  getStatusLabel(status: string): string {
    const map: Record<string, string> = {
      borrador: 'Borrador',
      revision: 'En revisión',
      firmado: 'Firmado',
      archivado: 'Archivado',
    };
    return map[status] || status;
  }

  getTypeIcon(type: string): LucideIconData {
    const signed = ['Contrato', 'NDA', 'Legal'];
    return signed.includes(type) ? FileCheck : FileText;
  }
}
