# ls-labbing: notes for AI builders

Plain HTML, CSS and JS: `<script>` tags and globals, no bundler, no framework. Netlify publishes the repo as is (`publish = "."`).

## Styling: Tailwind only

- All styling is Tailwind CSS v4. The source is `css/input.css`; the pages load only `css/output.css`.
- Colours and fonts are theme tokens in `@theme` (`--color-*`, `--font-*`): write `bg-surface`, `text-muted`, `border-border`, `text-accent`, `font-mono`. Never use raw hex values or arbitrary values that read a colour variable.
- Use utility classes in static markup and in JS template strings. A class a script adds must appear in full somewhere in the source (Tailwind scans files as text), so write `cond ? 'a on' : 'a'`, never `'a' + suffix`.
- `@layer components` in `css/input.css` is only for pieces JS builds over and over, or things utilities can't express (keyframes, `::before` driven by JS variables, `details` markers, `::backdrop`, SVG fill/stroke). Write those with `@apply` and theme tokens where possible. Never use `@utility` for classes that JS sets.
- No new `.css` files, no `<style>` blocks, and no inline `style` attributes except values JS computes at run time.
- `js/auth.js` `applyAccent` overrides `--color-accent` and `--color-accent-tint` at run time, so keep `@theme` non-inline.

## Before every commit

1. `npm run build:css`, then commit `css/output.css` with any change to markup, JS-built markup or `css/input.css`.
2. `npm test` must pass (it covers the lab engine, not CSS; check the look in a browser).
