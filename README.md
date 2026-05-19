# Optical Capsule

A zero-dependency browser toolkit for designing **glass / resin capsule buttons** on the web. Highlights are baked from a sampled height field, surface normals, Fresnel rim, specular thresholds, and layered Canvas textures—applied to real `<button>` elements, not a WebGL scene.

**Author:** Yu Fei · personal project by [**@inserter**](https://github.com/inserter)

## Features

- **Optical baking** — Multi-light rig, IOR, transmission, absorption, dispersion, **up to four internal round-trips** (bottom Fresnel + march to top + exit or TIR) feeding the transmission pocket layer, plus contact shadows
- **Button spec rig** — Capsule geometry plus customizable outer / inner edge strokes and inset ring
- **Background rig** — Solid, radial, grid, dots, brushed, or image URL environments (image mode lightens cavity fill and boosts backdrop blur so the photo shows through the capsule face)
- **Orthographic views** — X–Y top view plus X–Z / Y–Z sections with incident, refracted, and shadow paths (demo page)
- **Backdrop displacement** — Optional checkbox under Material Rig: SVG `feDisplacementMap` chained in `backdrop-filter` (IOR-scaled strength; WebKit-first)
- **Size scale** — Seven breakpoints from `xxs` to `xxl` driven by the same global parameters (demo page)
- **Presentation overlay (demo)** — After orthographic views: **four xs columns** (Rest / Hover / Pressed / Inactive), each with its own sliders (opacity, brightness, saturation, glow, **button tint color + strength**). Scoped CSS variables — **does not rebake** optics.

## Project structure

| File | Role |
|------|------|
| `index.html` | Demo page shell: control panels, preview stages, cross-section host |
| `app.css` | Demo chrome: page layout, background modes, control panels, cross-section panel |
| `app.js` | Demo app: rig state (`sceneMaterial`, `sceneLighting`, …), form wiring, `scheduleRenderAll` |
| `OpticalCapsule.css` | Reusable capsule UI: stages, underlay, `.optical-capsule`, optical SVG layers, size tokens |
| `OpticalCapsule.js` | Core engine: `createOpticalCapsuleCore(getRigs)`, bake pipeline, `renderStage`, `makeUnderlay` / SVG layers |
| `package.json` | `"type": "module"` so Node can syntax-check / import the ES modules |

Integrating into another page: include `OpticalCapsule.css`, add the SVG filter block (see `index.html`), host `.capsule-stage` markup, and call `createOpticalCapsuleCore(() => ({ material, lighting, buttonSpec, shell, background, label }))` with your own rig objects and `renderStage` on resize or when rigs change.

## Quick start

Use a local static server (recommended). ES modules and imports require **http(s)**—not `file://`.

```bash
cd "/path/to/optical-capsule"
python3 -m http.server 8080
# or: npx serve .
```

Open [http://localhost:8080/index.html](http://localhost:8080/index.html)

Add `?debug=1` to print bake timings in the browser console while tuning rigs.

Optional: `node -e "import('./OpticalCapsule.js')"` from the project root checks module syntax.

## Workflow

1. Tune **Background Rig**, **Global Light Rig**, **Material Rig** (presets: Glass, Crystal, Diamond, Ruby, Sapphire, …), and **Button Spec Rig** in the demo UI. Optionally enable **Backdrop displacement** under Material Rig.
2. Use **Presentation states** (four xs columns below orthographic diagrams) to tune purely CSS overlays per stance — optics stay unchanged.
3. The demo script bakes optical layers for every `.capsule-stage` and updates the orthographic diagrams.
4. For production, copy rig defaults from `app.js` into your app and import only `OpticalCapsule.js` + `OpticalCapsule.css`, or build presets on top of `getRigs()`.

## Tech notes

- No build step beyond static hosting — vanilla DOM, Canvas 2D, and SVG (ES modules in the browser).
- Renders are debounced (~80ms) on control input; window `resize` triggers a full rebake.
- Internal transmission pocket: `internalMultiBounceEnergy()` traces **up to four** bottom→top cycles per light (Schlick Fresnel at flat base and at upper surface; Snell exit with TIR fall back to reflection and continue).
- **Backdrop displacement:** `#oc-backdrop-displace` in the page SVG feeds `backdrop-filter: url(#oc-backdrop-displace)` on `.optical-capsule` when `material.backdropDisplaceTry` is true; `feDisplacementMap/@scale` is driven from **IOR** (`(ior - 1) * 18 + 4`, clamped). Best tested in **Safari / WebKit**; Chromium may ignore or partially apply `url()` on `backdrop-filter`.

## Live demo

Repository: **[inserter/OpticalCapsule](https://github.com/inserter/OpticalCapsule)**. Enable [GitHub Pages](https://pages.github.com/) under **Settings → Pages** with source **Deploy from branch** → **`main`** → **`/` (root)**, wait for the deployment to finish.

Then open (path matches the **repository name**, including capitals):

**[https://inserter.github.io/OpticalCapsule/](https://inserter.github.io/OpticalCapsule/)**

(`index.html` is optional: `…/OpticalCapsule/index.html` is the same home page.)

If `https://inserter.github.io/optical-capsule/…` 404s, that path is wrong for this repo — use **`OpticalCapsule`** in the URL, not `optical-capsule`.

## License

Copyright © 2026 Yu Fei. Released under the [GNU Affero General Public License v3.0](LICENSE) (AGPL-3.0).

If you modify this project and run it as a network service (for example, a hosted demo or SaaS), you must offer corresponding source to users interacting with it over the network, as required by AGPL-3.0 Section 13.
