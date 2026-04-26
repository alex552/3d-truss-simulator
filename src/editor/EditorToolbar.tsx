import {
  autoUpdate,
  flip,
  FloatingPortal,
  offset,
  shift,
  useClick,
  useDismiss,
  useFloating,
  useFocus,
  useHover,
  useInteractions,
  useRole,
} from '@floating-ui/react'
import { useState, type ButtonHTMLAttributes, type ReactNode } from 'react'
import { RailActionIcon, ToolIcon, ViewControlIcon } from './EditorIcons'
import type { EditorTool } from './types'

const TOOL_OPTIONS: { value: EditorTool; label: string; title: string }[] = [
  { value: 'select', label: 'Select tool', title: 'Select' },
  { value: 'drag', label: 'Drag view tool', title: 'Drag view' },
  { value: 'node', label: 'Node tool', title: 'Place node' },
  { value: 'member', label: 'Member tool', title: 'Draw member' },
]

function ToolbarButton({
  tooltip,
  children,
  disabled,
  ...buttonProps
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  tooltip: string
  children: ReactNode
}) {
  const [isTooltipOpen, setIsTooltipOpen] = useState(false)
  const { refs, floatingStyles, context } = useFloating({
    open: isTooltipOpen,
    onOpenChange: setIsTooltipOpen,
    placement: 'right',
    whileElementsMounted: autoUpdate,
    middleware: [
      offset(8),
      flip({ fallbackPlacements: ['left', 'top', 'bottom'] }),
      shift({ padding: 8 }),
    ],
  })
  const hover = useHover(context, {
    enabled: !disabled,
    delay: { open: 250, close: 0 },
  })
  const focus = useFocus(context, { enabled: !disabled })
  const { getReferenceProps, getFloatingProps } = useInteractions([hover, focus])

  return (
    <>
      <button
        ref={refs.setReference}
        type="button"
        disabled={disabled}
        {...getReferenceProps(buttonProps)}
      >
        {children}
      </button>
      {isTooltipOpen ? (
        <FloatingPortal>
          <div
            ref={refs.setFloating}
            className="floating-tooltip"
            style={floatingStyles}
            {...getFloatingProps()}
          >
            {tooltip}
          </div>
        </FloatingPortal>
      ) : null}
    </>
  )
}

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
              <ToolbarButton
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
              </ToolbarButton>
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

          <ToolbarButton
            className="tool-button rail-button cad-tool-button"
            onClick={onUndo}
            aria-label="Undo"
            disabled={!canUndo}
            tooltip="Undo"
          >
            <RailActionIcon action="undo" />
          </ToolbarButton>

          <ToolbarButton
            className="tool-button rail-button cad-tool-button"
            onClick={onRedo}
            aria-label="Redo"
            disabled={!canRedo}
            tooltip="Redo"
          >
            <RailActionIcon action="redo" />
          </ToolbarButton>

          <div className="tool-cluster-divider" aria-hidden="true" />

          <ToolbarButton
            className="tool-button rail-button cad-tool-button"
            onClick={onSaveModel}
            aria-label="Save model"
            tooltip="Save model"
          >
            <RailActionIcon action="save" />
          </ToolbarButton>

          <ToolbarButton
            className="tool-button rail-button cad-tool-button"
            onClick={onRequestLoadModel}
            aria-label="Load model"
            tooltip="Load model"
          >
            <RailActionIcon action="load" />
          </ToolbarButton>
        </div>
      </div>

      <div className="editor-overlay editor-zoom-rail" aria-label="Viewport controls">
        <div className="editor-tool-cluster">
          <ToolbarButton
            className="tool-button rail-button viewport-rail-button"
            onClick={onZoomOut}
            aria-label="Zoom out"
            tooltip="Zoom out"
          >
            <ViewControlIcon action="zoom-out" />
          </ToolbarButton>

          <ToolbarButton
            className="tool-button rail-button viewport-rail-button"
            onClick={onZoomIn}
            aria-label="Zoom in"
            tooltip="Zoom in"
          >
            <ViewControlIcon action="zoom-in" />
          </ToolbarButton>

          <div className="tool-cluster-divider" aria-hidden="true" />

          <ToolbarButton
            className="tool-button rail-button viewport-rail-button"
            onClick={onFitViewport}
            aria-label="Fit model to view"
            tooltip="Fit model to view"
          >
            <ViewControlIcon action="fit" />
          </ToolbarButton>

          <ToolbarButton
            className="tool-button rail-button viewport-rail-button"
            onClick={onResetViewport}
            aria-label="Reset viewport"
            tooltip="Reset viewport"
          >
            <ViewControlIcon action="reset" />
          </ToolbarButton>
        </div>
      </div>
    </>
  )
}
