# kerf: Design System

> Companion to 01-product-spec.md and 02-architecture.md
> Status: v0.1 (initial, expect iteration)
> Last updated: 2026-04-17

## 1. Visual Identity Summary

**Vibe**: Mechanical Workshop — premium tool aesthetic, deliberate utilitarianism.

**Reference points**: Linear (precision), Monkeytype (focus), Berkeley Mono products (craft).

**Core principle**: Every visual decision should feel intentional. Utilitarian as an aesthetic choice, not as an excuse for laziness.

**Mode**: Dark mode is the default and primary experience. Light mode is V2 — if implemented at all.

## 2. Color Tokens

All colors expressed as hex. CSS variable names follow a `--lr-{category}-{role}` convention.

### 2.1 Background Layers

The background system uses 4 elevation levels. Higher elevation = lighter, used to create depth without shadows.

```
--lr-bg-base:       #181410  /* Page background (dark espresso) */
--lr-bg-surface:    #221C17  /* Cards, panels, elevated containers */
--lr-bg-elevated:   #2A2320  /* Modals, popovers, hover states */
--lr-bg-overlay:    #322A26  /* Tooltips, dropdowns, deep elevation */
```

### 2.2 Foreground / Text

```
--lr-text-primary:    #F2EAE0  /* Default text — high contrast on bg-base */
--lr-text-secondary:  #9A8E80  /* Subtitles, labels, muted descriptions */
--lr-text-tertiary:   #685D52  /* Hints, placeholders, disabled state */
--lr-text-inverse:    #181410  /* Text on amber/light surfaces */
```

### 2.3 Borders

```
--lr-border-subtle:   #2F2820  /* Default borders, low emphasis */
--lr-border-default:  #3A3128  /* Standard borders for cards/inputs */
--lr-border-strong:   #4A3F35  /* Hover borders, emphasized boundaries */
```

### 2.4 Accent: Amber

The brand accent. Used sparingly for: primary actions, target key highlight, current value emphasis, brand moments. **Do not over-use** — amber should feel earned, not decorative.

```
--lr-amber-base:    #F59E0B  /* Primary accent (Tailwind amber-500) */
--lr-amber-hover:   #FBBF24  /* Hover/lighter state */
--lr-amber-pressed: #D97706  /* Active/pressed state */
--lr-amber-subtle:  rgba(245, 158, 11, 0.15)  /* Background tint, badges */
--lr-amber-faint:   rgba(245, 158, 11, 0.08)  /* Very subtle highlights */
```

### 2.5 Semantic Colors

For feedback states. Tuned to be readable on dark espresso background, slightly desaturated to avoid harsh "warning yellow" look.

```
/* Success (correct keypress, achievement) */
--lr-success-base:    #22C55E
--lr-success-subtle:  rgba(34, 197, 94, 0.15)

/* Error (incorrect keypress, validation error) */
--lr-error-base:      #EF4444
--lr-error-subtle:    rgba(239, 68, 68, 0.15)

/* Warning (hesitation, attention needed) */
--lr-warning-base:    #EAB308
--lr-warning-subtle:  rgba(234, 179, 8, 0.15)

/* Info (system messages, neutral feedback) */
--lr-info-base:       #3B82F6
--lr-info-subtle:     rgba(59, 130, 246, 0.15)
```

### 2.6 Eight Finger Colors

Mapped to the 8 fingers used in touch typing. Muted/desaturated palette inspired by mechanical keyboard keycap colorways. **Not** rainbow — the palette is harmonious, with each color earning its place.

Mapping convention: left hand = "earth tones" (warmer), right hand = "sky tones" (cooler). Pinkies are most saturated since they're hardest to differentiate from neighbors.

