import { createFileRoute, Link } from '@tanstack/react-router'
import { useState } from 'react'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { Search } from '@/components/search'
import { ThemeSwitch } from '@/components/theme-switch'
import { ConfigDrawer } from '@/components/config-drawer'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { Button } from '@/components/ui/button'
import { ArrowLeft } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { targets } from '@/features/targets/data/targets'
import { TargetDetails } from '@/features/targets/components/target-details'
import {
  TaskCreateForm,
  type TaskCreateFormValues,
} from '@/features/tasks/components/task-create-form'
import { showSubmittedData } from '@/lib/show-submitted-data'

export const Route = createFileRoute('/_authenticated/targets/$targetId')({
  component: RouteComponent,
})

function RouteComponent() {
  const { targetId } = Route.useParams()
  const target = targets.find((t) => String(t.id) === String(targetId))

  const [createTaskOpen, setCreateTaskOpen] = useState(false)

  const handleCreateTask = (values: TaskCreateFormValues) => {
    if (!target) return

    // TODO: тут потім буде реальний API виклик
    showSubmittedData(
      {
        ...values,
        targetId: target.id,
      },
      'Створено задачу по цілі:'
    )

    setCreateTaskOpen(false)
  }

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
        <div className="flex items-center justify-between gap-2">
          <Button
            asChild
            variant="ghost"
            size="sm"
            className="-ms-2 inline-flex items-center gap-1 text-xs"
          >
            <Link to="/targets">
              <ArrowLeft className="h-4 w-4" />
              <span>До списку обʼєктів та цілей</span>
            </Link>
          </Button>
        </div>

        {!target ? (
          <p className="text-sm text-muted-foreground">
            Ціль / обʼєкт з ID{' '}
            <span className="font-mono">{targetId}</span> не знайдено.
          </p>
        ) : (
          <>
            <TargetDetails
              target={target}
              onCreateTaskClick={() => setCreateTaskOpen(true)}
            />

            {/* Модалка створення задачі по цій цілі */}
            <Dialog open={createTaskOpen} onOpenChange={setCreateTaskOpen}>
              <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                  <DialogTitle>
                    Нова задача по цілі «{target.title}»
                  </DialogTitle>
                </DialogHeader>

                <TaskCreateForm onCreate={handleCreateTask} />
              </DialogContent>
            </Dialog>
          </>
        )}
      </Main>
    </>
  )
}
