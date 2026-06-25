import { Injectable, signal, effect, inject } from '@angular/core';
import { DOCUMENT } from '@angular/common';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly doc = inject(DOCUMENT);

  readonly isDark = signal(false);

  constructor() {
    this.isDark.set(this.detectInitialTheme());
    effect(() => this.applyTheme(this.isDark()));
  }

  toggle(): void {
    this.isDark.update(v => !v);
  }

  private detectInitialTheme(): boolean {
    try {
      const saved = localStorage.getItem('theme');
      if (saved) return saved === 'dark';
      return this.doc.defaultView?.matchMedia('(prefers-color-scheme: dark)').matches ?? false;
    } catch {
      return false;
    }
  }

  private applyTheme(dark: boolean): void {
    this.doc.documentElement.classList.toggle('dark', dark);
    try {
      localStorage.setItem('theme', dark ? 'dark' : 'light');
    } catch { /* storage unavailable */ }
  }
}
