'use client'

import * as TooltipPrimitive from '@radix-ui/react-tooltip'
import * as React from 'react'

import { cn } from '~/lib/utils'

function TooltipProvider({ delayDuration = 0, ...props }: React.ComponentProps<typeof TooltipPrimitive.Provider>) {
  return <TooltipPrimitive.Provider data-slot="tooltip-provider" delayDuration={delayDuration} {...props} />
}

function Tooltip({ ...props }: React.ComponentProps<typeof TooltipPrimitive.Root>) {
  return (
    <TooltipProvider>
      <TooltipPrimitive.Root data-slot="tooltip" {...props} />
    </TooltipProvider>
  )
}

function TooltipTrigger({ ...props }: React.ComponentProps<typeof TooltipPrimitive.Trigger>) {
  return <TooltipPrimitive.Trigger data-slot="tooltip-trigger" {...props} />
}

function TooltipContent({
  className,
  sideOffset = 4,
  children,
  ...props
}: React.ComponentProps<typeof TooltipPrimitive.Content>) {
  return (
    <TooltipPrimitive.Portal>
      <TooltipPrimitive.Content
        data-slot="tooltip-content"
        sideOffset={sideOffset}
        className={cn(
          'z-50 overflow-hidden rounded-md border bg-popover px-3 py-1.5 text-sm text-popover-foreground shadow-md',
          className,
        )}
        {...props}
      >
        {children}
      </TooltipPrimitive.Content>
    </TooltipPrimitive.Portal>
  )
}

// Simple wrapper for easier usage
interface SimpleTooltipProps {
  children: React.ReactNode
  label: React.ReactNode
  side?: 'top' | 'right' | 'bottom' | 'left'
  align?: 'start' | 'center' | 'end'
  contentClassName?: string
}

function SimpleTooltip({ children, label, side = 'top', align = 'center', contentClassName }: SimpleTooltipProps) {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="inline-flex">{children}</div>
        </TooltipTrigger>
        <TooltipContent
          side={side}
          align={align}
          collisionPadding={12}
          className={cn(
            'max-w-[calc(100vw-2rem)] whitespace-normal break-words text-left sm:max-w-xs',
            contentClassName,
          )}
        >
          <div className="max-w-full leading-relaxed">{label}</div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

export { SimpleTooltip, Tooltip, TooltipContent, TooltipProvider, TooltipTrigger }
