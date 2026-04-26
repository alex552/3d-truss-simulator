# AGENTS.md

Quick handoff guide for agents working in this repository.

## Project Goal

Build a clear, minimal truss playground for sketching a 2D truss, assigning
analysis-ready metadata, and visualizing structural feedback directly in the
editor.

The current priority is editor usability, visual clarity, and small reliable
analysis feedback. Keep the app approachable; avoid turning it into a full CAD
or structural design package unless a task explicitly asks for that direction.

## Current State

The mounted app is a fullscreen 2D editor. The 3D mirror component still
compiles and is kept for future re-integration, but it is not currently mounted
from `src/App.tsx`.

The app supports:

- placing and moving nodes
- drawing members between existing or newly created nodes
- assigning pinned, `roller-x`, and `roller-z` supports to nodes
- assigning horizontal and vertical node loads in `kN`
- editing member axial stiffness in `kN`
- displaying member length labels in meters
- stiffness-based analysis feedback for stable models:
  - reactions
  - member force labels
  - scaled displaced shape overlay
- save/load of `.truss.json` model files
- undo/redo for model edits

## Important Conventions

- The 2D editor represents the `X/Z` plane.
- `x` in the editor maps to world `X`.
- `y` in the editor maps to world `Z`; analysis converts screen-down `y` into
  positive/negative `Z` as needed.
- `Y` is out of plane.
- Snap spacing is `0.1 m`.
- Loads and supports are node-owned metadata.
- Members are simple connections by node id.
- Members carry `axialStiffnessKn`; use the shared default in
  `src/lib/truss-model.ts` when creating members.
- Legacy persisted `fixed` supports are normalized to pinned behavior.

## Main Files

- `src/App.tsx`
  - mounts the 2D editor
  - owns save/load browser file wiring
  - runs `analyzeTruss`
  - handles delete/backspace keyboard deletion
- `src/components/Editor2D.tsx`
  - editor shell, SVG scene wiring, viewport gestures, panning/zooming, and
    direct manipulation
- `src/editor/useTrussEditorState.ts`
  - reducer-backed editor state
  - tool selection, selected entity, member drawing flow, history, and model
    mutations
- `src/editor/EditorToolbar.tsx`
  - in-canvas tool, result, history, save/load, and viewport controls
- `src/editor/EditorInspector.tsx`
  - selected node/member property editing
- `src/editor/EditorSvgAnnotations.tsx`
  - support, load, reaction, force, and displacement SVG annotations
- `src/editor/ViewportGrid.tsx`
  - viewport-aware SVG grid rendering
- `src/model/truss-operations.ts`
  - pure model mutation helpers
- `src/model/truss-persistence.ts`
  - `.truss.json` persistence payloads and validation
- `src/lib/analysis/index.ts`
  - stiffness-based truss analysis
- `src/components/Truss3DView.tsx`
  - inactive 3D rendering component kept for later
- `src/types.ts`
  - shared plain data types
- `tests/`
  - unit tests for analysis, editor state, model operations, and persistence

## Design Guidance

- Keep the app small and direct.
- Preserve the current CAD-like 2D controls.
- Prefer simple plain objects over abstractions.
- Favor visual clarity over cleverness.
- Add behavior in the existing editor flow before introducing new architecture.
- Keep 2D, analysis, and eventual 3D conventions aligned.
- If adding annotations, keep them secondary to the structure itself.
- Do not introduce global state libraries for current-scale editor state.

## Editing Guidance

- Keep types explicit and local.
- Put pure model changes in `src/model/truss-operations.ts` when practical.
- Put editor interaction state changes in `src/editor/useTrussEditorState.ts`.
- Put visual SVG annotation changes in `src/editor/EditorSvgAnnotations.tsx`.
- If a feature changes geometry meaning, update the editor, analysis, and the
  3D component if relevant.
- Reuse shared helpers such as support normalization and stiffness defaults from
  `src/lib/truss-model.ts`.
- Keep persisted model compatibility in mind; update
  `src/model/truss-persistence.ts` and tests when model shape changes.
- Public repository rule: do not add secrets, credentials, private paths, or
  machine-specific setup details.

## Checks

Run focused tests when touching behavior:

```bash
npm test
npm run build
```

Useful manual smoke checks:

- place nodes
- draw members
- drag nodes
- assign supports and loads
- edit member stiffness
- toggle force and deflection overlays
- save and reload a model
- undo and redo changes

## Near-Term Likely Work

Good next steps include:

- improving annotation clarity
- refining node/member editing UX
- re-integrating the 3D view once the 2D workflow is settled
- expanding analysis metadata and result presentation
- improving model validation and error messaging

Avoid jumping to a broad solver or design-code workflow unless the task
explicitly asks for it.
