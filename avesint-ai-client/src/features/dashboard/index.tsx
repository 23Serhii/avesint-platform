'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from '@tanstack/react-router'
import { listEvents } from '@/lib/api/events'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card'
import { ConfigDrawer } from '@/components/config-drawer'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { Search } from '@/components/search'
import { ThemeSwitch } from '@/components/theme-switch'
import { AiQueryPanel } from '@/features/ai/ai-query-panel'
import type { Event } from '@/features/events/data/schema'
import { DashboardEventsChart } from './components/DashboardEventsChart'
import { DashboardEventsPie } from './components/DashboardEventsPie'
import { DashboardMiniMap } from './components/DashboardMiniMap'
import { DashboardStats } from './components/DashboardStats'
import { DashboardTasks } from './components/DashboardTasks'
import type { TimeRange } from './components/time-range'

export function DashboardOverviewPage() {
  const router = useRouter()

  const [range] = useState<TimeRange>('7d')

  const [events, setEvents] = useState<Event[]>([])
  const [eventsLoading, setEventsLoading] = useState(false)
  const [eventsError, setEventsError] = useState<string | null>(null)

  useEffect(() => {
    const load = async () => {
      try {
        setEventsLoading(true)
        setEventsError(null)

        const res = await listEvents({
          page: 1,
          pageSize: 200,
        })
        setEvents(res.items)
      } catch {
        setEventsError('Не вдалося завантажити події для огляду')
      } finally {
        setEventsLoading(false)
      }
    }

    void load()
  }, [])

  const recentEvents = useMemo(
    () =>
      events
        .slice()
        .sort(
          (a, b) =>
            new Date(b.occurredAt ?? b.createdAt).getTime() -
            new Date(a.occurredAt ?? a.createdAt).getTime()
        )
        .slice(0, 5),
    [events]
  )

  const goToEvents = () => {
    void router.navigate({ to: '/events' })
  }

  const goToTasks = () => {
    void router.navigate({ to: '/tasks' })
  }

  const goToMap = () => {
    void router.navigate({ to: '/map' })
  }

  const goToAnalytics = () => {
    void router.navigate({ to: '/analytics' })
  }

  return (
    <>
      <Header fixed>
        <Search />
        <div className='ms-auto flex items-center space-x-4'>
          <ThemeSwitch />
          <ConfigDrawer />
          <ProfileDropdown />
        </div>
      </Header>

      <Main className='flex flex-1 flex-col'>
        {/* Центрований контейнер дашборду */}
        <div className='mx-auto flex w-full max-w-7xl flex-1 flex-col gap-4 px-2 pt-2 pb-6 sm:px-4 lg:gap-6'>
          {/* Заголовок */}
          <div className='flex flex-wrap items-end justify-between gap-4'>
            <div className='space-y-1'>
              <h1 className='text-2xl font-bold tracking-tight'>
                Огляд подій і задач
              </h1>
              <p className='text-muted-foreground max-w-2xl text-sm'>
                Зведений дашборд по подіях, мапі та задачах штабу.
                Використовуйте цей екран як &quot;one‑glance&quot; огляд стану роботи платформи.
              </p>
            </div>

            <div className='flex flex-wrap items-center gap-2 text-xs'>
              <span className='text-muted-foreground'>Розділи:</span>
              <div className='bg-background flex items-center gap-1 rounded-full border px-1 py-0.5'>
                <Button
                  type='button'
                  size='sm'
                  variant='ghost'
                  className='h-7 rounded-full px-3 text-xs'
                  onClick={goToAnalytics}
                >
                  Аналітика
                </Button>
                <Button
                  type='button'
                  size='sm'
                  variant='ghost'
                  className='h-7 rounded-full px-3 text-xs'
                  onClick={goToMap}
                >
                  Повна мапа
                </Button>
                <Button
                  type='button'
                  size='sm'
                  variant='ghost'
                  className='h-7 rounded-full px-3 text-xs'
                  onClick={goToEvents}
                >
                  Стрічка подій
                </Button>
                <Button
                  type='button'
                  size='sm'
                  variant='ghost'
                  className='h-7 rounded-full px-3 text-xs'
                  onClick={goToTasks}
                >
                  Задачі
                </Button>
              </div>
            </div>
          </div>

          {/* Ряд 1: ключові метрики */}
          <DashboardStats />
          <AiQueryPanel />
          {/* Ряд 2: мапа */}
          <Card className='overflow-hidden'>
            <CardHeader className='bg-muted/40 flex flex-row items-center justify-between space-y-0 border-b px-4 py-3'>
              <div className='min-w-0'>
                <CardTitle className='text-sm'>Оперативна мапа</CardTitle>
                <CardDescription className='truncate text-xs'>
                  Останні події з координатами на території України та РФ.
                </CardDescription>
              </div>
              <Button
                type='button'
                variant='outline'
                size='sm'
                className='h-7 px-3 text-[11px]'
                onClick={goToMap}
              >
                Відкрити розділ &quot;Мапа&quot;
              </Button>
            </CardHeader>
            <CardContent className='h-[320px] px-0 pt-0 pb-0 lg:h-[360px]'>
              <DashboardMiniMap events={events} />
            </CardContent>
          </Card>

          {/* Ряд 3: графіки подій */}
          <div className='grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1.1fr)] lg:gap-6'>
            <DashboardEventsChart range={range} events={events} />
            <DashboardEventsPie range={range} events={events} />
          </div>

          {/* Ряд 4: останні події + задачі штабу */}
          <div className='grid gap-4 lg:grid-cols-[minmax(0,1.7fr)_minmax(0,1.1fr)] lg:gap-6'>
            <Card className='min-w-0'>
              <CardHeader className='flex flex-row items-center justify-between pb-2'>
                <div className='min-w-0'>
                  <CardTitle className='text-sm'>Останні події</CardTitle>
                  <CardDescription className='text-xs'>
                    Найсвіжіші зафіксовані події зі стрічки Events.
                  </CardDescription>
                </div>
                <Button
                  type='button'
                  variant='outline'
                  size='sm'
                  className='h-7 px-3 text-[11px]'
                  onClick={goToEvents}
                >
                  Всі події
                </Button>
              </CardHeader>
              <CardContent className='space-y-3 px-3 pt-0 pb-3'>
                {eventsLoading && !events.length && (
                  <p className='text-muted-foreground text-xs'>Завантаження…</p>
                )}

                {eventsError && !eventsLoading && (
                  <p className='text-xs text-red-500'>{eventsError}</p>
                )}

                {!eventsLoading &&
                  !eventsError &&
                  recentEvents.map((e) => (
                    <button
                      key={e.id}
                      type='button'
                      onClick={goToEvents}
                      className='hover:border-border hover:bg-muted/60 flex w-full items-start justify-between gap-3 rounded-md border border-transparent px-3 py-2 text-left text-sm transition-colors'
                    >
                      <div className='min-w-0'>
                        <p className='truncate font-medium'>{e.title}</p>
                        <p className='text-muted-foreground text-xs'>
                          {new Date(e.occurredAt ?? e.createdAt).toLocaleString(
                            'uk-UA',
                            {
                              dateStyle: 'short',
                              timeStyle: 'short',
                            }
                          )}
                        </p>
                      </div>
                      <Badge
                        variant='outline'
                        className='shrink-0 text-[10px] uppercase'
                      >
                        {e.severity ?? '—'}
                      </Badge>
                    </button>
                  ))}

                {!eventsLoading &&
                  !eventsError &&
                  recentEvents.length === 0 && (
                    <p className='text-muted-foreground text-xs'>
                      Подій поки немає.
                    </p>
                  )}
              </CardContent>
            </Card>

            <Card className='min-w-0'>
              <CardHeader className='flex flex-row items-center justify-between pb-2'>
                <div className='min-w-0'>
                  <CardTitle className='text-sm'>Задачі штабу</CardTitle>
                  <CardDescription className='text-xs'>
                    Останні задачі, призначені виконавцям по подіях та цілях.
                  </CardDescription>
                </div>
                <Button
                  type='button'
                  variant='outline'
                  size='sm'
                  className='h-7 px-3 text-[11px]'
                  onClick={goToTasks}
                >
                  Всі задачі
                </Button>
              </CardHeader>
              <CardContent className='px-3 pt-0 pb-3'>
                <DashboardTasks />
              </CardContent>
            </Card>
          </div>
        </div>
      </Main>
    </>
  )
}
