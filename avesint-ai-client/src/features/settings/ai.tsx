// src/routes/_authenticated/settings/ai.tsx
'use client'

import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useState } from 'react'

import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { Search } from '@/components/search'
import { ThemeSwitch } from '@/components/theme-switch'
import { ConfigDrawer } from '@/components/config-drawer'
import { ProfileDropdown } from '@/components/profile-dropdown'

import { AiSourcesPanel } from '@/features/settings/components/ai-sources-panel'
import { listOsintSources, type OsintSource } from '@/lib/api/osint-sources'

function AiSettingsPage() {
  const [aiEnabled, setAiEnabled] = useState(true)
  const [availableSources, setAvailableSources] = useState<OsintSource[]>([])
  const [selectedSourceIds, setSelectedSourceIds] = useState<string[]>([])
  const [sourcesLoading, setSourcesLoading] = useState(false)
  const [sourcesError, setSourcesError] = useState<string | null>(null)

  useEffect(() => {
    const loadSources = async () => {
      try {
        setSourcesLoading(true)
        setSourcesError(null)
        const srcs = await listOsintSources({ isActive: true })
        setAvailableSources(srcs)
        setSelectedSourceIds(srcs.map((s) => s.id))
      } catch {
        setSourcesError('Не вдалося завантажити список джерел OSINT')
      } finally {
        setSourcesLoading(false)
      }
    }

    void loadSources()
  }, [])

  return (
    <>
      <Header fixed>
        <Search />
        <div className="ms-auto flex items-center space-x-4">
          <ThemeSwitch />
          <ConfigDrawer />
          <ProfileDropdown />
        </div>
      </Header>

      <Main className="flex flex-1 flex-col gap-4 lg:gap-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Налаштування АІ / джерел OSINT
          </h1>
          <p className="text-xs text-muted-foreground">
            Оберіть, з яких джерел OSINT події потрапляють до AІ‑класифікації та
            стрічки.
          </p>
        </div>

        <AiSourcesPanel
          aiEnabled={aiEnabled}
          onAiEnabledChange={setAiEnabled}
          availableSources={availableSources}
          selectedSourceIds={selectedSourceIds}
          onSelectedSourceIdsChange={setSelectedSourceIds}
          sourcesLoading={sourcesLoading}
          sourcesError={sourcesError}
        />
      </Main>
    </>
  )
}

export const Route = createFileRoute('/_authenticated/settings/ai')({
  component: AiSettingsPage,
})