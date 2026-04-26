import {
  autoUpdate,
  flip,
  FloatingPortal,
  offset,
  shift,
  useClick,
  useDismiss,
  useFloating,
  useInteractions,
  useRole,
} from '@floating-ui/react'
import { RailActionIcon, ToolIcon, ViewControlIcon } from './EditorIcons'
import { EditorTooltipButton } from './EditorTooltipButton'
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
  canUndo,
  canRedo,
  onSetActiveTool,
  onSetResultsMenuOpen,
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
  canUndo: boolean
  canRedo: boolean
  onSetActiveTool: (tool: EditorTool) => void
  onSetResultsMenuOpen: (isOpen: boolean) => void
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
  const {
    refs: resultsMenuRefs,
    floatingStyles: resultsMenuStyles,
    context: resultsMenuContext,
  } = useFloating({
    open: isResultsMenuOpen,
    onOpenChange: onSetResultsMenuOpen,
    placement: 'right-start',
    whileElementsMounted: autoUpdate,
    middleware: [
      offset(10),
      flip({ fallbackPlacements: ['left-start', 'right-end', 'left-end'] }),
      shift({ padding: 8 }),
    ],
  })
  const resultsMenuClick = useClick(resultsMenuContext)
  const resultsMenuDismiss = useDismiss(resultsMenuContext)
  const resultsMenuRole = useRole(resultsMenuContext, { role: 'menu' })
  const { getReferenceProps: getResultsReferenceProps, getFloatingProps: getResultsFloatingProps } =
    useInteractions([resultsMenuClick, resultsMenuDismiss, resultsMenuRole])

  return (
    <>
      <div className="editor-overlay editor-side-rail" aria-label="2D editor toolbar">
        <div className="editor-tool-cluster">
          {TOOL_OPTIONS.map((tool) => (
            <div key={tool.value} className="editor-tool-item">
              <EditorTooltipButton
                className={
                  activeTool === tool.value
                    ? 'tool-button rail-button cad-tool-button is-active'
                    : 'tool-button rail-button cad-tool-button'
                }
                onClick={() => onSetActiveTool(tool.value)}
                aria-label={tool.label}
                tooltip={tool.title}
              >
                <ToolIcon tool={tool.value} />
              </EditorTooltipButton>
              {tool.value === 'drag' ? <div className="tool-cluster-divider" aria-hidden="true" /> : null}
            </div>
          ))}
        </div>

        <div className="editor-tool-cluster" aria-label="Results and history controls">
          <div className="results-menu-anchor">
            <button
              ref={resultsMenuRefs.setReference}
              type="button"
              className={
                isResultsMenuOpen || showAnyResults
                  ? 'tool-button rail-button cad-tool-button is-active'
                  : 'tool-button rail-button cad-tool-button'
              }
              aria-label="Results options"
              aria-haspopup="menu"
              aria-expanded={isResultsMenuOpen}
              {...getResultsReferenceProps()}
            >
              <RailActionIcon action={showAnyResults ? 'results-on' : 'results-off'} />
            </button>

            {isResultsMenuOpen ? (
              <FloatingPortal>
                <div
                  ref={resultsMenuRefs.setFloating}
                  className="results-submenu"
                  style={resultsMenuStyles}
                  aria-label="Result layers"
                  {...getResultsFloatingProps()}
                >
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
              </FloatingPortal>
            ) : null}
          </div>

          <div className="tool-cluster-divider" aria-hidden="true" />

          <EditorTooltipButton
            className="tool-button rail-button cad-tool-button"
            onClick={onUndo}
            aria-label="Undo"
            disabled={!canUndo}
            tooltip="Undo"
          >
            <RailActionIcon action="undo" />
          </EditorTooltipButton>

          <EditorTooltipButton
            className="tool-button rail-button cad-tool-button"
            onClick={onRedo}
            aria-label="Redo"
            disabled={!canRedo}
            tooltip="Redo"
          >
            <RailActionIcon action="redo" />
          </EditorTooltipButton>

          <div className="tool-cluster-divider" aria-hidden="true" />

          <EditorTooltipButton
            className="tool-button rail-button cad-tool-button"
            onClick={onSaveModel}
            aria-label="Save model"
            tooltip="Save model"
          >
            <RailActionIcon action="save" />
          </EditorTooltipButton>

          <EditorTooltipButton
            className="tool-button rail-button cad-tool-button"
            onClick={onRequestLoadModel}
            aria-label="Load model"
            tooltip="Load model"
          >
            <RailActionIcon action="load" />
          </EditorTooltipButton>
        </div>
      </div>

      <div className="editor-overlay editor-zoom-rail" aria-label="Viewport controls">
        <div className="editor-tool-cluster">
          <EditorTooltipButton
            className="tool-button rail-button viewport-rail-button"
            onClick={onZoomOut}
            aria-label="Zoom out"
            tooltip="Zoom out"
          >
            <ViewControlIcon action="zoom-out" />
          </EditorTooltipButton>

          <EditorTooltipButton
            className="tool-button rail-button viewport-rail-button"
            onClick={onZoomIn}
            aria-label="Zoom in"
            tooltip="Zoom in"
          >
            <ViewControlIcon action="zoom-in" />
          </EditorTooltipButton>

          <div className="tool-cluster-divider" aria-hidden="true" />

          <EditorTooltipButton
            className="tool-button rail-button viewport-rail-button"
            onClick={onFitViewport}
            aria-label="Fit model to view"
            tooltip="Fit model to view"
          >
            <ViewControlIcon action="fit" />
          </EditorTooltipButton>

          <EditorTooltipButton
            className="tool-button rail-button viewport-rail-button"
            onClick={onResetViewport}
            aria-label="Reset viewport"
            tooltip="Reset viewport"
          >
            <ViewControlIcon action="reset" />
          </EditorTooltipButton>
        </div>
      </div>
    </>
  )
}
