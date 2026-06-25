# Vertey — Guía de estilo (handoff para Claude Code)

Estética: **moderno, profesional, limpio y premium**, con un toque tech/IA sutil.
Base de color = azul del logo + un acento violeta para lo relacionado con IA.

---

## 0. Prompt para pegar en Claude Code

> Vas a reestilizar la UI de la app (no cambies lógica ni estructura de datos, solo presentación). Aplica este sistema de diseño de forma consistente en todos los componentes. Usa los tokens EXACTOS de abajo. No inventes colores nuevos; si necesitas un tono intermedio, derívalo de los existentes. Mantén accesibilidad (contraste AA) y no rompas el comportamiento actual.
>
> Reglas globales:
> - Tipografías: títulos/números en **Space Grotesk**, texto/UI en **Manrope**, y datos técnicos (teléfonos, duraciones, IDs, etiquetas en mayúsculas) en **JetBrains Mono**. Carga las 3 desde Google Fonts.
> - Iconos: **Material Symbols Outlined** (no emojis, no SVGs sueltos). 20–21px. El icono del item de menú activo va con `FILL 1`.
> - Tema por defecto = **claro premium** (ver tokens "Light"). Si la app es modo oscuro, usa los tokens "Dark".
> - Cards con esquinas 18–20px, borde de 1px sutil, mucho aire interior (18–22px de padding).
> - Micro-interacciones suaves (transición .16s): hover en filas/menú = tinte de fondo; KPI cards = `translateY(-3px)` + sombra; fila/elemento activo = barra de 3px a la izquierda + fondo con tinte de marca.
> - Nada de gradientes agresivos, ni bordes redondeados con franja de color, ni sombras duras. Limpio y con jerarquía clara.
>
> Empieza por: layout (sidebar + topbar), luego KPI cards, luego listas/filas, luego el panel de "Resumen IA". Pégame los tokens en un archivo de tema/variables y refactoriza los componentes para consumirlos.

---

## 1. Color tokens

### Marca
| Token | Valor | Uso |
|---|---|---|
| `brand` | `#2563ff` | Azul principal (CTAs, links, activo) |
| `brand-hover` | `#1d4ed8` | Hover del azul |
| `brand-soft` | `#5b8def` | Azul claro / inicio de gradiente |
| `brand-gradient` | `linear-gradient(135deg, #5b8def, #2563ff)` | Marca, barras de progreso |
| `accent` (IA) | `#6d5efc` | Acento violeta: todo lo de IA / resúmenes |

### Texto (Light)
| Token | Valor |
|---|---|
| `text-strong` | `#0f1729` (títulos) |
| `text` | `#1a2233` |
| `text-body` | `#48526a` |
| `text-muted` | `#8a93a8` |
| `text-faint` | `#9aa3b2` |

### Superficies (Light)
| Token | Valor |
|---|---|
| `bg` (página) | `#f5f7fb` |
| `surface` (card) | `#ffffff` |
| `surface-2` (relleno suave / inputs) | `#f3f5fa` |
| `border` | `#edeff4` |
| `border-soft` | `#eef0f5` |

### Estado / semántica
| Token | Valor |
|---|---|
| `success` | `#13a45f` |
| `danger` | `#e0455a` |
| `warning` | `#c1860f` |

### Chips de categoría (fondo / texto)
| Tipo | Fondo | Texto |
|---|---|---|
| Cliente | `#eaf0ff` | `#2563ff` |
| Prospecto | `#f0ecff` | `#6d5efc` |
| Consulta | `#eef1f6` | `#5b6577` |
| Urgencia Alta | `#fdecee` | `#e0455a` |
| Urgencia Media | `#fff5e6` | `#c1860f` |
| Urgencia Baja | `#e9f5ef` | `#1f9d63` |

### Variante oscura (Dark, tech/IA)
| Token | Valor |
|---|---|
| `bg` | `#070b16` + glows radiales: `radial-gradient(1100px 600px at 80% -10%, rgba(124,92,255,.13), transparent 60%)`, `radial-gradient(900px 500px at 10% 110%, rgba(37,99,255,.12), transparent 55%)` |
| `surface` | `rgba(255,255,255,.025)` |
| `sidebar` | `#0a0f1d` |
| `border` | `rgba(255,255,255,.07)` |
| `text-strong` | `#f4f7ff` |
| `text` | `#e9edf7` |
| `text-body` | `#aeb6c9` |
| `text-muted` | `#7e88a0` |
| activo (fila/menú) | fondo `rgba(77,139,255,.14)`, barra `#4d8bff` con `box-shadow:0 0 10px rgba(77,139,255,.8)` |

