import { Injectable, computed, inject, signal } from '@angular/core';
import { DOCUMENT } from '@angular/common';

const MOBILE_QUERY = '(max-width: 639px)';
const TABLET_QUERY = '(max-width: 1023px)';

/**
 * Breakpoints reactivos alineados con Tailwind (sm=640, lg=1024).
 * Sin `matchMedia` (SSR, tests) asume escritorio.
 */
@Injectable({ providedIn: 'root' })
export class BreakpointService {
  private readonly doc = inject(DOCUMENT);

  private readonly mobile = signal(false);
  private readonly tablet = signal(false);

  /** < 640px */
  readonly isMobile = this.mobile.asReadonly();
  /** < 1024px (incluye móvil) */
  readonly isTablet = this.tablet.asReadonly();
  /** >= 1024px */
  readonly isDesktop = computed(() => !this.tablet());

  constructor() {
    this.track(MOBILE_QUERY, this.mobile);
    this.track(TABLET_QUERY, this.tablet);
  }

  private track(query: string, target: { set(v: boolean): void }): void {
    const mql = this.doc.defaultView?.matchMedia?.(query);
    if (!mql) return;
    target.set(mql.matches);
    mql.addEventListener('change', () => target.set(mql.matches));
  }
}
