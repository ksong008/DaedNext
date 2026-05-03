import { atom } from 'nanostores'

export interface RoutingCompletionItem {
  label: string
  kind: 'variable' | 'keyword'
  detail?: string
  documentation?: string
  insertText?: string
}

export const dynamicCompletionItemsAtom = atom<RoutingCompletionItem[]>([])

export function setDynamicCompletionItems(items: RoutingCompletionItem[]): void {
  dynamicCompletionItemsAtom.set(items)
}

export function getDynamicCompletionItems(): RoutingCompletionItem[] {
  return dynamicCompletionItemsAtom.get()
}

export function createGroupCompletionItems(groupNames: string[]): RoutingCompletionItem[] {
  return groupNames.map((name) => ({
    label: name,
    kind: 'variable',
    detail: 'User group outbound',
    documentation: `Route traffic to group: ${name}`,
    insertText: name,
  }))
}
