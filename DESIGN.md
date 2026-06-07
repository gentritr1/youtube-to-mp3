---
name: "YT Converter"
description: "A task-first YouTube MP3/MP4 converter with calm themed waiting tools."
colors:
  background: "#0B0C0F"
  foreground: "#F3F5F7"
  card: "#0F1114"
  secondary: "#191A1F"
  muted: "#1F2228"
  muted-foreground: "#7E8695"
  primary: "#F3F5F7"
  primary-foreground: "#111317"
  emerald: "#10B77F"
  amber: "#F59F0A"
  rose: "#E21D48"
  violet: "#895AF6"
  sky: "#0DA2E7"
  border: "#202227"
  ring: "#424957"
  theme-space-background: "#0B101D"
  theme-space-card: "#111522"
  theme-green-background: "#0A1A12"
  theme-frutiger-background: "#DBF6FA"
  theme-frutiger-foreground: "#183B44"
  theme-sunshine-background: "#FFF1E5"
  theme-sunshine-foreground: "#4D3123"
typography:
  display:
    fontFamily: "Manrope, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
    fontSize: "clamp(2rem, 4.4vw, 4.35rem)"
    fontWeight: 800
    lineHeight: 0.95
    letterSpacing: "-0.04em"
  headline:
    fontFamily: "Manrope, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
    fontSize: "1.35rem"
    fontWeight: 800
    lineHeight: 1.15
    letterSpacing: "-0.03em"
  title:
    fontFamily: "Manrope, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
    fontSize: "1.2rem"
    fontWeight: 800
    lineHeight: 1.2
    letterSpacing: "-0.035em"
  body:
    fontFamily: "Manrope, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.6
    letterSpacing: "-0.011em"
  label:
    fontFamily: "Manrope, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
    fontSize: "0.7rem"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "0.08em"
  mono:
    fontFamily: "JetBrains Mono, SF Mono, Fira Code, monospace"
    fontSize: "0.78rem"
    fontWeight: 500
    lineHeight: 1.4
rounded:
  sm: "4px"
  md: "10px"
  lg: "14px"
  xl: "16px"
  control: "16px"
  panel: "24px"
  hero: "26px"
  pill: "999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "20px"
  2xl: "24px"
  3xl: "32px"
  4xl: "40px"
components:
  button-primary:
    backgroundColor: "{colors.sky}"
    textColor: "{colors.primary-foreground}"
    rounded: "{rounded.control}"
    padding: "0 16px"
    height: "52px"
  button-secondary:
    backgroundColor: "{colors.secondary}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.control}"
    padding: "12px 16px"
    height: "48px"
  input-url:
    backgroundColor: "{colors.secondary}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.control}"
    padding: "0 16px"
    height: "52px"
  chip:
    backgroundColor: "{colors.muted}"
    textColor: "{colors.muted-foreground}"
    rounded: "{rounded.pill}"
    padding: "7px 12px"
  card-panel:
    backgroundColor: "{colors.card}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.panel}"
    padding: "20px"
---

# Design System: YT Converter

## 1. Overview

**Creative North Star: "The Cool Waiting Room"**

YT Converter is a product UI first: the conversion task stays dominant, and everything else supports the wait. The visual system should feel playful, fast, and music-oriented without becoming a noisy media portal. Themes add atmosphere, but the URL field, format toggle, progress state, and download action always remain the easiest things to read.

The system uses dark glass panels by default, bright semantic accents, rounded controls, and compact labels. Secondary features such as games, discovery, previews, lyrics, and the time-sync studio should feel like useful rooms beside the main workflow, not competing attractions in the first viewport.

It explicitly rejects interfaces that feel overloaded, noisy, or visually exhausting. If a screen starts to feel like an arcade page, a cluttered download portal, or a banner-heavy media site, it has broken the product contract.

