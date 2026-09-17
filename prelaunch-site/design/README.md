# Design reference

## `tokens.json`
Colours, type scale, spacing, radii and elevation for the app screens. The
canvas is **375 × 812** — iOS logical pixels — so every value is a Flutter
logical pixel and ports to the app without re-derivation.

`public/screens.css` mirrors these values. Change one, change the other.

## `reference-screens/`
The original mockup crops. These are **no longer used by the site** — the
screens on the landing page are built from real markup (`public/screens.css`
plus the `.pv` markup in `index.html`) so they stay sharp at any pixel
density. Kept here as the visual reference the rebuild was made from.

`product-result.png` also stays in `public/assets/screens/` because the
`og:image` social preview needs a real raster file.

## Porting a screen to Flutter
1. Read the component in `public/screens.css` — `.pv-card`, `.pv-chip`,
   `.pv-row`, `.pv-ring` and so on map one-to-one to widgets.
2. Take the numbers as-is; they are logical pixels at the 375-wide canvas.
3. Take colours from `tokens.json`, not from the CSS, so both stay in step.
