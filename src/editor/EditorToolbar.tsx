import type { RefObject } from 'react'
import { RailActionIcon, ToolIcon, ViewControlIcon } from './EditorIcons'
import type { EditorTool } from './types'

const TOOL_OPTIONS: { value: EditorTool; label: string; title: string }[] = [
  { value: 'select', label: 'Select tool', title: 'Select' },
  { value: 'drag', label: 'Drag view tool', title: 'Drag view' },
  { value: 'node', label: 'Node tool', title: 'Place node' },
  { value: 'member', label: 'Member tool', title: 'Draw member' },
]

export function EditorToolbar({
  activeTool,
  showAnyResults,
  showForceResults,
  showDeflectionResults,
  isResultsMenuOpen,
  resultsMenuRef,
  canUndo,
  canRedo,
  onSetActiveTool,
  onToggleResultsMenu,
  onToggleShowForceResults,
  onToggleShowDeflectionResults,
  onUndo,
  onRedo,
  onSaveModel,
  onRequestLoadModel,
  onZoomOut,
  onZoomIn,
  onFitViewport,
  onResetViewport,
}: {
  activeTool: EditorTool
  showAnyResults: boolean
  showForceResults: boolean
  showDeflectionResults: boolean
  isResultsMenuOpen: boolean
  resultsMenuRef: RefObject<HTMLDivElement | null>
  canUndo: boolean
  canRedo: boolean
  onSetActiveTool: (tool: EditorTool) => void
  onToggleResultsMenu: () => void
  onToggleShowForceResults: () => void
  onToggleShowDeflectionResults: () => void
  onUndo: () => void
  onRedo: () => void
  onSaveModel: () => void
  onRequestLoadModel: () => void
  onZoomOut: () => void
  onZoomIn: () => void
  onFitViewport: () => void
  onResetViewport: () => void
}) {
  return (
    <>
      <div className="editor-overlay editor-side-rail" aria-label="2D editor toolbar">
        <div className="editor-tool-cluster">
          {TOOL_OPTIONS.map((tool) => (
            <div key={tool.value} className="editor-tool-item">
              <button
                type="button"
                className={
                  activeTool === tool.value
                    ? 'tool-button rail-button cad-tool-button is-active'
                    : 'tool-button rail-button cad-tool-button'
                }
                onClick={() => onSetActiveTool(tool.value)}
                data-tooltip={tool.title}
                aria-label={tool.label}
                title={tool.title}
              >
                <ToolIcon tool={tool.value} />
              </button>
              {tool.value === 'drag' ? <div className="tool-cluster-divider" aria-hidden="true" /> : null}
            </div>
          ))}
        </div>

        <div className="editor-tool-cluster" aria-label="Results and history controls">
          <div className="results-menu-anchor" ref={resultsMenuRef}>
            <button
              type="button"
              className={
                isResultsMenuOpen || showAnyResults
                  ? 'tool-button rail-button cad-tool-button is-active'
                  : 'tool-button rail-button cad-tool-button'
              }
              onClick={onToggleResultsMenu}
              data-tooltip="Results options"
              aria-label="Results options"
              title="Results options"
              aria-haspopup="menu"
              aria-expanded={isResultsMenuOpen}
            >
              <RailActionIcon action={showAnyResults ? 'results-on' : 'results-off'} />
            </button>

            {isResultsMenuOpen ? (
              <div className="results-submenu" role="menu" aria-label="Result layers">
                <button
                  type="button"
                  role="menuitemcheckbox"
                  aria-checked={showForceResults}
                  className={
                    showForceResults
                      ? 'tool-button results-submenu-item is-active'
                      : 'tool-button results-submenu-item'
                  }
                  onClick={onToggleShowForceResults}
                >
                  <span className="results-submenu-check" aria-hidden="true">
                    {showForceResults ? '✓' : ''}
                  </span>
                  Forces
                </button>

                <button
                  type="button"
                  role="menuitemcheckbox"
                  aria-checked={showDeflectionResults}
                  className={
                    showDeflectionResults
                      ? 'tool-button results-submenu-item is-active'
                      : 'tool-button results-submenu-item'
                  }
                  onClick={onToggleShowDeflectionResults}
                >
                  <span className="results-submenu-check" aria-hidden="true">
                    {showDeflectionResults ? '✓' : ''}
                  </span>
                  Deflections
                </button>
              </div>
            ) : null}
          </div>

          <div className="tool-cluster-divider" aria-hidden="true" />

          <button
            type="button"
            className="tool-button rail-button cad-tool-button"
            onClick={onUndo}
            data-tooltip="Undo"
            aria-label="Undo"
            title="Undo"
            disabled={!canUndo}
          >
            <RailActionIcon action="undo" />
          </button>

          <button
            type="button"
            className="tool-button rail-button cad-tool-button"
            onClick={onRedo}
            data-tooltip="Redo"
            aria-label="Redo"
            title="Redo"
            disabled={!canRedo}
          >
            <RailActionIcon action="redo" />
          </button>

          <div className="tool-cluster-divider" aria-hidden="true" />

          <button
            type="button"
            className="tool-button rail-button cad-tool-button"
            onClick={onSaveModel}
            data-tooltip="Save model"
            aria-label="Save model"
            title="Save model"
          >
            <RailActionIcon action="save" />
          </button>

          <button
            type="button"
            className="tool-button rail-button cad-tool-button"
            onClick={onRequestLoadModel}
            data-tooltip="Load model"
            aria-label="Load model"
            title="Load model"
          >
            <RailActionIcon action="load" />
          </button>
        </div>
      </div>

      <div className="editor-overlay editor-zoom-rail" aria-label="Viewport controls">
        <div className="editor-tool-cluster">
          <button
            type="button"
            className="tool-button rail-button viewport-rail-button"
            onClick={onZoomOut}
            data-tooltip="Zoom out"
            aria-label="Zoom out"
            title="Zoom out"
          >
            <ViewControlIcon action="zoom-out" />
          </button>

          <button
            type="button"
            className="tool-button rail-button viewport-rail-button"
            onClick={onZoomIn}
            data-tooltip="Zoom in"
            aria-label="Zoom in"
            title="Zoom in"
          >
            <ViewControlIcon action="zoom-in" />
          </button>

          <div className="tool-cluster-divider" aria-hidden="true" />

          <button
            type="button"
            className="tool-button rail-button viewport-rail-button"
            onClick={onFitViewport}
            data-tooltip="Fit model to view"
            aria-label="Fit model to view"
            title="Fit model to view"
          >
            <ViewControlIcon action="fit" />
          </button>

          <button
            type="button"
            className="tool-button rail-button viewport-rail-button"
            onClick={onResetViewport}
            data-tooltip="Reset viewport"
            aria-label="Reset viewport"
            title="Reset viewport"
          >
            <ViewControlIcon action="reset" />
          </button>
        </div>
      </div>
    </>
  )
}
