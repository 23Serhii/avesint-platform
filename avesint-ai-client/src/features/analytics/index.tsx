// src/features/analytics/index.tsx
import { useState } from 'react'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { Search } from '@/components/search'
import { ThemeSwitch } from '@/components/theme-switch'
import { ConfigDrawer } from '@/components/config-drawer'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { Button } from '@/components/ui/button'
import {AnalyticsOverview} from "@/features/analytics/components/analytics-overview.tsx";

type Period = '24h' | '7d' | '30d' | 'custom'

export function AnalyticsPage() {
    const [period, setPeriod] = useState<Period>('24h')

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

            <Main className="flex flex-col gap-4 lg:gap-6">
                <div className="flex flex-wrap items-end justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight">Аналітика системи</h1>
                        <p className="text-sm text-muted-foreground">
                            Оперативні показники завантаження, якості даних та ефективності роботи
                            штабу: події, цілі, задачі, активність користувачів.
                        </p>
                    </div>

                    <div className="flex items-center gap-2 text-xs">
                        <span className="text-muted-foreground">Період:</span>
                        <div className="flex items-center gap-1 rounded-full border bg-background px-1 py-0.5">
                            <Button
                                type="button"
                                size="sm"
                                variant={period === '24h' ? 'default' : 'ghost'}
                                className="h-7 rounded-full px-3 text-xs"
                                onClick={() => setPeriod('24h')}
                            >
                                24 години
                            </Button>
                            <Button
                                type="button"
                                size="sm"
                                variant={period === '7d' ? 'default' : 'ghost'}
                                className="h-7 rounded-full px-3 text-xs"
                                onClick={() => setPeriod('7d')}
                            >
                                7 діб
                            </Button>
                            <Button
                                type="button"
                                size="sm"
                                variant={period === '30d' ? 'default' : 'ghost'}
                                className="h-7 rounded-full px-3 text-xs"
                                onClick={() => setPeriod('30d')}
                            >
                                30 діб
                            </Button>
                            <Button
                                type="button"
                                size="sm"
                                variant={period === 'custom' ? 'default' : 'ghost'}
                                className="h-7 rounded-full px-3 text-xs"
                                onClick={() => setPeriod('custom')}
                            >
                                Власний
                            </Button>
                        </div>
                    </div>
                </div>

                <AnalyticsOverview period={period} />
            </Main>
        </>
    )
}