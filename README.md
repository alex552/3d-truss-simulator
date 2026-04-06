# Truss Playground

Truss Playground is a small proof of concept for sketching a 2D truss and viewing the same structure in 3D.

The current app focuses on editor clarity, not simulation. Users can place nodes, create members, assign supports, add node loads in `kN`, and inspect the result in a lightweight 3D view.

## Tech

- React
- TypeScript
- Vite
- React Three Fiber
- `@react-three/drei`

## Current Features

- 2D CAD-like editor with `Select`, `Node`, and `Member` tools
- Node dragging with live member and annotation updates
- Node supports:
  - `fixed`
  - `pinned`
  - `roller-x`
  - `roller-z`
- Node loads:
  - horizontal loads in `kN`
  - vertical loads in `kN`
- 2D member length labels in meters
- 3D truss view with supports and load arrows

## Data Model

The app intentionally uses a simple plain-object model.

```ts
type Node2D = {
  id: string
  x: number
  y: number
  support?: 'fixed' | 'pinned' | 'roller-x' | 'roller-z'
  horizontalLoad?: { magnitudeKn: number; direction: 'left' | 'right' }
  verticalLoad?: { magnitudeKn: number; direction: 'up' | 'down' }
}

type Member = {
  id: string
  nodeAId: string
  nodeBId: string
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
- Right-click still deletes nodes and members as a shortcut

### Selected node properties

When a node is selected, the in-canvas toolbar exposes:

- support assignment
- horizontal load direction and magnitude in `kN`
- vertical load direction and magnitude in `kN`

Setting a load magnitude to `0` clears that load.

## Axes And Units

- The 2D editor represents the `X/Z` plane
- `X` runs horizontally
- `Z` runs vertically
- `Y` points out of the screen
- 2D coordinates map to 3D as `x -> X` and `y -> Z`
- One grid square equals `1 meter`
- The lowest 2D node is mapped to `z = 0` in 3D

## 3D View

- Visible by default
- Can be shown or hidden with the toggle button
- Uses a `Z-up` camera convention
- Orbit controls are constrained to stay on the positive `Z` side
- Renders:
  - nodes
  - members
  - supports
  - node load arrows and labels

## Project Structure

- `src/App.tsx`: top-level editor state and interaction orchestration
- `src/components/Editor2D.tsx`: 2D editor UI, toolbar, SVG rendering, direct manipulation
- `src/components/Truss3DView.tsx`: 3D rendering
- `src/lib/load-placement.ts`: helper for choosing clear load-arrow placement around nodes
- `src/types.ts`: shared plain data types

## Getting Started

```bash
npm install
npm run dev
```

Open the local Vite URL shown in the terminal.

## Build

```bash
npm run build
```

## Notes

- This is still intentionally minimal and does not include structural analysis yet
