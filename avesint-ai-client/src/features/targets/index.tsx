'use client'

import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { Search } from '@/components/search'
import { ThemeSwitch } from '@/components/theme-switch'
import { ConfigDrawer } from '@/components/config-drawer'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { Targets as TargetsFeature } from './Targets'

export function Targets() {
    return (
        <>
            <Header fixed>
                <Search />
                <div className="ms-auto flex items-center space-x-4">
                    <ThemeSwitch />
                    <ConfigDrawer />
                    {/* <ProfileDropdown /> */}
                </div>
            </Header>

            <Main className="flex flex-1 flex-col">
                <div className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-4 px-2 pb-6 pt-2 sm:px-4 lg:gap-6">
                    <div className="flex flex-wrap items-end justify-between gap-2">
                        <div className="space-y-1">
                            <h2 className="text-2xl font-bold tracking-tight">
                                Обʼєкти та цілі
                            </h2>
                            <p className="max-w-2xl text-sm text-muted-foreground">
                                Оперативний перелік виявлених обʼєктів і цілей з привʼязкою до
                                місцевості, пріоритетами та статусами. Використовуйте цей розділ
                                для планування уражень та контролю виконання задач по цілях.
                            </p>
                        </div>
                    </div>

                    {/* Основний функціонал сторінки цілей */}
                    <TargetsFeature />
                </div>
            </Main>
        </>
    )
}