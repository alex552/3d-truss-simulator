# Truss Playground

Small proof of concept for drawing a simple truss in 2D and viewing the same structure in 3D.

## Tech

- React
- TypeScript
- Vite
- React Three Fiber
- `@react-three/drei`

## What It Does

- Draw nodes and members in a simple 2D editor
- Show member lengths in meters in the 2D view
- Render the same truss in a simple 3D scene
- Orbit the 3D camera with a constrained Z-up view

## Current Interaction Model

### 2D editor

- Click once to start a member
- Move the mouse to preview the member and its length
- Click again to finish the member
- Clicking empty space creates a new node
- Clicking an existing node uses that node as the start or end of the member
- Right-click a node to delete it
- Right-click a member to delete it

### Axes and units

- The 2D editor represents the X/Z plane
- X runs horizontally
- Z runs vertically
- Y points out of the screen
- One grid square equals 1 meter
- Finished members keep their length labels visible

### 3D view

- The 3D panel is visible by default
- Use the toggle button to show or hide the 3D panel
- 2D points are mapped into 3D as X/Z coordinates
- The lowest 2D node is placed at `z = 0` in 3D
- The 3D camera uses Z-up orientation
- Orbit controls are restricted to stay on the positive Z side

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

- This is intentionally minimal and does not include physics or simulation yet
- The production build currently succeeds with a non-blocking bundle size warning from the Three.js stack