```
/* Left hand */
--lr-finger-l-pinky:   #C2410C  /* Burnt orange */
--lr-finger-l-ring:    #A16207  /* Amber bronze */
--lr-finger-l-middle:  #65A30D  /* Olive green */
--lr-finger-l-index:   #15803D  /* Forest green */

/* Right hand */
--lr-finger-r-index:   #0E7490  /* Teal */
--lr-finger-r-middle:  #1D4ED8  /* Deep blue */
--lr-finger-r-ring:    #6D28D9  /* Indigo violet */
--lr-finger-r-pinky:   #A21CAF  /* Plum magenta */

/* Thumbs (both hands, shared) */
--lr-finger-thumb:     #6B7280  /* Neutral gray */
```

**Tinted variants**: each finger color also has a `-subtle` variant at 15% opacity for use as background fills (e.g., per-key heatmap backgrounds).

### 2.7 Heatmap Scale

For visualizing per-key error rate. 5-step ramp from neutral to high-error.

```
--lr-heat-0: transparent           /* No data / mastered */
--lr-heat-1: rgba(245,158,11,0.15) /* Mild concern */
--lr-heat-2: rgba(245,158,11,0.35) /* Notable weakness */
--lr-heat-3: rgba(239,68,68,0.45)  /* Significant weakness */
--lr-heat-4: rgba(239,68,68,0.75)  /* Critical — top weakness */
```

Note: heatmap intentionally uses amber-to-red ramp (not green-to-red) because green is reserved for "correct keypress" semantic — using it for "low error rate" creates conflicting meaning.

## 3. Typography

### 3.1 Font Stacks

```css
--lr-font-sans:
  "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
--lr-font-mono: "JetBrains Mono", "SF Mono", Menlo, Consolas, monospace;
```

**Rationale**:

- Inter for UI: maximally readable at small sizes, neutral, well-tested
- JetBrains Mono for typing content & numerical data: clear character distinctions (0/O, 1/l/I), mature ligature support, free, ubiquitous in developer culture (trust signal for target audience)

### 3.2 Type Scale

```
/* Display (rare, hero moments only) */
--lr-text-display:   42px / 1.1   / weight 700
--lr-text-h1:        32px / 1.2   / weight 700
--lr-text-h2:        24px / 1.25  / weight 600
--lr-text-h3:        18px / 1.3   / weight 600

/* Body */
--lr-text-body-lg:   16px / 1.6   / weight 400
--lr-text-body:      14px / 1.6   / weight 400
--lr-text-body-sm:   13px / 1.5   / weight 400

/* Functional */
--lr-text-label:     12px / 1.4   / weight 500 / letter-spacing 0.02em
--lr-text-caption:   11px / 1.4   / weight 400
--lr-text-overline:  10px / 1.2   / weight 600 / letter-spacing 0.1em / uppercase

/* Typing content (always mono) */
--lr-text-typing:    24px / 1.6   / weight 400 / letter-spacing 0.02em
--lr-text-typing-lg: 32px / 1.5   / weight 400 / letter-spacing 0.02em

/* Numerical display (always mono) */
--lr-text-stat:      28px / 1.0   / weight 700 (for big WPM, accuracy)
--lr-text-stat-sm:   16px / 1.0   / weight 500 (for inline stats)
```

### 3.3 Font Pairing Rules

- **Headings & UI labels**: Inter (sans)
- **Typing exercise content**: JetBrains Mono (mono) — non-negotiable
- **Numerical data (WPM, accuracy, time, scores)**: JetBrains Mono — for visual consistency with typing area
- **Body prose** (instructions, descriptions): Inter
- **Code snippets, formulas in transparency panel**: JetBrains Mono

## 4. Spacing Scale

Base unit: 4px. All spacing uses multiples of 4 to create rhythm.

```
--lr-space-1:  4px
--lr-space-2:  8px
--lr-space-3:  12px
--lr-space-4:  16px
--lr-space-5:  20px
--lr-space-6:  24px
--lr-space-8:  32px
--lr-space-10: 40px
--lr-space-12: 48px
--lr-space-16: 64px
--lr-space-20: 80px
--lr-space-24: 96px
```

**Usage convention**:

- Inline spacing (within components): 4-16px
- Component padding: 12-24px
- Section spacing: 32-64px
- Page-level spacing: 64-96px

## 5. Border Radius

