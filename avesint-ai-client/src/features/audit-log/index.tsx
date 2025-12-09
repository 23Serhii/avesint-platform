// src/features/audit-log/index.tsx
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { ThemeSwitch } from '@/components/theme-switch'
import { ConfigDrawer } from '@/components/config-drawer'
import { ProfileDropdown } from '@/components/profile-dropdown'
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { listAuditLog } from '@/lib/api/audit-log'
import type { AuditEntry, AuditSeverity } from '@/lib/api/audit-log'

type SeverityFilter = 'all' | AuditSeverity
type CategoryFilter = 'all' | 'auth' | '2fa' | 'tasks' | 'targets' | 'users' | 'security'

export function AuditLogPage() {
    const [page, setPage] = useState(1)
    const pageSize = 50

    const [severityFilter, setSeverityFilter] = useState<SeverityFilter>('all')
    const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('all')
    const [search, setSearch] = useState('')

    const severityParam =
        severityFilter === 'all' ? undefined : [severityFilter]

    const actionParam =
        categoryFilter === 'all'
            ? undefined
            : categoryFilter === 'auth'
                ? ['login', 'login_failed', 'logout', 'user_created']
                : categoryFilter === '2fa'
                    ? [
                        '2fa_generate',
                        '2fa_enable_success',
                        '2fa_enable_failed',
                        '2fa_verify_success',
                        '2fa_verify_failed',
                    ]
                    : categoryFilter === 'tasks'
                        ? ['task_created', 'task_subtask_created', 'task_updated', 'task_archived']
                        : categoryFilter === 'targets'
                            ? ['target_created', 'target_updated', 'target_archived']
                            : categoryFilter === 'users'
                                ? ['user_created', 'user_updated', 'role_changed']
                                : // 'security' – беремо класичні безпекові дії
                                ['login_failed', '2fa_enable_failed', '2fa_verify_failed']

    const { data, isLoading } = useQuery({
        queryKey: ['audit-log', { page, pageSize, severityParam, actionParam, search }],
        queryFn: () =>
            listAuditLog({
                page,
                pageSize,
                severity: severityParam,
                action: actionParam,
                search: search.trim() || undefined,
            }),
    })

    const items = data?.items ?? []

    const [selectedEntry, setSelectedEntry] = useState<AuditEntry | null>(null)
    const [detailsOpen, setDetailsOpen] = useState(false)

    const handleOpenEntry = (entry: AuditEntry) => {
        setSelectedEntry(entry)
        setDetailsOpen(true)
    }

    return (
        <>
            <Header fixed>
                <div className="font-semibold">Журнал дій системи</div>
                <div className="ms-auto flex items-center space-x-4">
                    <ThemeSwitch />
                    <ConfigDrawer />
                    <ProfileDropdown />
                </div>
            </Header>

            <Main className="flex flex-col gap-6">
                <div className="flex items-center justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight">Журнал дій</h1>
                        <p className="text-muted-foreground">
                            Всі ключові події в системі: логіни, 2FA, зміни ролей, задач, цілей тощо.
                        </p>
                    </div>
                    {isLoading && (
                        <div className="text-xs text-muted-foreground">
                            Завантаження журналу…
                        </div>
                    )}
                </div>

                {/* Фільтри */}
                <div className="flex flex-wrap items-center gap-3">
                    <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">Важливість:</span>
                        <select
                            className="h-8 rounded border bg-background px-2 text-xs"
                            value={severityFilter}
                            onChange={(e) => setSeverityFilter(e.target.value as SeverityFilter)}
                        >
                            <option value="all">Усі</option>
                            <option value="info">Info</option>
                            <option value="warning">Warning</option>
                            <option value="critical">Critical</option>
                        </select>
                    </div>

                    <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">Категорія:</span>
                        <select
                            className="h-8 rounded border bg-background px-2 text-xs"
                            value={categoryFilter}
                            onChange={(e) => {
                                setCategoryFilter(e.target.value as CategoryFilter)
                                setPage(1)
                            }}
                        >
                            <option value="all">Усі</option>
                            <option value="auth">Авторизація</option>
                            <option value="2fa">2FA</option>
                            <option value="tasks">Задачі</option>
                            <option value="targets">Цілі</option>
                            <option value="users">Користувачі / ролі</option>
                            <option value="security">Безпека</option>
                        </select>
                    </div>

                    <div className="flex-1 min-w-[200px]">
                        <Input
                            placeholder="Пошук по користувачу, цілі, опису…"
                            value={search}
                            onChange={(e) => {
                                setSearch(e.target.value)
                                setPage(1)
                            }}
                            className="h-8 text-xs"
                        />
                    </div>
                </div>

                <div className="border rounded-md overflow-hidden">
                    <table className="w-full text-sm">
                        <thead className="bg-muted">
                        <tr>
                            <th className="px-3 py-2 text-left">Час</th>
                            <th className="px-3 py-2 text-left">Користувач</th>
                            <th className="px-3 py-2 text-left">Дія</th>
                            <th className="px-3 py-2 text-left">Важливість</th>
                            <th className="px-3 py-2 text-left">Ціль</th>
                        </tr>
                        </thead>
                        <tbody>
                        {items.map((entry) => (
                            <tr
                                key={entry.id}
                                className="cursor-pointer hover:bg-muted/60"
                                onClick={() => handleOpenEntry(entry)}
                            >
                                <td className="px-3 py-2 whitespace-nowrap">
                                    {new Date(entry.timestamp).toLocaleString('uk-UA')}
                                </td>
                                <td className="px-3 py-2">
                                    {entry.actorDisplayName
                                        ? `${entry.actorDisplayName} (${entry.actor})`
                                        : entry.actor}{' '}
                                    {entry.actorRole && (
                                        <span className="text-xs text-muted-foreground">
                        ({entry.actorRole})
                      </span>
                                    )}
                                </td>
                                <td className="px-3 py-2">{entry.action}</td>
                                <td className="px-3 py-2">
                                    <SeverityBadge severity={entry.severity} />
                                </td>
                                <td className="px-3 py-2">{entry.target || '—'}</td>
                            </tr>
                        ))}
                        {items.length === 0 && !isLoading && (
                            <tr>
                                <td
                                    colSpan={5}
                                    className="px-3 py-4 text-center text-muted-foreground text-sm"
                                >
                                    Поки що немає записів у журналі.
                                </td>
                            </tr>
                        )}
                        </tbody>
                    </table>
                </div>

                {/* TODO: пагінація (використати page/setPage та data.total) */}
            </Main>

            <AuditLogDetailsDialog
                entry={selectedEntry}
                open={detailsOpen}
                onOpenChange={(open) => {
                    setDetailsOpen(open)
                    if (!open) setSelectedEntry(null)
                }}
            />
        </>
    )
}

