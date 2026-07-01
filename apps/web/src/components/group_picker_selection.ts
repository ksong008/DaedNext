export type GroupPickerSelectionMode = 'multiple' | 'single'

export function nextGroupPickerSelectedIds(
  currentIds: string[],
  id: string,
  mode: GroupPickerSelectionMode = 'multiple',
) {
  if (currentIds.includes(id)) {
    return currentIds.filter((itemId) => itemId !== id)
  }

  if (mode === 'single') {
    return [id]
  }

  return [...currentIds, id]
}
