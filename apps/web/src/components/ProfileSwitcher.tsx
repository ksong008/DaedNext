import type { SectionSummaryResource } from '~/apis/types'
import type { Profile } from '~/store'
import { useStore } from '@nanostores/react'
import { ChevronDown, Layers, RefreshCw } from 'lucide-react'
import { lazy, Suspense, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { toast } from 'sonner'
import {
  useConfigSummariesQuery,
  useDNSSummariesQuery,
  useRoutingSummariesQuery,
  useSelectProfileMutation,
} from '~/apis'
import { cn } from '~/lib/utils'
import { defaultResourcesAtom, profilesAtom } from '~/store'

import { Button } from './ui/button'
import { DropdownMenu, DropdownMenuTrigger } from './ui/dropdown-menu'

const LazyProfileSwitcherDetails = lazy(() =>
  import('./ProfileSwitcherDetails').then((module) => ({ default: module.ProfileSwitcherDetails })),
)

function generateProfileId(): string {
  return `profile-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`
}

function resolveCurrentResource(resources: SectionSummaryResource[] | undefined, defaultID: string) {
  if (!resources?.length) {
    return undefined
  }

  return resources.find((resource) => resource.selected) || resources.find((resource) => resource.id === defaultID)
}

export function ProfileSwitcher() {
  const { t } = useTranslation()
  const profilesState = useStore(profilesAtom)
  const defaultResources = useStore(defaultResourcesAtom)
  const { profiles, currentProfileID } = profilesState

  const { data: configsQuery } = useConfigSummariesQuery()
  const { data: routingsQuery } = useRoutingSummariesQuery()
  const { data: dnssQuery } = useDNSSummariesQuery()

  const selectProfileMutation = useSelectProfileMutation()

  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [saveDialogOpen, setSaveDialogOpen] = useState(false)
  const [renameDialogOpen, setRenameDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [profileName, setProfileName] = useState('')
  const [editingProfile, setEditingProfile] = useState<Profile | null>(null)
  const [isSwitching, setIsSwitching] = useState(false)
  const [detailsLoaded, setDetailsLoaded] = useState(false)

  // Get current resources. Backend selected state tracks runtime materialization;
  // before first runtime selection, profile snapshots should use WebUI defaults.
  const selectedConfig = resolveCurrentResource(configsQuery?.configs, defaultResources.defaultConfigID)
  const selectedRouting = resolveCurrentResource(routingsQuery?.routings, defaultResources.defaultRoutingID)
  const selectedDNS = resolveCurrentResource(dnssQuery?.dnss, defaultResources.defaultDNSID)

  const currentProfile = profiles.find((p) => p.id === currentProfileID)

  const handleSaveProfile = () => {
    if (!profileName.trim()) return
    if (!selectedConfig || !selectedRouting || !selectedDNS) {
      toast.error(t('please select a config first'))
      return
    }

    const now = Date.now()
    const newProfile: Profile = {
      id: generateProfileId(),
      name: profileName.trim(),
      configID: selectedConfig.id,
      routingID: selectedRouting.id,
      dnsID: selectedDNS.id,
      createdAt: now,
      updatedAt: now,
    }

    profilesAtom.set({
      profiles: [...profiles, newProfile],
      currentProfileID: newProfile.id,
    })

    setProfileName('')
    setSaveDialogOpen(false)
    toast.success(t('profile.saveSuccess'))
  }

  const handleSwitchProfile = async (profile: Profile) => {
    setIsSwitching(true)
    setDropdownOpen(false)

    try {
      // Check if the resources still exist
      const configExists = configsQuery?.configs.some((c) => c.id === profile.configID)
      const routingExists = routingsQuery?.routings.some((r) => r.id === profile.routingID)
      const dnsExists = dnssQuery?.dnss.some((d) => d.id === profile.dnsID)

      if (!configExists || !routingExists || !dnsExists) {
        toast.error('Some resources in this profile no longer exist')
        return
      }

      await selectProfileMutation.mutateAsync({
        configID: profile.configID,
        routingID: profile.routingID,
        dnsID: profile.dnsID,
      })

      profilesAtom.set({
        ...profilesState,
        currentProfileID: profile.id,
      })

      toast.success(t('profile.switchSuccess'))
    } catch {
      toast.error('Failed to switch profile')
    } finally {
      setIsSwitching(false)
    }
  }

  const handleUpdateProfile = () => {
    if (!currentProfile) return
    if (!selectedConfig || !selectedRouting || !selectedDNS) return

    const updatedProfiles = profiles.map((p) =>
      p.id === currentProfile.id
        ? {
            ...p,
            configID: selectedConfig.id,
            routingID: selectedRouting.id,
            dnsID: selectedDNS.id,
            updatedAt: Date.now(),
          }
        : p,
    )

    profilesAtom.set({
      ...profilesState,
      profiles: updatedProfiles,
    })

    toast.success(t('profile.updateSuccess'))
  }

  const handleRenameProfile = () => {
    if (!editingProfile || !profileName.trim()) return

    const updatedProfiles = profiles.map((p) =>
      p.id === editingProfile.id
        ? {
            ...p,
            name: profileName.trim(),
            updatedAt: Date.now(),
          }
        : p,
    )

    profilesAtom.set({
      ...profilesState,
      profiles: updatedProfiles,
    })

    setProfileName('')
    setEditingProfile(null)
    setRenameDialogOpen(false)
    toast.success(t('profile.updateSuccess'))
  }

  const handleDeleteProfile = () => {
    if (!editingProfile) return

    const updatedProfiles = profiles.filter((p) => p.id !== editingProfile.id)
    const newCurrentID = currentProfileID === editingProfile.id ? null : currentProfileID

    profilesAtom.set({
      profiles: updatedProfiles,
      currentProfileID: newCurrentID,
    })

    setEditingProfile(null)
    setDeleteDialogOpen(false)
    toast.success(t('profile.deleteSuccess'))
  }

  const openRenameDialog = (profile: Profile) => {
    setEditingProfile(profile)
    setProfileName(profile.name)
    setRenameDialogOpen(true)
    setDropdownOpen(false)
  }

  const openDeleteDialog = (profile: Profile) => {
    setEditingProfile(profile)
    setDeleteDialogOpen(true)
    setDropdownOpen(false)
  }

  // Check if current settings match the current profile
  const isCurrentSettingsModified =
    currentProfile &&
    (currentProfile.configID !== selectedConfig?.id ||
      currentProfile.routingID !== selectedRouting?.id ||
      currentProfile.dnsID !== selectedDNS?.id)
  const showDetails = detailsLoaded || dropdownOpen || saveDialogOpen || renameDialogOpen || deleteDialogOpen

  const setProfileDropdownOpen = (open: boolean) => {
    if (open) {
      setDetailsLoaded(true)
    }
    setDropdownOpen(open)
  }

  return (
    <>
      <DropdownMenu open={dropdownOpen} onOpenChange={setProfileDropdownOpen}>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className={cn(
              'gap-2 rounded-xl border-border/75 bg-background/72 px-3 shadow-[0_4px_10px_rgba(15,23,42,0.03)]',
              isCurrentSettingsModified && 'border-amber-500/50 text-amber-500',
            )}
            disabled={isSwitching}
          >
            <Layers className="h-4 w-4 shrink-0" />
            <span className="max-w-[5.5rem] truncate text-sm font-medium">
              {currentProfile?.name || t('profile.default')}
            </span>
            {isCurrentSettingsModified && <span className="text-xs">*</span>}
            {isSwitching ? (
              <RefreshCw className="h-3 w-3 animate-spin" />
            ) : (
              <ChevronDown className="h-3 w-3 shrink-0" />
            )}
          </Button>
        </DropdownMenuTrigger>

        {showDetails && (
          <Suspense fallback={null}>
            <LazyProfileSwitcherDetails
              profiles={profiles}
              currentProfileID={currentProfileID}
              currentProfile={currentProfile}
              isCurrentSettingsModified={!!isCurrentSettingsModified}
              selectedConfig={selectedConfig}
              selectedRouting={selectedRouting}
              selectedDNS={selectedDNS}
              profileName={profileName}
              setProfileName={setProfileName}
              saveDialogOpen={saveDialogOpen}
              setSaveDialogOpen={setSaveDialogOpen}
              renameDialogOpen={renameDialogOpen}
              setRenameDialogOpen={setRenameDialogOpen}
              deleteDialogOpen={deleteDialogOpen}
              setDeleteDialogOpen={setDeleteDialogOpen}
              handleSwitchProfile={(profile) => void handleSwitchProfile(profile)}
              handleUpdateProfile={handleUpdateProfile}
              handleSaveProfile={handleSaveProfile}
              handleRenameProfile={handleRenameProfile}
              handleDeleteProfile={handleDeleteProfile}
              openRenameDialog={openRenameDialog}
              openDeleteDialog={openDeleteDialog}
              setDropdownOpen={setProfileDropdownOpen}
            />
          </Suspense>
        )}
      </DropdownMenu>
    </>
  )
}