> En oscuro, los chips usan el mismo matiz pero translúcido (`rgba(...,.16)`) y el texto en versión clara (cliente `#9cc0ff`, prospecto `#c3b2ff`, success `#34d399`, danger `#fb7185`).

---

## 2. Tipografía

```
Display / títulos / números:  'Space Grotesk', weight 500–600
Texto y UI:                   'Manrope', weight 400–800
Datos técnicos / mono:        'JetBrains Mono', weight 400–600
```

Escala (px):
- Saludo / título de página: **19 / Space Grotesk 600**
- Número de KPI: **29 / Space Grotesk 600**, line-height 1
- Título de sección: **16 / Space Grotesk 600**
- Nombre en fila: **14.5 / Manrope 700**
- Cuerpo: **13–14 / Manrope 400–500**
- Subtexto / muted: **12.5–13 / Manrope**
- Etiqueta mono (MAYÚS): **10.5–11 / JetBrains Mono 600**, `letter-spacing:.06em`, `text-transform:uppercase`
- Chips: **11–11.5 / 700**

---

## 3. Forma, espacio, profundidad

- Radios: cards **18–20px**, filas/inputs/botones **12–14px**, icon-chip **12px**, chips de estado **99px (pill)**.
- Padding de card: **18–22px**. Gaps de contenido: **16–22px**. Grid de KPIs: `gap 16px`.
- Bordes: **1px** sólido sutil (ver tokens), nunca negro puro.
- Sombras (light):
  - Card hover: `0 16px 30px -20px rgba(30,45,80,.3)`
  - Ventana/modal: `0 24px 60px -30px rgba(20,32,60,.28)`
- Iconos: Material Symbols Outlined, 20–21px; chip de icono = cuadrado 40px, radio 12px, fondo = tinte del color asociado.

---

## 4. Micro-interacciones (todas con `transition: … .16s ease`)

- **Item de menú** hover: fondo `surface-2`. Activo: fondo `brand-soft tint`, texto `brand`, barra de 3px a la izquierda, icono `FILL 1`.
- **Fila de lista** hover: fondo tinte. Activa: fondo `#f3f6ff` (dark: `rgba(77,139,255,.12)`) + barra izquierda 3px `brand`.
- **KPI card** hover: `transform: translateY(-3px)` + sombra de card.
- **Botón primario**: fondo `brand` → hover `brand-hover` (dark: `filter:brightness(1.1)` + glow).
- **Indicador "En directo"**: punto que pulsa.
  ```css
  @keyframes vpulse { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:.35;transform:scale(.82)} }
  ```

---

## 5. Recetas de componentes

**KPI card**
`surface` · borde 1px · radio 18 · padding 18 · arriba: icon-chip (40px, tinte) a la izq + delta a la der (verde si sube, muted si neutro) · número 29px Space Grotesk · label 13px muted. Hover = lift.

**Fila de llamada**
avatar 42px (iniciales, tinte de su categoría) · nombre 14.5/700 + chip de categoría · preview 12.5 muted (1 línea, ellipsis) · derecha: duración mono + "hace X" · chevron. Click selecciona y actualiza el panel de resumen.

**Panel "Resumen IA"** (el sello de la marca)
- Encabezado: icono `auto_awesome` + "RESUMEN IA" en `accent` (violeta), mayúsculas.
- Ficha del contacto + duración con `play_arrow`.
- **Waveform**: fila de ~36 barras (`flex:1`, radio 2px, altura variable), gradiente vertical `#6f9bf2→#2563ff` (dark: `#b39dff→#4d8bff` con glow).
- Párrafo de resumen.
- Bloques **Motivo / Puntos clave / Próximo paso**: punto de color + label mono mayúsculas + texto.
- Chips: Área (neutro) + Urgencia (semántico).
- Acciones: primario "Crear expediente" + ghost "Transcripción".

**Pill "En directo"**: fondo `success` translúcido, punto que pulsa, texto 12.5/700 en `success`.

---

## 6. Carga de fuentes e iconos

```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=Manrope:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&display=swap" rel="stylesheet">
<link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@24,400,0,0&display=swap" rel="stylesheet">
```

Iconos usados: `space_dashboard, call, groups, calendar_month, receipt_long, settings, search, notifications, auto_awesome, play_arrow, folder_open, description, chevron_right, schedule, bolt, unfold_more`.
