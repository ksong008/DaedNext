import type { Dispatch, SetStateAction } from 'react'
import type { SectionSummaryResource } from '~/apis/types'
import type { Profile } from '~/store'
import { BookmarkPlus, Check, Layers, Pencil, Save, Trash2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from './ui/alert-dialog'
import { Button } from './ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog'
import { DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator } from './ui/dropdown-menu'
import { Input } from './ui/input'

export function ProfileSwitcherDetails({
  profiles,
  currentProfileID,
  currentProfile,
  isCurrentSettingsModified,
  selectedConfig,
  selectedRouting,
  selectedDNS,
  profileName,
  setProfileName,
  saveDialogOpen,
  setSaveDialogOpen,
  renameDialogOpen,
  setRenameDialogOpen,
  deleteDialogOpen,
  setDeleteDialogOpen,
  handleSwitchProfile,
  handleUpdateProfile,
  handleSaveProfile,
  handleRenameProfile,
  handleDeleteProfile,
  openRenameDialog,
  openDeleteDialog,
  setDropdownOpen,
}: {
  profiles: Profile[]
  currentProfileID: string | null
  currentProfile?: Profile
  isCurrentSettingsModified?: boolean
  selectedConfig?: SectionSummaryResource
  selectedRouting?: SectionSummaryResource
  selectedDNS?: SectionSummaryResource
  profileName: string
  setProfileName: Dispatch<SetStateAction<string>>
  saveDialogOpen: boolean
  setSaveDialogOpen: Dispatch<SetStateAction<boolean>>
  renameDialogOpen: boolean
  setRenameDialogOpen: Dispatch<SetStateAction<boolean>>
  deleteDialogOpen: boolean
  setDeleteDialogOpen: Dispatch<SetStateAction<boolean>>
  handleSwitchProfile: (profile: Profile) => void
  handleUpdateProfile: () => void
  handleSaveProfile: () => void
  handleRenameProfile: () => void
  handleDeleteProfile: () => void
  openRenameDialog: (profile: Profile) => void
  openDeleteDialog: (profile: Profile) => void
  setDropdownOpen: (open: boolean) => void
}) {
  const { t } = useTranslation()

  return (
    <>
      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuLabel className="flex items-center gap-2">
          <Layers className="h-4 w-4" />
          {t('profile.title')}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />

        {profiles.length === 0 ? (
          <div className="px-2 py-3 text-center text-sm text-muted-foreground">{t('profile.noProfiles')}</div>
        ) : (
          profiles.map((profile) => (
            <DropdownMenuItem
              key={profile.id}
              className="group flex cursor-pointer items-center justify-between"
              onSelect={(event) => event.preventDefault()}
            >
              <button
                type="button"
                className="flex flex-1 items-center gap-2 text-left"
                onClick={() => handleSwitchProfile(profile)}
              >
                {profile.id === currentProfileID ? <Check className="h-4 w-4 text-primary" /> : <div className="w-4" />}
                <span className="truncate">{profile.name}</span>
              </button>
              <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                <Button
                  variant="ghost"
                  size="xs"
                  className="h-6 w-6 p-0"
                  onClick={(event) => {
                    event.stopPropagation()
                    openRenameDialog(profile)
                  }}
                >
                  <Pencil className="h-3 w-3" />
                </Button>
                <Button
                  variant="ghost"
                  size="xs"
                  className="h-6 w-6 p-0 text-destructive hover:text-destructive"
                  onClick={(event) => {
                    event.stopPropagation()
                    openDeleteDialog(profile)
                  }}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            </DropdownMenuItem>
          ))
        )}

        <DropdownMenuSeparator />

        {currentProfile && isCurrentSettingsModified && (
          <DropdownMenuItem onClick={handleUpdateProfile}>
            <Save className="mr-2 h-4 w-4" />
            {t('profile.update')}
          </DropdownMenuItem>
        )}

        <DropdownMenuItem
          onClick={() => {
            setProfileName('')
            setSaveDialogOpen(true)
            setDropdownOpen(false)
          }}
        >
          <BookmarkPlus className="mr-2 h-4 w-4" />
          {t('profile.save')}
        </DropdownMenuItem>
      </DropdownMenuContent>

      <Dialog open={saveDialogOpen} onOpenChange={setSaveDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('profile.save')}</DialogTitle>
          </DialogHeader>
          <form
            onSubmit={(event) => {
              event.preventDefault()
              handleSaveProfile()
            }}
          >
            <div className="space-y-4">
              <Input
                label={t('profile.name')}
                placeholder={t('profile.namePlaceholder')}
                value={profileName}
                onChange={(event) => setProfileName(event.target.value)}
                autoFocus
              />
              <div className="text-sm text-muted-foreground">
                {t('profile.saveCurrentAs')}:
                <ul className="ml-4 mt-2 list-disc space-y-1">
                  <li>Config: {selectedConfig?.name || '-'}</li>
                  <li>Routing: {selectedRouting?.name || '-'}</li>
                  <li>DNS: {selectedDNS?.name || '-'}</li>
                </ul>
              </div>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setSaveDialogOpen(false)}>
                  {t('actions.cancel')}
                </Button>
                <Button type="submit" disabled={!profileName.trim()}>
                  {t('actions.save dae')}
                </Button>
              </div>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={renameDialogOpen} onOpenChange={setRenameDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('profile.rename')}</DialogTitle>
          </DialogHeader>
          <form
            onSubmit={(event) => {
              event.preventDefault()
              handleRenameProfile()
            }}
          >
            <div className="space-y-4">
              <Input
                label={t('profile.name')}
                placeholder={t('profile.namePlaceholder')}
                value={profileName}
                onChange={(event) => setProfileName(event.target.value)}
                autoFocus
              />
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setRenameDialogOpen(false)}>
                  {t('actions.cancel')}
                </Button>
                <Button type="submit" disabled={!profileName.trim()}>
                  {t('actions.confirm')}
                </Button>
              </div>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('profile.delete')}</AlertDialogTitle>
            <AlertDialogDescription>{t('profile.confirmDelete')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('confirmModal.cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteProfile}>{t('confirmModal.confirm')}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
