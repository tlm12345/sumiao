# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

- `npm run dev` — Start the Vite dev server.
- `npm run build` — Type-check and build for production.
- `npm run build-only` — Build without type-checking.
- `npm run type-check` — Run `vue-tsc --build` only.
- `npm run preview` — Preview the production build locally.

There are no test or lint scripts configured in this project.

## Architecture

**Stack**: Vue 3 (Composition API, `<script setup>`) + TypeScript + Vite.

**Application goal**: A sketch coloring tool with two modes:
- `segment` — Flood-fill ("magic wand") selection of similar-color regions to create masks.
- `fill` — Click a mask to apply a color from a light/dark palette.

### State & Data Flow

`App.vue` is the central coordinator. It holds the uploaded `ImageData`, the current `mode`, the `threshold` for flood fill, and the selected mask for filling. It delegates domain logic to composables and passes derived state down to view components.

### Coordinate Systems

All masks are stored in **original image coordinates** as `Set<number>` where each value is the flattened pixel index `y * width + x`.

`ImageCanvas.vue` emits `pixelClick` as **screen coordinates** (`{x, y}` relative to the canvas element). `App.vue` converts these to image coordinates via `useImageScale().screenToImage()` before running flood fill or mask lookup. Any canvas rendering that draws masks also applies `ctx.translate(offset.x, offset.y)` and `ctx.scale(scale, scale)` so masks are drawn in image space.

### Performance Design

- **Reverse index**: `useMasks` maintains a `pixelToMask` Map for O(1) lookup of which mask owns a given pixel index. When pixels are added to a mask, they are first removed from any previous mask.
- **Screen-space caching**: `useScreenMasks` precomputes a screen-coordinate representation of visible masks (including bounds and a `Set<string>` of `"x,y"` pixels). It invalidates this cache when `scale` or `offset` changes and regenerates it on the next hit-test. This avoids repeated per-pixel coordinate math during fill-mode interaction.

### Rendering

`ImageCanvas` renders everything on a 2D canvas:
1. Creates an offscreen temporary canvas to hold the uploaded `ImageData`.
2. Draws the image through the current transform.
3. Draws mask overlays by iterating `mask.pixels` and calling `ctx.fillRect(x, y, 1, 1)` for each pixel.
   - Active mask in `segment` mode is tinted light blue.
   - Filled masks draw their `fillColor` at 50% opacity.

### Mode Behaviors

- **Segment mode**: Clicking an unmasked pixel runs flood fill and either creates a new mask or adds pixels to the currently active mask. If the user zooms while a mask is active (`segmentStartScale` tracks this), the active mask is automatically deselected.
- **Fill mode**: Clicking deselects the previous fill target and selects the mask under the cursor. `ColorPalette` applies the chosen color to `clickedMaskId`.

### Key Files

- `src/App.vue` — Top-level state and mode switching.
- `src/components/ImageCanvas.vue` — Canvas rendering, panning, zooming, and click emit.
- `src/composables/useFloodFill.ts` — BFS flood fill using 8-connected neighbors and squared Euclidean color distance against a threshold.
- `src/composables/useMasks.ts` — Mask CRUD, reverse index, and pixel ownership rules.
- `src/composables/useImageScale.ts` — Container-to-image coordinate math and zoom state.
- `src/composables/useScreenMasks.ts` — Screen-coordinate cache for fast hit-testing.
- `src/types/index.ts` — Core types including `Mask`, `Mode`, and `Point`.
- `src/utils/color.ts` — Pixel color extraction, distance helpers, and the palette definition.
