# Agent Instructions

Use this file before making changes in this repository.

## UI And Design Source Of Truth

For any UI, styling, layout, animation, interaction, theme, accessibility, or visual polish work:

1. Treat the `impeccable` design skill as the primary design reference when it is available in the working environment.
2. If the skill is not installed, attempt to install or inspect it with the project-level command requested for this repo:

   ```bash
   npx impeccable skills install .
   ```

3. If `npx`, `npm`, network access, or the skill itself is unavailable, document that blocker in the work summary and continue using `docs/CODEBASE_GUIDE.md` as the local design-system contract.
4. Do not introduce a new framework, component library, CSS preprocessor, or wholesale visual rewrite just to follow external guidance. Apply the guidance through the existing vanilla HTML/CSS/JS architecture.

## Required Design Constraints

- Preserve the existing page structure unless the user explicitly asks for a layout redesign.
- Use `css/base.css` non-color tokens for shared spacing, control sizes, radii, focus rings, hover lift, and motion timing.
- Use semantic color tokens and theme overrides rather than hardcoded component palettes.
- Keep component styles in `css/components/*`, layout rules in `css/layout/*`, and theme-specific values in `css/themes/*`.
- Every new or touched interactive control must have visible keyboard focus.
- Do not use `transition: all`.
- Respect `prefers-reduced-motion: reduce`; decorative motion should calm down without breaking state changes.
- Verify affected UI across all themes: `space`, `green`, `frutiger-aero`, and `sunshine`.

## Documentation

Update the relevant docs whenever UI/design behavior changes:

- `docs/CODEBASE_GUIDE.md` for durable design-system rules.
- `docs/RUNTIME_VERIFICATION.md` for browser and visual QA coverage.
- `docs/TESTING_STATUS.md` for temporary toolchain blockers or current verification status.
