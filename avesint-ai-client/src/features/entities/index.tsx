import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { Search } from '@/components/search'
import { ThemeSwitch } from '@/components/theme-switch'
import { ConfigDrawer } from '@/components/config-drawer'
import { ProfileDropdown } from '@/components/profile-dropdown'

import { entities } from './data/entities'
import { EntitiesTable } from './components/entities-table'

export function Entities() {
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

      <Main className="flex flex-col gap-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Обʼєкти та цілі</h1>
          <p className="text-muted-foreground">
            Структурований перелік обʼєктів, до яких привʼязуються події,
            звіти та аналітика.
          </p>
        </div>

        <EntitiesTable items={entities} />
      </Main>
    </>
  )
}