function SeverityBadge({ severity }: { severity: AuditEntry['severity'] }) {
    const color =
        severity === 'critical'
            ? 'destructive'
            : severity === 'warning'
                ? 'outline'
                : 'secondary'

    return <Badge variant={color as any}>{severity}</Badge>
}

type AuditLogDetailsDialogProps = {
    entry: AuditEntry | null
    open: boolean
    onOpenChange: (open: boolean) => void
}

function AuditLogDetailsDialog({
                                   entry,
                                   open,
                                   onOpenChange,
                               }: AuditLogDetailsDialogProps) {
    if (!entry) return null

    const hasContext = entry.context && Object.keys(entry.context).length > 0

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-2xl">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        Подія: {entry.action}{' '}
                        <SeverityBadge severity={entry.severity} />
                    </DialogTitle>
                    <DialogDescription>
                        Деталі зафіксованої дії в системі.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 text-sm">
                    <div className="grid gap-2 sm:grid-cols-2">
                        <div>
                            <span className="font-medium">Час:</span>{' '}
                            {new Date(entry.timestamp).toLocaleString('uk-UA')}
                        </div>
                        <div>
                            <span className="font-medium">IP:</span>{' '}
                            {entry.ip || '—'}
                        </div>
                        <div>
                            <span className="font-medium">Користувач:</span>{' '}
                            {entry.actorDisplayName
                                ? `${entry.actorDisplayName} (${entry.actor})`
                                : entry.actor || '—'}
                            {entry.actorRole && ` (${entry.actorRole})`}
                        </div>
                        <div>
                            <span className="font-medium">Підрозділ / ранг:</span>{' '}
                            {entry.actorUnit || entry.actorRank
                                ? `${entry.actorUnit ?? ''} ${entry.actorRank ?? ''}`.trim()
                                : '—'}
                        </div>
                        <div>
                            <span className="font-medium">2FA:</span>{' '}
                            {entry.actorIsTwoFactorEnabled === undefined
                                ? '—'
                                : entry.actorIsTwoFactorEnabled
                                    ? 'увімкнено'
                                    : 'вимкнено'}
                        </div>
                        <div>
                            <span className="font-medium">Ціль:</span>{' '}
                            {entry.target || '—'}
                        </div>
                        <div className="sm:col-span-2">
                            <span className="font-medium">User-Agent:</span>{' '}
                            {entry.userAgent || '—'}
                        </div>
                    </div>

                    <div>
                        <h4 className="mb-1 text-sm font-medium text-muted-foreground">
                            Опис
                        </h4>
                        <p className="whitespace-pre-wrap">
                            {entry.description}
                        </p>
                    </div>

                    {hasContext && (
                        <div>
                            <h4 className="mb-1 text-sm font-medium text-muted-foreground">
                                Контекст події
                            </h4>
                            <pre className="max-h-64 overflow-auto rounded bg-muted p-2 text-xs">
                {JSON.stringify(entry.context, null, 2)}
              </pre>
                        </div>
                    )}

                    <div className="text-xs text-muted-foreground">
                        ID запису: {entry.id}
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    )
}