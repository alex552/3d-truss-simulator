# Truss Playground

Truss Playground is a small proof of concept for sketching a 2D truss, assigning analysis-ready metadata, and visualizing structural feedback directly in the editor.

The current mounted app is the fullscreen 2D editor. The 3D view and analysis panel components still compile and are kept for future re-integration, but they are not currently mounted in `App.tsx`.

## Tech

- React
- TypeScript
- Vite
- React Three Fiber
- `@react-three/drei`
- `lucide-react` for general toolbar/action icons
- Vitest

## Current Features

- Fullscreen 2D CAD-like editor with `Select`, `Drag view`, `Node`, and `Member` tools
- Node placement and dragging with live member and annotation updates
- Member drawing between existing nodes or newly created endpoints
- Node supports:
  - `pinned`
  - `roller-x`
  - `roller-z`
- Legacy persisted `fixed` supports are normalized to pinned behavior
- Node loads:
  - horizontal loads in `kN`
  - vertical loads in `kN`
- Member axial stiffness editing in `kN`
- 2D member length labels in meters
- Stiffness-based analysis feedback for stable models:
  - reactions
  - member force labels
  - scaled displaced shape overlay
- Save/load of `.truss.json` model files
- Undo/redo for model edits

## Data Model

The app intentionally uses a simple plain-object model.

```ts
type Node2D = {
  id: string
  x: number
  y: number
  support?: 'pinned' | 'roller-x' | 'roller-z'
  horizontalLoad?: { magnitudeKn: number; direction: 'left' | 'right' }
  verticalLoad?: { magnitudeKn: number; direction: 'up' | 'down' }
}

type Member = {
  id: string
  nodeAId: string
  nodeBId: string
  axialStiffnessKn: number
}
```

## Interaction Model

### 2D editor

- `Member` tool:
  - click a start point on an existing node or empty space
  - click an end point on an existing node or empty space
  - missing endpoints are created automatically
- `Node` tool:
  - click empty space to place a standalone node
- `Select` tool:
  - click a node or member to select it
  - drag a node to move it
  - `Delete` / `Backspace` removes the selected node or member
- `Drag view` tool:
  - pan the editor canvas
- Mouse wheel zooms around the pointer
- Space + drag temporarily pans the editor
- Right-click deletes nodes and members as a shortcut

### Selected properties

When a node is selected, the in-canvas inspector exposes:

- support assignment
- horizontal load direction and magnitude in `kN`
- vertical load direction and magnitude in `kN`

Setting a load magnitude to `0` clears that load.

When a member is selected, the inspector exposes axial stiffness (`EA`) in `kN`.

## Axes And Units

- The 2D editor represents the `X/Z` plane
- `X` runs horizontally
- `Z` runs vertically
- `Y` points out of the screen
- 2D coordinates map to 3D as `x -> X` and `y -> Z`
- Snap spacing is `0.1 m`

## Project Structure

- `src/App.tsx`: top-level analysis wiring, file save/load, and editor mounting
- `src/editor/useTrussEditorState.ts`: reducer-based editor state, history, selection, and tool behavior
- `src/editor/EditorToolbar.tsx`: in-canvas tool, result, history, save/load, and viewport controls
- `src/editor/EditorInspector.tsx`: selected node/member property editing
- `src/editor/EditorSvgAnnotations.tsx`: support, load, reaction, force, and displacement SVG annotations
- `src/editor/ViewportGrid.tsx`: viewport-aware SVG grid rendering
- `src/model/truss-operations.ts`: pure model mutation helpers
- `src/model/truss-persistence.ts`: `.truss.json` save/load payload and validation helpers
- `src/components/Editor2D.tsx`: editor shell, viewport gestures, SVG scene wiring, and direct manipulation
- `src/components/Truss3DView.tsx`: inactive 3D rendering component kept for later
- `src/components/AnalysisPanel.tsx`: inactive tabular analysis component kept for later
- `src/lib/analysis/index.ts`: truss analysis solver
- `src/styles/editor.css`: editor and SVG scene styles
- `src/styles/analysis.css`: inactive analysis panel styles
- `src/types.ts`: shared plain data types
- `tests/`: unit tests for analysis, editor state, model operations, and persistence

## Getting Started

```bash
npm install
npm run dev
```

Open the local Vite URL shown in the terminal.

## Checks

```bash
npm test
npm run build
```

## Manual Smoke Checklist

- Place nodes
- Draw members
- Drag nodes
- Assign supports and loads
- Edit member stiffness
- Toggle force and deflection result overlays
- Save and reload a model
- Undo and redo changes
