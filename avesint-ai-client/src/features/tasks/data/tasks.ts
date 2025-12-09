// src/features/tasks/data/tasks.ts

export type TaskStatus = 'new' | 'in_progress' | 'done'
export type TaskPriority = 'high' | 'medium' | 'low'
export type TaskRole = 'analyst' | 'duty_officer' | 'section_lead' | 'commander'

export type Task = {
    id: string
    title: string
    description?: string | null

    // ТУТ: role більше не nullable
    role: TaskRole
    priority: TaskPriority
    status: TaskStatus

    assigneeCallsign: string | null
    assigneeRank?: string | null
    assigneeUnit?: string | null

    parentTaskId?: string | null
    targetId?: string | null
    eventId?: string | null

    createdAt: string
    updatedAt?: string | null
    dueAt?: string | null

    archived: boolean
}

type MockTaskRequired = Pick<Task, 'id' | 'title' | 'priority' | 'status'>
type MockTaskOptional = Partial<Omit<Task, keyof MockTaskRequired>>

const createMockTask = (overrides: MockTaskRequired & MockTaskOptional): Task => {
    const nowIso = new Date().toISOString()

    return {
        // обовʼязкові поля
        id: overrides.id,
        title: overrides.title,
        priority: overrides.priority,
        status: overrides.status,

        // текст
        description: overrides.description ?? null,

        // роль / виконавець
        role: overrides.role ?? 'analyst', // ТУТ: дефолтне значення, щоб точно був TaskRole
        assigneeCallsign: overrides.assigneeCallsign ?? null,
        assigneeRank: overrides.assigneeRank ?? null,
        assigneeUnit: overrides.assigneeUnit ?? null,

        // звʼязки
        parentTaskId: overrides.parentTaskId ?? null,
        targetId: overrides.targetId ?? null,
        eventId: overrides.eventId ?? null,

        // дати
        createdAt: overrides.createdAt ?? nowIso,
        updatedAt: overrides.updatedAt ?? null,
        dueAt: overrides.dueAt ?? null,

        // архів
        archived: overrides.archived ?? false,
    }
}

// Прості мок-дані (можна розширювати)
export const tasks: Task[] = [
    createMockTask({
        id: 't-1',
        title: 'Розвідзвіт по району Бахмут-південь',
        description:
            'Зібрати дані по руху техніки противника за останні 24 години, джерела: БПЛА, радіоперехоплення.',
        role: 'analyst',
        priority: 'high',
        status: 'in_progress',
        assigneeCallsign: 'БЕРКУТ',
        assigneeRank: 'ст. лейтенант',
        assigneeUnit: 'Аналітичний відділ',
        dueAt: new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString(), // +3 години
    }),
    // ... existing code ...
    createMockTask({
        id: 't-2',
        title: 'Моніторинг скупчення техніки біля ТЕЦ',
        description:
            'Підтвердження наявності танків/ББМ біля обʼєкта критичної інфраструктури. Звірити з супутниковими даними.',
        role: 'duty_officer',
        priority: 'medium',
        status: 'new',
        assigneeCallsign: 'ОМЕГА',
        assigneeRank: 'капітан',
        assigneeUnit: 'Черговий по штабу',
    }),
    createMockTask({
        id: 't-3',
        title: 'Побудова карти загроз по району Курахове',
        description:
            'Агрегувати дані по ворожій активності за останні 7 діб та сформувати теплову карту ризиків.',
        role: 'section_lead',
        priority: 'medium',
        status: 'in_progress',
        assigneeCallsign: 'ЛОРД',
        assigneeRank: 'майор',
        assigneeUnit: 'Керівник напряму',
    }),
    createMockTask({
        id: 't-4',
        title: 'Аналіз маршрутів стратегічної авіації',
        description:
            'Виділити типові маршрути польотів стратегічних бомбардувальників РФ, повʼязати з обстрілами.',
        role: 'analyst',
        priority: 'high',
        status: 'new',
        assigneeCallsign: 'ФЕНІКС',
        assigneeRank: 'лейтенант',
        assigneeUnit: 'Аналітичний відділ',
    }),
]