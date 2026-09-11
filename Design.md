# Design System Inspired by Pinterest

> Auto-extracted from `https://www.pinterest.jp` on 2026-04-14

## 1. Visual Theme & Atmosphere

Friendly, approachable design with rounded shapes and generous whitespace.

The hero section leads with "Welcome to Pinterest".

**Key Characteristics:**
- pinSans as the heading font (custom web font loaded via @font-face)
- pinSans as the body font for all running text
- Heading weight 600, letter-spacing -1.2px
- Light/white background (#ffffff) as the primary canvas
- Primary accent `#e60023` used for CTAs and brand highlights
- 2 shadow level(s) detected — tinted shadows
- Rounded corners (16px+) creating a friendly, approachable feel
- Tags: light, rounded, colorful, sans-serif

## 2. Color Palette & Roles

### Primary
- **Primary Accent** (`#e60023`) · `--color-primary`: Brand color, CTA backgrounds, link text, interactive highlights.
- **Secondary Accent** (`#fa5f2e`) · `--color-secondary`: Secondary brand, hover states, complementary highlights.
- **Background** (`#ffffff`) · `--color-bg`: Page background, primary canvas.
- **Background Secondary** (`#000000`) · `--color-bg-secondary`: Cards, surfaces, alternating sections.

### Text
- **Text Primary** (`#211922`) · `--color-text`: Headings and body text.
- **Text Secondary** (`#666666`) · `--color-text-secondary`: Muted text, captions, placeholders.

### Borders & Surfaces
- **Border** (`#e5e5e0`) · `--color-border`: Dividers, outlines, input borders.

### Full Extracted Palette

| # | Hex | CSS Variable | Role | Area | Contrast |
|---|---|---|---|---|---|
| 1 | `#ffffff` | `--palette-1` | block | large | text-dark |
| 2 | `#000000` | `--palette-2` | block | large | text-light |
| 3 | `#e60023` | `--palette-3` | button | medium | text-light |
| 4 | `#e5e5e0` | `--palette-4` | button | medium | text-dark |
| 5 | `#00c300` | `--palette-5` | button | medium | text-light |
| 6 | `#fa5f2e` | `--palette-6` | text-accent | small | text-dark |
| 7 | `#9270d7` | `--palette-7` | text-accent | small | text-dark |
| 8 | `#9c0343` | `--palette-8` | button | small | text-light |
| 9 | `#2b48d4` | `--palette-9` | text-accent | small | text-light |
| 10 | `#2aa788` | `--palette-10` | text-accent | small | text-light |
| 11 | `#526ae0` | `--palette-11` | text-accent | small | text-light |
| 12 | `#c856c8` | `--palette-12` | text-accent | small | text-dark |

## 3. Typography Rules

- **Heading Font:** `pinSans` (web font)
- **Body Font:** `pinSans` (web font)

### Type Hierarchy

| Role | Font | Size | Weight | Line Height | Letter Spacing |
|---|---|---|---|---|---|
| H1 | Pin Sans | 32px | 600 | normal | -1.2px |
| H2 | Pin Sans | 70px | 600 | normal | normal |
| Body | Pin Sans | 14px | 700 | normal | normal |

### Type Scale

| Token | Size | Suggested Usage |
|---|---|---|
| Display | `70px` | headings |
| H1 | `50px` | headings |
| H2 | `38px` | headings |
| H3 | `32px` | headings |
| H4 | `20px` | headings |
| Body L | `16px` | body / supporting text |
| Body | `14px` | body / supporting text |
| Small | `12px` | body / supporting text |

### Japanese Typography (CJK)

This site uses Japanese (CJK) text. Apply the following rules:

- **Line height:** Use `1.7`–`2.0` for body text (CJK needs more vertical space than Latin)
- **Letter spacing:** Use `0.04em`–`0.08em` for body text (improves Japanese readability)
- **Font fallback:** Always include a Japanese font fallback: `pinSans, "Noto Sans JP", "Hiragino Kaku Gothic ProN", "Yu Gothic", sans-serif`
- **Word break:** Use `word-break: normal` and `overflow-wrap: anywhere` — never `break-all` for Japanese
- **Kinsoku (禁則処理):** Avoid line breaks before closing brackets 」）】 or after opening brackets 「（【
- **Heading line-height:** `1.3`–`1.5` (tighter than body, but looser than Latin headings)
- **Minimum body font size:** `14px` (Japanese characters are complex, smaller is hard to read)

## 4. Component Stylings

### Primary Button

```css
.btn-primary {
  background: #e60023;
  color: #000000;
  border-radius: 16px;
  padding: 6px 14px;
  font-size: 12px;
  font-weight: 400;
  border: 2px solid rgba(255, 255, 255, 0);
  cursor: pointer;
}
```

### Filled Button

```css
.btn-filled {
  background: #e5e5e0;
  color: #000000;
  border-radius: 16px;
  padding: 6px 14px;
  font-size: 12px;
  font-weight: 400;
  border: 2px solid rgba(255, 255, 255, 0);
  cursor: pointer;
}
```

### Filled Button 2

```css
.btn-filled-2 {
  background: #ffffff;
  color: #000000;
  border-radius: 16px;
  padding: 6px 14px;
  font-size: 12px;
  font-weight: 400;
  border: 2px solid rgba(255, 255, 255, 0);
  cursor: pointer;
}
```

### Filled Button 3

```css
.btn-filled-3 {
  background: #ffffff;
  color: #000000;
  border-radius: 0px;
  padding: 0px 0px;
  font-size: 12px;
  font-weight: 400;
  border: none;
  cursor: pointer;
}
```

### Filled Button 4

```css
.btn-filled-4 {
  background: #e60023;
  color: #000000;
  border-radius: 12px;
  padding: 4px 10px;
  font-size: 12px;
  font-weight: 400;
  border: 2px solid rgba(255, 255, 255, 0);
  cursor: pointer;
}
```

### Ghost Button

```css
.btn-ghost {
  background: transparent;
  color: #211922;
  border-radius: 0px;
  padding: 0px 0px;
  font-size: 12px;
  font-weight: 400;
  border: none;
  cursor: pointer;
}
```

## 5. Layout Principles

- **Base spacing unit:** `6px` — use multiples (12px, 18px, 24px, etc.)

### Spacing Scale (extracted from real elements)

| Token | Value | Role |
|---|---|---|
| spacing-1 | `6px` | element |
| spacing-2 | `11px` | element |
| spacing-3 | `4px` | element |
| spacing-4 | `100px` | section |
| spacing-5 | `16px` | element |
| spacing-6 | `32px` | card |

### Border Radius Scale

| Token | Value | Element |
|---|---|---|
| radius-card | `16px` | card |
| radius-card | `20px` | card |
| radius-card | `40px` | card |
| radius-card | `32px` | card |
| radius-card | `28px` | card |
| radius-card | `50px` | card |

## 6. Depth & Elevation

| Level | Shadow | Usage |
|---|---|---|
| Mid | `rgba(0, 0, 0, 0.45) 0px 2px 10px 0px` | Dropdowns, popovers |
| Mid | `rgb(128, 128, 128) 0px 0px 5px 0px` | Dropdowns, popovers |


## 7. Do's and Don'ts

### ✅ Do
- Use `#ffffff` as the primary background color
- Use `pinSans` for all headings and `pinSans` for body text
- Use `#e60023` as the single dominant accent/CTA color
- Maintain `6px` as the base spacing unit — all gaps should be multiples
- Use rounded corners (`16px`+) consistently for all interactive elements
- Embrace bold color combinations — playful energy is the point
- Apply the shadow system for elevation — use the extracted shadow values
- Use weight 600 for headings to match the brand's typographic voice
- Use `line-height: 1.7-2.0` for Japanese body text
- Include Japanese font fallback (Noto Sans JP, Hiragino, Yu Gothic)

### ❌ Don't
- Don't use colors outside the extracted palette without justification
- Don't substitute pinSans/pinSans with generic alternatives
- Don't use irregular spacing — stick to 6px grid
- Don't use dark/black backgrounds — this is a light-themed design
- Don't use sharp corners — they feel hostile in this rounded design language
- Don't use pure black (#000000) for text — use `#211922` instead
- Don't add decorative elements not present in the original design
- Don't use `word-break: break-all` for Japanese text — it breaks in the middle of words
- Don't set body font size below 14px for Japanese — characters are too complex
- Don't use Latin-optimized line-height (1.2-1.4) for Japanese body text

## 8. Responsive Behavior

| Breakpoint | Width | Notes |
|---|---|---|
| Mobile | < 640px | Single column, stack sections, reduce font sizes ~80% |
| Tablet | 640–1024px | 2-column where appropriate, maintain spacing ratios |
| Desktop | 1024–1440px | Full layout as designed |
| Wide | > 1440px | Max-width container, center content |

- Touch targets: minimum 44×44px on mobile
- Maintain 6px base unit across breakpoints — only scale multipliers

## 9. Agent Prompt Guide

### Quick Color Reference

```
Background:  #ffffff
Text:        #211922
Accent:      #e60023
Secondary:   #fa5f2e
Border:      #e5e5e0
```

### Example Prompts

1. "Build a hero section with a `#ffffff` background, `pinSans` heading in `#211922`, and a `#e60023` CTA button with 16px radius."
2. "Create a pricing card using background `#000000`, border `#e5e5e0`, `pinSans` for text, and 18px padding."
3. "Design a navigation bar — `#ffffff` background, `#211922` links, `#e60023` for active state."
4. "Build a feature grid with 3 columns, 18px gap, each card using the card component style."
5. "Create a footer with `#211922` background, `#ffffff` text, and 12px padding."

### Iteration Guide

1. Start with layout structure (sections, grid, spacing)
2. Apply colors from the palette — background first, then text, then accents
3. Set typography — font families, sizes from the type scale, weights
4. Add components — buttons, cards, inputs using the specs above
5. Apply border-radius consistently across all elements
6. Add shadows for depth — use the extracted shadow values, not defaults
7. Check responsive behavior — test mobile and tablet layouts
8. Final pass — verify all colors match, spacing is consistent, fonts are correct
