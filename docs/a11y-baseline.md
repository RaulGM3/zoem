# Baseline de accesibilidad — 2026-09-21

`CLAUDE.md` exige que la app pase todos los checks de AXE y cumpla WCAG AA.
Hasta hoy **nada lo medía**: el proyecto no tenía ESLint, ni `@angular-eslint`,
ni `axe-core`. Este documento es la línea de referencia contra la que se mide
la mejora. Los números están en rojo a propósito.

## Cómo medir

```bash
npm run lint    # ESLint + reglas de accesibilidad de templates de Angular
npm test        # incluye los specs *.a11y.spec.ts que corren axe-core
```

## Baseline ESLint — 179 errores

| Regla | Errores | ¿a11y? |
|---|---:|---|
| `template/label-has-associated-control` | 57 | sí |
| `template/click-events-have-key-events` | 39 | sí |
| `@typescript-eslint/no-unused-vars` | 27 | no |
| `template/interactive-supports-focus` | 23 | sí |
| `template/no-autofocus` | 12 | sí |
| `template/eqeqeq` | 9 | no |
| `no-output-native` | 4 | no |
| `template/role-has-required-aria` | 2 | sí |
| `no-output-rename` | 1 | no |
| `no-empty-lifecycle-method` | 1 | no |

**Total de accesibilidad: 133.**

### Por módulo (solo a11y)

| Módulo | Errores |
|---|---:|
| `caso-detail` | 27 |
| `facturacion` | 19 |
| `tesoreria` | 19 |
| `plantilla-detail` | 15 |
| `plantillas` | 13 |
| `calendario` | 7 |
| `demo-layout` | 7 |
| `recepcion-ia` | 7 |
| `casos` | 5 |
| `doc-template-detail` | 4 |
| `eventos` | 3 |
| `contacto-detail` | 2 |

Dato contraintuitivo: **`casos/` es de los módulos más limpios**. El foco de
remediación debe ir a `caso-detail`, `facturacion` y `tesoreria`.

## Baseline axe-core

Primer spec: `src/app/components/casos/components/casos-table/casos-table.a11y.spec.ts`.
**Falla a propósito** — documenta una violación real:

- `empty-table-header` (minor) en `th:nth-child(7)` — la columna de acciones es
  un `<th>` vacío, sin texto perceptible por un lector de pantalla.
  Ver `casos-table.html:23`.

### Limitación importante de esta medición

Los specs corren en **jsdom, que no hace layout real**. Por eso la regla
`color-contrast` está **desactivada** en `src/testing/axe.ts`: dejarla activa
produciría falsos verdes. **El contraste de color (WCAG AA 4.5:1) NO está
cubierto por estos tests** y debe verificarse a mano en navegador o con axe
DevTools.

## Lo que NINGUNA de las dos herramientas detecta

Encontrado por revisión manual del código. No hay regla automática que lo cace,
así que requiere trabajo dirigido (Fase 2 del plan):

- **Hover implementado en JavaScript inline** mutando `style.background`, sin
  equivalente de `:focus`. +55 ocurrencias solo en `caso-detail/`, decenas más
  en `facturacion/` y `casos/`. Quien navega con teclado no ve nada.
- **`:focus-visible` no existe globalmente** en `src/styles.css`. Y
  `usuarios.html:87` además hace `focus:outline-none`.
- **`prefers-reduced-motion` no existe** en todo el repo (0 coincidencias).
- **Drawers sin focus trap ni Escape**: `contactos` lo hace bien con
  `appFocusTrap` + `escapeKey`; los 3 drawers de `usuarios`, los de
  `caso-detail` y `nuevo-caso-drawer` no. `factura-drawer.html` ni siquiera
  declara `role="dialog"`.
- **`aria-live` no existe en ningún módulo**: toasts, subidas y resultados
  asíncronos son mudos para un lector de pantalla.
- **`role="link"` sobre un `<tr>`** (`casos-table.html:46`). Verificado: axe
  **no** lo marca como violación (`aria-allowed-role` pasa). Pero pisa la
  semántica de fila, así que la tabla deja de anunciarse como tabla navegable.
  El motivo más fuerte para cambiarlo es otro: sin un `<a href>` real no hay
  Ctrl+click ni "abrir en pestaña nueva".

## Deuda registrada en esta misma sesión

- **Bundle inicial en 1.04 MB.** El `maximumError` de `angular.json` se subió de
  `1MB` a `1.2MB` para desbloquear el build tras alinear Angular a 21.2.23.
  El `maximumWarning` sigue en 500 kB y se supera por más del doble — venía de
  antes. No se investigó el contenido del chunk inicial
  (`chunk-KMVG7VSO` pesa 582 kB por sí solo).