Subtle rounding. Sharp enough to feel precise, soft enough to feel modern.

```
--lr-radius-none: 0px        /* Inputs in tight grids, technical contexts */
--lr-radius-sm:   4px        /* Default — buttons, inputs, badges */
--lr-radius-md:   6px        /* Cards, panels */
--lr-radius-lg:   12px       /* Modals, large surfaces */
--lr-radius-full: 9999px     /* Pills, avatars (sparingly) */
```

**Rule**: use the smallest radius that feels right. Heavy rounding contradicts the "precise tool" aesthetic.

## 6. Animation & Timing

Fast and crisp. No bouncy springs or long fades — those feel toy-like.

```
--lr-duration-instant: 100ms   /* Visual feedback (keypress flash) */
--lr-duration-fast:    150ms   /* Hover states, simple transitions */
--lr-duration-medium:  200ms   /* Modal open, panel slide */
--lr-duration-slow:    300ms   /* Page transitions, complex sequences */

--lr-ease-default: cubic-bezier(0.4, 0, 0.2, 1)    /* Material-style standard */
--lr-ease-out:     cubic-bezier(0.0, 0, 0.2, 1)    /* Decelerate (entries) */
--lr-ease-in:      cubic-bezier(0.4, 0, 1, 1)      /* Accelerate (exits) */
```

**Critical**: keypress visual feedback must complete within 100ms. Anything slower than that breaks the perception of responsiveness.

**Reduce-motion**: respect `prefers-reduced-motion`. All animations should fall back to instant state changes (or fade only) when active.

## 7. Elevation & Depth

No shadows. Depth is created through:

1. Background lightness (4 elevation levels in §2.1)
2. Borders (subtle / default / strong in §2.3)
3. Spacing (more padding = higher perceived importance)

**Rationale**: shadows on dark backgrounds tend to look muddy and inconsistent across monitors. Background-based elevation is more reliable and feels more "designed".

## 8. Components: Initial Spec

This section will expand significantly as we build out the design system. For v0.1, here are the foundational components.

### 8.1 Button Variants

**Primary** (amber, used sparingly):

