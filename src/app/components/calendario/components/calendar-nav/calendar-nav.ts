import {
  Component, ChangeDetectionStrategy,
  input, output, viewChild, ElementRef,
} from '@angular/core';
import { LucideAngularModule, ChevronLeft, ChevronRight } from 'lucide-angular';
import type { WeekDay, ViewMode } from '../../calendario.types';

@Component({
  selector: 'app-calendar-nav',
  imports: [LucideAngularModule],
  templateUrl: './calendar-nav.html',
  styles: [`.scroll-hide{scrollbar-width:none;-ms-overflow-style:none}.scroll-hide::-webkit-scrollbar{display:none}`],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CalendarNavComponent {
  readonly weekDays = input.required<WeekDay[]>();
  readonly monthDays = input.required<WeekDay[]>();
  readonly viewMode = input.required<ViewMode>();
  readonly weekMonthLabel = input.required<string>();
  readonly dayNames = input.required<string[]>();

  readonly prevClicked = output<void>();
  readonly nextClicked = output<void>();
  readonly viewModeChanged = output<ViewMode>();
  readonly dateToggled = output<string>();
  readonly visibleDateChanged = output<string>();
  readonly moreDaysRequested = output<void>();

  readonly ChevronLeftIcon = ChevronLeft;
  readonly ChevronRightIcon = ChevronRight;

  private readonly scrollRef = viewChild<ElementRef<HTMLDivElement>>('scrollRef');
  private pendingMore = false;

  scrollToStart(): void {
    requestAnimationFrame(() =>
      this.scrollRef()?.nativeElement.scrollTo({ left: 0, behavior: 'smooth' })
    );
  }

  onStripScroll(event: Event): void {
    const el = event.target as HTMLDivElement;
    const scrollable = el.scrollWidth - el.clientWidth;
    if (scrollable > 0) {
      const ratio = el.scrollLeft / scrollable;
      const firstIndex = Math.round(ratio * (this.weekDays().length - 7));
      const day = this.weekDays()[firstIndex];
      if (day) this.visibleDateChanged.emit(day.date);
    }
    if (this.pendingMore) return;
    if (el.scrollWidth - el.scrollLeft - el.clientWidth < el.clientWidth) {
      this.pendingMore = true;
      this.moreDaysRequested.emit();
      requestAnimationFrame(() => { this.pendingMore = false; });
    }
  }
}
