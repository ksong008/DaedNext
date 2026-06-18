import type { ComponentProps } from 'react'
import { DragDropContext } from '@hello-pangea/dnd'

export function OrchestrateDragDropContext(props: ComponentProps<typeof DragDropContext>) {
  return <DragDropContext {...props} />
}