- Background: `--lr-amber-base`
- Text: `--lr-text-inverse` (#181410)
- Hover: background shifts to `--lr-amber-hover`
- Pressed: background shifts to `--lr-amber-pressed`, scale 0.98
- Padding: 10px 20px (default), 8px 16px (compact)

**Secondary** (transparent with border):

- Background: transparent
- Border: 1px solid `--lr-border-default`
- Text: `--lr-text-primary`
- Hover: background `--lr-bg-elevated`, border `--lr-border-strong`

**Ghost** (no border, minimal):

- Background: transparent
- Text: `--lr-text-secondary`
- Hover: background `--lr-amber-faint`, text `--lr-text-primary`

### 8.2 Card

- Background: `--lr-bg-surface`
- Border: 1px solid `--lr-border-subtle`
- Border-radius: `--lr-radius-md`
- Padding: 16px 20px (default), 24px 28px (large)

### 8.3 Input

- Background: `--lr-bg-elevated`
- Border: 1px solid `--lr-border-default`
- Border-radius: `--lr-radius-sm`
- Padding: 10px 14px
- Focus: border `--lr-amber-base`, no glow/shadow
- Font: Inter for general text, JetBrains Mono for code/numerical input

### 8.4 Badge / Pill

- Background: `--lr-amber-subtle` (or other `-subtle` semantic)
- Text: `--lr-amber-base` (or matching semantic base)
- Padding: 2px 8px
- Border-radius: `--lr-radius-sm`
- Font: JetBrains Mono, 12px, weight 700

## 9. Iconography

**Library**: Lucide Icons (open source, well-maintained, large coverage). No custom icons in MVP.

**Sizes**: 14px, 16px (default), 20px, 24px. Stroke width: 1.5 (default), 2 (emphasis).

**Color**: inherits from text color via `currentColor`.

## 10. Logo / Wordmark

**Wordmark**: `kerf.` (lowercase, with trailing period as accent)

**Typography**:

- Font: Fraunces (serif), weight 700
- Font variation settings: `"opsz" 144, "SOFT" 100`
- The `opsz 144` setting engages Fraunces' display-optical-size variant (higher contrast, more pronounced terminals), and `SOFT 100` maxes the softness axis for rounded, warm character edges
- Letter-spacing: -0.02em (tight, but not crushed)

**Color**:

- `kerf` — `--lr-text-primary` (#F2EAE0)
- `.` (trailing period) — `--lr-amber-base` (#F59E0B)

**Rationale**: "kerf" is the narrow slit left by a saw blade — precise, deliberate, the mark of a tool doing its work. Fraunces' soft-but-sharp display cut mirrors that duality (serif = craft, soft axis = warmth). The amber period is the single brand accent moment — small, earned, unmistakable.

**Sizing reference**:

- Navigation bar wordmark: 20px
- Login / onboarding wordmark: 32px
- Hero / marketing contexts: 48px+

**Font loading**: Fraunces is a variable font. Self-host the variable `.woff2` and declare it alongside Inter and JetBrains Mono (see §11.2).

```css
@font-face {
  font-family: "Fraunces";
  src: url("/fonts/Fraunces-Variable.woff2") format("woff2-variations");
  font-weight: 400 900;
  font-display: swap;
}
```

**Usage rules**:

- Never recolor the wordmark beyond the spec above
- Never substitute the font — Fraunces with those exact variation settings is the wordmark
- Never drop the trailing period — it's not punctuation, it's the mark
- Never use the wordmark inline inside body copy — it's a brand element, not a word

## 11. Implementation Notes

### 11.1 Tailwind Integration

If using Tailwind, extend the theme in `tailwind.config.js`:

```js
theme: {
  extend: {
    colors: {
      lr: {
        bg: { base: '#181410', surface: '#221C17', elevated: '#2A2320', overlay: '#322A26' },
        text: { primary: '#F2EAE0', secondary: '#9A8E80', tertiary: '#685D52', inverse: '#181410' },
        amber: { DEFAULT: '#F59E0B', hover: '#FBBF24', pressed: '#D97706' },
        // ... etc
      }
    },
    fontFamily: {
      sans: ['Inter', 'sans-serif'],
      mono: ['JetBrains Mono', 'monospace'],
    }
  }
}
```

### 11.2 Font Loading

Self-host fonts (no Google Fonts CDN) for performance and privacy. Use `font-display: swap` to avoid blocking render.

```css
@font-face {
  font-family: "Inter";
  src: url("/fonts/Inter-Variable.woff2") format("woff2-variations");
  font-weight: 400 700;
  font-display: swap;
}

@font-face {
  font-family: "JetBrains Mono";
  src: url("/fonts/JetBrainsMono-Variable.woff2") format("woff2-variations");
  font-weight: 400 700;
  font-display: swap;
}
```

### 11.3 Theme Switching (V2)

For now, dark mode only. When light mode is added in V2, structure tokens as semantic CSS variables that swap based on `[data-theme]` attribute or `prefers-color-scheme`.

## 12. Anti-Patterns to Avoid

Things that would betray the visual identity:

- ❌ Drop shadows for elevation (use background lightness instead)
- ❌ Gradients (flat surfaces only)
- ❌ Bright/saturated colors used decoratively (only for semantic meaning)
- ❌ Heavy rounding on everything (precise tool feel = restrained radius)
- ❌ Animations longer than 300ms (feels slow/toy-like)
- ❌ Mixing more than 2 typefaces (Inter + JetBrains Mono only)
- ❌ Using emoji for UI signaling (use Lucide icons or finger colors)
- ❌ Title Case for labels (sentence case throughout)
- ❌ Amber overuse (it should feel earned, not painted everywhere)

## 13. Open Questions / TBD

- Logo / mark design (separate from wordmark)
- Light mode tokens (V2)
- Empty state illustrations style
- Onboarding visual style (split keyboard preview rendering)
- Print styles (likely not needed for MVP)
- Animation choreography for session start/end transitions
