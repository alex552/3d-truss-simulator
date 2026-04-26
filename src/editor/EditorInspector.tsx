import type {
  HorizontalLoadDirection,
  Member,
  Node2D,
  SupportType,
  VerticalLoadDirection,
} from '../types'
import { EditorTooltipButton } from './EditorTooltipButton'

const SUPPORT_OPTIONS: { value: SupportType | undefined; label: string; title: string }[] = [
  { value: undefined, label: 'No support', title: 'None' },
  { value: 'pinned', label: 'Pinned support', title: 'Pinned' },
  { value: 'roller-x', label: 'Roller X support', title: 'Roller X' },
  { value: 'roller-z', label: 'Roller Z support', title: 'Roller Z' },
]

const horizontalDirectionOptions: HorizontalLoadDirection[] = ['left', 'right']
const verticalDirectionOptions: VerticalLoadDirection[] = ['up', 'down']

export function EditorInspector({
  selectedNode,
  selectedMember,
  selectedNodeSupport,
  selectedHorizontalLoad,
  selectedVerticalLoad,
  onSetSelectedNodeSupport,
  onSetSelectedMemberAxialStiffness,
  onSetSelectedNodeHorizontalLoad,
  onSetSelectedNodeVerticalLoad,
  onHorizontalMagnitudeChange,
  onVerticalMagnitudeChange,
}: {
  selectedNode: Node2D | null
  selectedMember: Member | null
  selectedNodeSupport: SupportType | undefined
  selectedHorizontalLoad: Node2D['horizontalLoad']
  selectedVerticalLoad: Node2D['verticalLoad']
  onSetSelectedNodeSupport: (support: SupportType | undefined) => void
  onSetSelectedMemberAxialStiffness: (axialStiffnessKn: number) => void
  onSetSelectedNodeHorizontalLoad: (
    magnitudeKn: number,
    direction: HorizontalLoadDirection,
  ) => void
  onSetSelectedNodeVerticalLoad: (
    magnitudeKn: number,
    direction: VerticalLoadDirection,
  ) => void
  onHorizontalMagnitudeChange: (value: string) => void
  onVerticalMagnitudeChange: (value: string) => void
}) {
  if (selectedNode) {
    return (
      <div className="editor-overlay editor-inspector" aria-label="Selected node properties">
        <div className="inspector-header">
          <span className="inspector-eyebrow">Node</span>
          <span className="inspector-title">Selected node</span>
        </div>

        <div className="node-properties">
          <div className="inspector-section" aria-label="Selected node supports">
            <span className="inspector-label">Support</span>
            <div className="support-chip-group">
              {SUPPORT_OPTIONS.map((option) => (
                <EditorTooltipButton
                  key={option.title}
                  className={
                    selectedNodeSupport === option.value ||
                    (selectedNodeSupport === undefined && option.value === undefined)
                      ? 'tool-button support-chip is-active'
                      : 'tool-button support-chip'
                  }
                  onClick={() => onSetSelectedNodeSupport(option.value)}
                  aria-label={option.label}
                  tooltip={option.title}
                  tooltipPlacement="bottom"
                >
                  <SupportChipIcon support={option.value} />
                </EditorTooltipButton>
              ))}
            </div>
          </div>

          <div className="load-editor-group" aria-label="Node loads">
            <div className="load-editor">
              <span className="load-label">H</span>
              <div className="direction-toggle">
                {horizontalDirectionOptions.map((direction) => (
                  <EditorTooltipButton
                    key={direction}
                    className={
                      (selectedHorizontalLoad?.direction ?? 'right') === direction
                        ? 'tool-button direction-button is-active'
                        : 'tool-button direction-button'
                    }
                    onClick={() =>
                      onSetSelectedNodeHorizontalLoad(
                        selectedHorizontalLoad?.magnitudeKn ?? 0,
                        direction,
                      )
                    }
                    aria-label={`Horizontal load ${direction}`}
                    tooltip={`Horizontal ${direction}`}
                    tooltipPlacement="bottom"
                  >
                    {direction === 'left' ? '←' : '→'}
                  </EditorTooltipButton>
                ))}
              </div>
              <input
                className="load-input"
                type="number"
                min="0"
                step="0.1"
                value={selectedHorizontalLoad?.magnitudeKn ?? 0}
                onChange={(event) => onHorizontalMagnitudeChange(event.target.value)}
              />
              <span className="load-unit">kN</span>
            </div>

            <div className="load-editor">
              <span className="load-label">V</span>
              <div className="direction-toggle">
                {verticalDirectionOptions.map((direction) => (
                  <EditorTooltipButton
                    key={direction}
                    className={
                      (selectedVerticalLoad?.direction ?? 'down') === direction
                        ? 'tool-button direction-button is-active'
                        : 'tool-button direction-button'
                    }
                    onClick={() =>
                      onSetSelectedNodeVerticalLoad(
                        selectedVerticalLoad?.magnitudeKn ?? 0,
                        direction,
                      )
                    }
                    aria-label={`Vertical load ${direction}`}
                    tooltip={`Vertical ${direction}`}
                    tooltipPlacement="bottom"
                  >
                    {direction === 'up' ? '↑' : '↓'}
                  </EditorTooltipButton>
                ))}
              </div>
              <input
                className="load-input"
                type="number"
                min="0"
                step="0.1"
                value={selectedVerticalLoad?.magnitudeKn ?? 0}
                onChange={(event) => onVerticalMagnitudeChange(event.target.value)}
              />
              <span className="load-unit">kN</span>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (selectedMember) {
    return (
      <div className="editor-overlay editor-inspector" aria-label="Selected member properties">
        <div className="inspector-header">
          <span className="inspector-eyebrow">Member</span>
          <span className="inspector-title">Selected member</span>
        </div>

        <div className="member-properties">
          <div className="load-editor">
            <span className="load-label">EA</span>
            <input
              className="load-input member-stiffness-input"
              type="number"
              min="1"
              step="1000"
              value={selectedMember.axialStiffnessKn}
              onChange={(event) =>
                onSetSelectedMemberAxialStiffness(
                  Math.max(1, Number(event.target.value) || selectedMember.axialStiffnessKn),
                )
              }
            />
            <span className="load-unit">kN</span>
          </div>
        </div>
      </div>
    )
  }

  return null
}

function SupportChipIcon({ support }: { support: SupportType | undefined }) {
  if (!support) {
    return (
      <svg viewBox="0 0 24 24" className="tool-icon support-icon" aria-hidden="true">
        <path d="M6 6 L18 18 M18 6 L6 18" />
      </svg>
    )
  }

  if (support === 'pinned') {
    return (
      <svg viewBox="0 0 24 24" className="tool-icon support-icon" aria-hidden="true">
        <path d="M12 4 V8" />
        <path d="M12 8 L6 16 H18 Z" />
        <path d="M6 18 H18" />
      </svg>
    )
  }

  if (support === 'roller-x') {
    return (
      <svg viewBox="0 0 24 24" className="tool-icon support-icon" aria-hidden="true">
        <path d="M12 3 V7" />
        <path d="M12 7 L6 13 H18 Z" />
        <circle cx="9" cy="16.5" r="1.8" />
        <circle cx="15" cy="16.5" r="1.8" />
        <path d="M6 20 H18" />
      </svg>
    )
  }

  return (
    <svg viewBox="0 0 24 24" className="tool-icon support-icon" aria-hidden="true">
      <path d="M3 12 H7" />
      <path d="M7 12 L13 6 V18 Z" />
      <circle cx="16.5" cy="9" r="1.8" />
      <circle cx="16.5" cy="15" r="1.8" />
      <path d="M20 6 V18" />
    </svg>
  )
}
