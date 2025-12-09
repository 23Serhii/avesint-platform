// src/routes/_authenticated/roles/index.tsx
import { createFileRoute, redirect } from '@tanstack/react-router'
import { useAuthStore } from '@/stores/auth-store'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { roles, roleMeta } from '@/features/users/data/data'

export const Route = createFileRoute('/_authenticated/roles/')({
    beforeLoad: () => {
        const { auth } = useAuthStore.getState()
        const user = auth.user

        // доступ тільки для admin
        if (!user || user.role !== 'admin') {
            throw redirect({ to: '/403' })
        }
    },

    component: RolesPage,
})

function RolesPage() {
    return (
        <div className="flex flex-col gap-6 p-4 md:p-6">
            <div>
                <h1 className="text-2xl font-semibold tracking-tight">
                    Ролі та доступи
                </h1>
                <p className="text-muted-foreground text-sm">
                    Перегляньте, які можливості має кожна роль у системі. Зміна ролей
                    користувачів відбувається на сторінці &quot;Користувачі&quot;.
                </p>
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                {roles.map((role) => {
                    const meta = roleMeta[role.value]
                    const Icon = meta.icon

                    return (
                        <Card key={role.value}>
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium">
                                    {meta.label}
                                </CardTitle>
                                <Icon size={18} />
                            </CardHeader>
                            <CardContent className="space-y-3 text-xs text-muted-foreground">
                                <p>{meta.description}</p>
                                <div className="space-y-1">
                                    <p className="font-semibold text-[11px] uppercase">
                                        Основні можливості:
                                    </p>
                                    <ul className="list-disc pl-4 space-y-0.5">
                                        {role.value === 'admin' && (
                                            <>
                                                <li>Повний доступ до системи</li>
                                                <li>Керування користувачами та їх ролями</li>
                                                <li>Перегляд журналу дій (audit log)</li>
                                                <li>Постановка та редагування задач, цілей, подій</li>
                                            </>
                                        )}
                                        {role.value === 'officer' && (
                                            <>
                                                <li>Постановка задач підлеглим</li>
                                                <li>Робота з подіями, цілями, ревʼю</li>
                                                <li>Перегляд аналітики та звітів</li>
                                            </>
                                        )}
                                        {role.value === 'analyst' && (
                                            <>
                                                <li>Робота з подіями, ревʼю та аналітикою</li>
                                                <li>Створення звітів та підзадач</li>
                                                <li>Обмежений доступ до задач/цілей за своїм напрямком</li>
                                            </>
                                        )}
                                        {role.value === 'user' && (
                                            <>
                                                <li>Перегляд дашборду та задач, де він виконавець</li>
                                                <li>Створення власних підзадач у рамках поставлених задач</li>
                                            </>
                                        )}
                                    </ul>
                                </div>
                                <div className="pt-1">
                                    <Badge variant="outline" className="text-[10px] uppercase">
                                        {role.label}
                                    </Badge>
                                </div>
                            </CardContent>
                        </Card>
                    )
                })}
            </div>
        </div>
    )
}