import { describe, it, expect } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { DOCUMENT } from '@angular/common';
import { BreakpointService } from './breakpoint.service';

type Listener = () => void;

function mockMatchMedia(width: { value: number }) {
  const listeners = new Set<Listener>();
  const fn = (query: string) => {
    const max = /max-width:\s*(\d+)px/.exec(query);
    const min = /min-width:\s*(\d+)px/.exec(query);
    return {
      get matches() {
        if (max) return width.value <= Number(max[1]);
        if (min) return width.value >= Number(min[1]);
        return false;
      },
      media: query,
      addEventListener: (_: string, l: Listener) => listeners.add(l),
      removeEventListener: (_: string, l: Listener) => listeners.delete(l),
    };
  };
  return { fn, fire: () => listeners.forEach((l) => l()) };
}

function setup(view: unknown) {
  TestBed.configureTestingModule({
    providers: [{ provide: DOCUMENT, useValue: { defaultView: view } }],
  });
  return TestBed.inject(BreakpointService);
}

describe('BreakpointService', () => {
  it('reports mobile below 640px', () => {
    const w = { value: 400 };
    const mm = mockMatchMedia(w);
    const svc = setup({ matchMedia: mm.fn });
    expect(svc.isMobile()).toBe(true);
    expect(svc.isTablet()).toBe(true);
    expect(svc.isDesktop()).toBe(false);
  });

  it('reports tablet between 640 and 1023px', () => {
    const w = { value: 800 };
    const svc = setup({ matchMedia: mockMatchMedia(w).fn });
    expect(svc.isMobile()).toBe(false);
    expect(svc.isTablet()).toBe(true);
    expect(svc.isDesktop()).toBe(false);
  });

  it('reports desktop from 1024px', () => {
    const w = { value: 1280 };
    const svc = setup({ matchMedia: mockMatchMedia(w).fn });
    expect(svc.isMobile()).toBe(false);
    expect(svc.isTablet()).toBe(false);
    expect(svc.isDesktop()).toBe(true);
  });

  it('updates signals on media change events', () => {
    const w = { value: 1280 };
    const mm = mockMatchMedia(w);
    const svc = setup({ matchMedia: mm.fn });
    expect(svc.isDesktop()).toBe(true);
    w.value = 500;
    mm.fire();
    expect(svc.isMobile()).toBe(true);
    expect(svc.isDesktop()).toBe(false);
  });

  it('defaults to desktop when matchMedia is unavailable', () => {
    const svc = setup({});
    expect(svc.isDesktop()).toBe(true);
    expect(svc.isMobile()).toBe(false);
    expect(svc.isTablet()).toBe(false);
  });

  it('defaults to desktop when there is no window', () => {
    const svc = setup(null);
    expect(svc.isDesktop()).toBe(true);
  });
});
