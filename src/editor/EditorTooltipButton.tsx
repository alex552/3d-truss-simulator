import {
  autoUpdate,
  flip,
  FloatingPortal,
  offset,
  shift,
  useFloating,
  useFocus,
  useHover,
  useInteractions,
  type Placement,
} from '@floating-ui/react'
import { useState, type ButtonHTMLAttributes, type ReactNode } from 'react'

export function EditorTooltipButton({
  tooltip,
  tooltipPlacement = 'right',
  children,
  disabled,
  ...buttonProps
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  tooltip: string
  tooltipPlacement?: Placement
  children: ReactNode
}) {
  const [isTooltipOpen, setIsTooltipOpen] = useState(false)
  const { refs, floatingStyles, context } = useFloating({
    open: isTooltipOpen,
    onOpenChange: setIsTooltipOpen,
    placement: tooltipPlacement,
    whileElementsMounted: autoUpdate,
    middleware: [
      offset(8),
      flip({ fallbackPlacements: ['left', 'top', 'bottom', 'right'] }),
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
