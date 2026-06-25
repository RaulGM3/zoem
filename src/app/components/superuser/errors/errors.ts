import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { AlertTriangle, ChevronDown, ChevronRight, LucideAngularModule, RefreshCw } from 'lucide-angular';
import { ErrorService } from '../../../core/services/error.service';
import type { AppError } from '../../../interfaces/app-error.interface';
import { Timestamp } from '@angular/fire/firestore';

@Component({
  selector: 'app-errors',
  imports: [LucideAngularModule],
  templateUrl: './errors.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ErrorsComponent implements OnInit {
  readonly AlertTriangleIcon = AlertTriangle;
  readonly RefreshIcon = RefreshCw;
  readonly ChevronDownIcon = ChevronDown;
  readonly ChevronRightIcon = ChevronRight;

  private readonly errorService = inject(ErrorService);

  readonly errors = signal<AppError[]>([]);
  readonly isLoading = signal(false);
  readonly expandedId = signal<string | null>(null);

  readonly total = computed(() => this.errors().length);

  async ngOnInit(): Promise<void> {
    await this.load();
  }

  async load(): Promise<void> {
    this.isLoading.set(true);
    try {
      const data = await this.errorService.loadErrors();
      this.errors.set(data);
    } finally {
      this.isLoading.set(false);
    }
  }

  toggleExpand(id: string): void {
    this.expandedId.update((current) => (current === id ? null : id));
  }

  formatDate(ts: Timestamp | undefined): string {
    if (!ts) return '—';
    return ts.toDate().toLocaleString('es-ES', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  }
}