**Key Characteristics:**
- Task-first converter layout with secondary tools kept opt-in.
- Themed atmosphere through semantic tokens, not hardcoded component palettes.
- Rounded glass surfaces with visible borders, restrained glows, and readable text.
- Music-energy details in previews, lyrics, and waiting states.
- Fast state feedback with reduced-motion fallbacks.

## 2. Colors

The palette is themeable glass: dark neutral foundations, bright music accents, and alternate theme overrides that change atmosphere without changing component roles.

### Primary
- **Converter Ink** (`background`): the default app foundation for dark surfaces and page-level contrast.
- **Stage Light** (`foreground`): the main text color for headings, labels, and readable controls.
- **Download Blue** (`sky`): the cool action accent used in gradients, waveform energy, and active highlights.
- **Ready Green** (`emerald`): success, ready, and active conversion energy.

### Secondary
- **Warm Queue Amber** (`amber`): warning, waiting, and rhythm accents where the UI needs warmth.
- **Error Rose** (`rose`): destructive, wrong, failed, or blocked states.
- **Studio Violet** (`violet`): secondary energy in waveforms and ambient highlights. Use it sparingly.

### Tertiary
- **Space Theme** (`theme-space-background`): the default deep blue atmosphere.
- **Canopy Theme** (`theme-green-background`): the saturated green alternate.
- **Aero Theme** (`theme-frutiger-background`): the bright cyan glass alternate.
- **Breeze Theme** (`theme-sunshine-background`): the warm light alternate.

### Neutral
- **Panel Black** (`card`): default card and panel base.
- **Control Charcoal** (`secondary`): input, toggle, and secondary surface base.
- **Muted Slate** (`muted`): quiet control fills and inactive surfaces.
- **Soft Label** (`muted-foreground`): supporting text, helper labels, and inactive copy.
- **Subtle Border** (`border`): component divisions and quiet outlines.
- **Focus Ring** (`ring`): visible keyboard focus and high-attention outlines.

### Named Rules
**The Semantic Theme Rule.** Components consume `css/base.css` semantic tokens and theme overrides in `css/themes/*.css`; never hardcode a palette inside component CSS when a semantic token exists.

**The Accent Budget Rule.** Accents mark primary actions, selected state, progress, success, warning, and errors. They are not wallpaper.

## 3. Typography

**Display Font:** Manrope with system sans fallback
**Body Font:** Manrope with system sans fallback
**Label/Mono Font:** JetBrains Mono for technical metadata, durations, counts, and waveform badges

**Character:** The type system is compact, rounded, and product-like. Manrope carries the interface with high-weight headings and readable body text; JetBrains Mono appears only where the content is data-like.

### Hierarchy
- **Display** (800, `clamp(2rem, 4.4vw, 4.35rem)`, 0.95): hero title and first-viewport value statement only.
- **Headline** (800, `1.35rem`, 1.15): section titles such as discovery and converter modules.
- **Title** (800, `1.2rem`, 1.2): card and sidecar titles.
- **Body** (400-600, `1rem`, 1.6): explanations, helper text, and status descriptions. Prose should stay near 65-75ch where it is not part of a dense control.
- **Label** (700, `0.7rem`, 0.08em, uppercase): compact UI labels, state badges, and short section cues only.
- **Mono** (500-700, `0.78rem`): URLs, durations, counts, ranks, and machine-like status details.

### Named Rules
**The One Sans Rule.** Do not add another display family for product UI. Use Manrope weight, size, and spacing before introducing a new font.

**The Small Uppercase Rule.** Uppercase labels stay short. They are for state and structure, not sentences.

## 4. Elevation

Depth is a hybrid of tonal layering, borders, inset highlights, blur, and restrained shadows. Cards and controls often pair glass backgrounds with a single border and an inset highlight; larger panels earn ambient shadows because they sit above themed backgrounds.

