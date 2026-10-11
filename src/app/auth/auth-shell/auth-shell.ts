import { ChangeDetectionStrategy, Component, ViewEncapsulation } from '@angular/core';

/**
 * Marco visual de las pantallas de acceso (login, registro, bienvenida): panel de marca a la
 * izquierda y el contenido proyectado a la derecha. Presentacional, sin lógica.
 *
 * Sin encapsulación a propósito: expone las clases `auth-*` (campos, botones, avisos) que usan
 * las páginas proyectadas, todas colgando de `.auth-shell` para no filtrarse al resto de la app.
 */
@Component({
  selector: 'app-auth-shell',
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  styleUrl: './auth-shell.scss',
  template: `
    <div class="auth-shell">
      <aside class="auth-brand" aria-label="Vertey">
        <div class="auth-brand-grid" aria-hidden="true"></div>
        <span class="auth-brand-glyph" aria-hidden="true">§</span>

        <div class="auth-brand-body">
          <p class="auth-kicker">Gestión para despachos de abogados</p>
          <p class="auth-hero">Tú te ocupas del derecho. Vertey, del despacho.</p>

          <ul class="auth-features">
            <li>
              <span class="auth-feature-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24"><rect x="3" y="7" width="18" height="13" rx="2"/><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
              </span>
              <span>
                <strong>Casos, plazos y documentos</strong>
                <span>Todo el expediente en un solo lugar.</span>
              </span>
            </li>
            <li>
              <span class="auth-feature-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24"><path d="M18 7a6 6 0 1 0 0 10"/><path d="M4 10h9M4 14h9"/></svg>
              </span>
              <span>
                <strong>Facturación y tesorería</strong>
                <span>Cobros, provisiones y cuentas conciliadas.</span>
              </span>
            </li>
            <li>
              <span class="auth-feature-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24"><path d="M10 3l1.8 4.7L16.5 9.5l-4.7 1.8L10 16l-1.8-4.7L3.5 9.5l4.7-1.8z"/><path d="M18 14l.9 2.1L21 17l-2.1.9L18 20l-.9-2.1L15 17l2.1-.9z"/></svg>
              </span>
              <span>
                <strong>Recepción IA</strong>
                <span>Filtra y prioriza las consultas que llegan.</span>
              </span>
            </li>
          </ul>
        </div>

        <div class="auth-brand-foot">
          <div class="auth-sample">
            <span class="auth-sample-avatar" aria-hidden="true">
              <svg viewBox="0 0 24 24"><rect x="4" y="8" width="16" height="12" rx="2"/><path d="M12 4v4M9 13h.01M15 13h.01"/></svg>
            </span>
            <span class="auth-sample-text">
              <strong>Raquel Molina Serrano</strong>
              <span>Seguros · Score 92</span>
            </span>
            <span class="auth-sample-badge">alta</span>
          </div>
          <p class="auth-trial">14 días con todo desbloqueado · Después, plan gratuito</p>
        </div>
      </aside>

      <main class="auth-main">
        <div class="auth-content">
          <ng-content />
        </div>
      </main>
    </div>
  `,
})
export class AuthShellComponent {}
