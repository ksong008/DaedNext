import * as DialogPrimitive from '@radix-ui/react-dialog'
import { XIcon } from 'lucide-react'
import * as React from 'react'

import { cn } from '~/lib/utils'

import { DialogOverlay, DialogPortal } from './dialog'

export type ScrollableDialogContentSize = 'sm' | 'md' | 'lg' | 'xl' | 'full'

const sizeClasses: Record<ScrollableDialogContentSize, string> = {
  sm: 'sm:max-w-md',
  md: 'sm:max-w-lg',
  lg: 'sm:max-w-2xl',
  xl: 'sm:max-w-4xl',
  full: 'sm:w-[90vw] sm:h-[90vh] sm:max-w-4xl',
}

export interface ScrollableDialogContentProps extends React.ComponentProps<typeof DialogPrimitive.Content> {
  showCloseButton?: boolean
  size?: ScrollableDialogContentSize
}

function ScrollableDialogContent({
  className,
  children,
  showCloseButton = true,
  size = 'md',
  ...props
}: ScrollableDialogContentProps) {
  return (
    <DialogPortal>
      <DialogOverlay />
      <DialogPrimitive.Content
        aria-describedby={undefined}
        data-slot="dialog-content"
        className={cn(
          'bg-[color:var(--shell-dialog)] text-foreground',
          'fixed top-[50%] left-[50%] z-50 translate-x-[-50%] translate-y-[-50%]',
          'flex flex-col w-[calc(100%-1rem)] max-h-[calc(100dvh-1rem)] sm:w-[calc(100%-2rem)] sm:max-h-[calc(100vh-2rem)]',
          'rounded-lg border border-[color:var(--shell-line)] shadow-[0_14px_34px_color-mix(in_oklab,var(--foreground)_12%,transparent)]',
          sizeClasses[size],
          className,
        )}
        {...props}
      >
        {children}
        {showCloseButton && (
          <DialogPrimitive.Close
            data-slot="dialog-close"
            className="ring-offset-background focus:ring-ring data-[state=open]:bg-[color:var(--shell-surface-soft)] data-[state=open]:text-muted-foreground absolute top-4 right-4 z-10 rounded-xs opacity-70 transition-opacity hover:bg-[color:var(--shell-surface-soft)] hover:opacity-100 focus:ring-2 focus:ring-offset-2 focus:outline-hidden disabled:pointer-events-none [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4"
          >
            <XIcon />
            <span className="sr-only">Close</span>
          </DialogPrimitive.Close>
        )}
      </DialogPrimitive.Content>
    </DialogPortal>
  )
}

function ScrollableDialogHeader({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="dialog-header"
      className={cn(
        'shrink-0 flex flex-col gap-2 text-center sm:text-left p-4 sm:p-6 border-b border-[color:var(--shell-line)] bg-[color:var(--shell-dialog-header)]',
        className,
      )}
      {...props}
    />
  )
}

function ScrollableDialogBody({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="dialog-body"
      className={cn('flex-1 overflow-y-auto min-h-0 bg-[color:var(--shell-dialog-body)] p-4 sm:p-6', className)}
      {...props}
    />
  )
}

function ScrollableDialogFooter({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="dialog-footer"
      className={cn(
        'shrink-0 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end p-4 sm:p-6 border-t border-[color:var(--shell-line)] bg-[color:var(--shell-dialog-header)]',
        className,
      )}
      {...props}
    />
  )
}

export { ScrollableDialogBody, ScrollableDialogContent, ScrollableDialogFooter, ScrollableDialogHeader }
