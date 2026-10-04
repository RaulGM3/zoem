import { describe, it, expect, beforeEach } from 'vitest';
import { Component, signal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { DemoLayoutComponent } from './demo-layout';
import { AgenteLanzadorComponent } from '../agente-ia/agente-lanzador';
import { AuthService } from '../../auth/auth.service';
import { PermissionService } from '../../core/services/permission.service';
import { SearchService } from '../../core/services/search.service';

@Component({ selector: 'app-agente-lanzador', template: '' })
class AgenteLanzadorStub {}

const fakePerm = {
  userRole: () => null,
  isSuperUser: () => false,
  can: () => true,
  currentMember: () => null,
  displayRole: () => ({ label: '' }),
};
const fakeAuth = { user: signal(null), logout: async () => undefined };

function q(f: ComponentFixture<DemoLayoutComponent>, sel: string): HTMLElement | null {
  return (f.nativeElement as HTMLElement).querySelector(sel);
}

describe('DemoLayoutComponent (mobile)', () => {
  let fixture: ComponentFixture<DemoLayoutComponent>;

  beforeEach(async () => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [DemoLayoutComponent],
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: fakeAuth },
        { provide: PermissionService, useValue: fakePerm },
      ],
    });
    TestBed.overrideComponent(DemoLayoutComponent, {
      remove: { imports: [AgenteLanzadorComponent] },
      add: { imports: [AgenteLanzadorStub] },
    });
    await TestBed.compileComponents();
    fixture = TestBed.createComponent(DemoLayoutComponent);
    fixture.detectChanges();
  });

  it('uses dynamic viewport height minus the safe-area insets on the shell', () => {
    const root = (fixture.nativeElement as HTMLElement).firstElementChild as HTMLElement;
    // body already carries the safe-area padding; a plain h-dvh would overflow on notched devices
    expect(
      root.classList.contains('h-[calc(100dvh-var(--safe-area-top)-var(--safe-area-bottom))]'),
    ).toBe(true);
    expect(root.classList.contains('h-screen')).toBe(false);
  });

  it('drawer is absent until opened', () => {
    expect(q(fixture, '[data-test="mobile-drawer"]')).toBeNull();
  });

  it('drawer exposes role=dialog, aria-modal and a label when open', () => {
    fixture.componentInstance.sidebarOpen.set(true);
    fixture.detectChanges();
    const d = q(fixture, '[data-test="mobile-drawer"]')!;
    expect(d.getAttribute('role')).toBe('dialog');
    expect(d.getAttribute('aria-modal')).toBe('true');
    expect(d.getAttribute('aria-label')).toBeTruthy();
  });

  it('Escape closes the drawer', () => {
    fixture.componentInstance.sidebarOpen.set(true);
    fixture.detectChanges();
    const d = q(fixture, '[data-test="mobile-drawer"]')!;
    d.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    fixture.detectChanges();
    expect(fixture.componentInstance.sidebarOpen()).toBe(false);
    expect(q(fixture, '[data-test="mobile-drawer"]')).toBeNull();
  });

  it('mobile search toggle is labelled, md:hidden and opens the input row', () => {
    const btn = q(fixture, '[data-test="mobile-search-toggle"]')!;
    expect(btn.getAttribute('aria-label')).toBe('Buscar');
    expect(btn.classList.contains('md:hidden')).toBe(true);
    expect(btn.classList.contains('tap-target')).toBe(true);
    expect(q(fixture, '[data-test="mobile-search-input"]')).toBeNull();
    btn.click();
    fixture.detectChanges();
    expect(q(fixture, '[data-test="mobile-search-input"]')).not.toBeNull();
    expect(btn.getAttribute('aria-expanded')).toBe('true');
  });

  it('mobile search input reuses the shared search term', () => {
    q(fixture, '[data-test="mobile-search-toggle"]')!.click();
    fixture.detectChanges();
    const input = q(fixture, '[data-test="mobile-search-input"]') as HTMLInputElement;
    input.value = 'garcia';
    input.dispatchEvent(new Event('input'));
    expect(TestBed.inject(SearchService).term()).toBe('garcia');
  });

  it('Escape closes the mobile search and clears the term', () => {
    q(fixture, '[data-test="mobile-search-toggle"]')!.click();
    fixture.detectChanges();
    const svc = TestBed.inject(SearchService);
    svc.setTerm('x');
    const input = q(fixture, '[data-test="mobile-search-input"]')!;
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    fixture.detectChanges();
    expect(q(fixture, '[data-test="mobile-search-input"]')).toBeNull();
    expect(svc.term()).toBe('');
  });

  it('nav links no longer use inline mouseenter style hacks', () => {
    const html = (fixture.nativeElement as HTMLElement).innerHTML;
    expect(html).not.toContain('mouseenter');
    const link = q(fixture, 'aside nav a') ;
    if (link) expect(link.className).toContain('hover:bg-[var(--surface-2)]');
  });
});
