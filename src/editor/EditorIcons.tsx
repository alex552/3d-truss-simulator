import {
  CirclePlus,
  Eye,
  EyeOff,
  Home,
  Maximize,
  MousePointer2,
  Move,
  Redo2,
  Save,
  Trash2,
  Upload,
  Undo2,
  Waypoints,
  ZoomIn,
  ZoomOut,
} from 'lucide-react'
import type { EditorTool } from './types'

export function RailActionIcon({
  action,
}: {
  action: 'results-on' | 'results-off' | 'undo' | 'redo' | 'save' | 'load' | 'clear'
}) {
  if (action === 'results-on') {
    return <Eye className="tool-icon" aria-hidden="true" />
  }

  if (action === 'results-off') {
    return <EyeOff className="tool-icon" aria-hidden="true" />
  }

  if (action === 'undo') {
    return <Undo2 className="tool-icon" aria-hidden="true" />
  }

  if (action === 'redo') {
    return <Redo2 className="tool-icon" aria-hidden="true" />
  }

  if (action === 'save') {
    return <Save className="tool-icon" aria-hidden="true" />
  }

  if (action === 'load') {
    return <Upload className="tool-icon" aria-hidden="true" />
  }

  return <Trash2 className="tool-icon" aria-hidden="true" />
}

export function ToolIcon({ tool }: { tool: EditorTool }) {
  if (tool === 'select') {
    return <MousePointer2 className="tool-icon" aria-hidden="true" />
  }

  if (tool === 'drag') {
    return <Move className="tool-icon" aria-hidden="true" />
  }

  if (tool === 'node') {
    return <CirclePlus className="tool-icon" aria-hidden="true" />
  }

  return <Waypoints className="tool-icon" aria-hidden="true" />
}

export function ViewControlIcon({
  action,
}: {
  action: 'zoom-in' | 'zoom-out' | 'fit' | 'reset'
}) {
  if (action === 'zoom-in') {
    return <ZoomIn className="tool-icon" aria-hidden="true" />
  }

  if (action === 'zoom-out') {
    return <ZoomOut className="tool-icon" aria-hidden="true" />
  }

  if (action === 'fit') {
    return <Maximize className="tool-icon" aria-hidden="true" />
  }

  return <Home className="tool-icon" aria-hidden="true" />
}