### Shadow Vocabulary
- **Panel Shadow** (`--shadow-panel`): large feature panels such as discovery, batch, and sidecar containers.
- **Card Hover Shadow** (`--shadow-card-hover`): video cards and interactive preview items on hover.
- **Float Shadow** (`--shadow-float`): small floating controls and badges.
- **Input Inset** (`--shadow-input-inset`): URL fields and glass inputs.
- **Glow Shadow** (`--shadow-glow`): rare semantic glow for successful or active music states.

### Named Rules
**The Lift Means State Rule.** Hover lift and extra shadow only appear on interactive surfaces. Static decoration should stay flat enough that users know where to click.

**The Glass With Restraint Rule.** Blur and glow are allowed because the product already uses glass themes, but every glass surface needs readable text, a visible border, and a clear purpose.

## 5. Components

### Buttons
- **Shape:** softly rounded controls (`16px`) with pill badges only for compact chips.
- **Primary:** gradient action buttons use `--button-primary`, `--button-primary-foreground`, 52px height, strong weight, and a subtle top sheen.
- **Hover / Focus:** hover uses a small `--hover-lift`, explicit transition properties, and semantic border or shadow shifts. Focus uses the shared `:focus-visible` ring.
- **Secondary / Ghost:** glass controls use `--button-glass-foreground`, `--button-glass-muted-foreground`, surface borders, and lower shadow.

### Chips
- **Style:** pills use semantic surface overlays, compact padding, bold 0.7-0.84rem labels, and small swatches or icons when they aid scanning.
- **State:** selected chips switch foreground tokens and accent-tinted backgrounds. Inactive chips must stay readable in all four themes.

### Cards / Containers
- **Corner Style:** panels use 24px to 28px radii; smaller cards use 16px to 18px.
- **Background:** surfaces combine `--card`, `--hero-surface-strong`, `--surface-glass`, and theme-specific overlays.
- **Shadow Strategy:** large panels use ambient panel shadows; cards use hover shadows only when interactive.
- **Border:** one-pixel semantic borders are standard. Colored side stripes are prohibited.
- **Internal Padding:** use the shared spacing scale, usually 16px to 24px for cards and 12px to 16px for compact controls.

### Inputs / Fields
- **Style:** URL fields use 52px height, 16px radius, glass background, one-pixel border, and inset shadow.
- **Focus:** focus shifts border color to `--ring` and adds the shared focus outline. Placeholder text must remain readable across themes.
- **Error / Disabled:** error states use semantic rose/destructive tokens; disabled states use `--button-disabled-foreground` and cursor changes, not opacity alone.

### Navigation
- **Style:** the theme switcher is the primary navigation-like control: pill chips with swatches, compact labels, active tint, and visible keyboard focus.
- **Mobile:** chips wrap left on narrow viewports. They should not force horizontal overflow or hide focus rings inside clipped rails.

### Signature Component
The discovery preview player is the signature music component. It combines a compact thumbnail, metadata, waveform energy colors, progress overlays, and playhead glow. Keep it visually richer than a normal card, but never more important than the converter form unless the user explicitly opens or plays a preview.

## 6. Do's and Don'ts

### Do:
- **Do** keep the URL input, format choice, and Convert action dominant in the first viewport.
- **Do** use `css/base.css` spacing, radius, focus, control, and motion tokens before adding one-off values.
- **Do** verify every touched control in `space`, `green`, `frutiger-aero`, and `sunshine`.
- **Do** keep games, discovery, lyrics, and studio affordances visibly secondary until the user chooses them.
- **Do** use explicit transition properties and preserve reduced-motion behavior.

### Don't:
- **Don't** create an interface that feels overloaded, noisy, or visually exhausting.
- **Don't** make the product look like a cluttered download portal, a banner-heavy media site, or an arcade page where games and effects compete with conversion.
- **Don't** hardcode component palettes when semantic theme tokens already exist.
- **Don't** use `transition: all`.
- **Don't** use colored side-stripe borders, gradient text, or decorative motion that does not communicate state.
- **Don't** let inactive states use full-saturation accents or unreadable muted text.
