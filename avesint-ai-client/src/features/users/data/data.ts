import type React from 'react'
import { Shield, UserCheck, Users as UsersIcon, Eye } from 'lucide-react'
import type { UserRole } from './schema'

export type RoleOption = {
  value: UserRole
  label: string
  description: string
}

// 🔹 Цей експорт очікує існуючий код: import { roles } from './data'
export const roles: RoleOption[] = [
    {
        value: 'admin',
        label: 'Адміністратор',
        description: 'Повний доступ, керування користувачами та налаштуваннями',
    },
    {
        value: 'officer',
        label: 'Офіцер зміни',
        description: 'Управління подіями, задачами та чергою ревʼю',
    },
    {
        value: 'analyst',
        label: 'Аналітик',
        description: 'Аналіз подій, створення звітів, робота з аналітикою',
    },
    {
        value: 'user',
        label: 'Спостерігач',
        description: 'Перегляд дашборду без можливості змін',
    },
]

// 🔹 Метадані ролей для бейджів, таблиці, тултіпів, іконок
export const roleMeta: Record<
    UserRole,
    {
        label: string
        description: string
        icon: React.ComponentType<{ size?: number }>
    }
> = {
    admin: {
        label: 'Адміністратор',
        description: 'Повний доступ, керування користувачами та налаштуваннями',
        icon: Shield,
    },
    officer: {
        label: 'Офіцер зміни',
        description: 'Управління подіями, задачами та чергою ревʼю',
        icon: UserCheck,
    },
    analyst: {
        label: 'Аналітик',
        description: 'Аналіз подій, створення звітів, робота з аналітикою',
        icon: UsersIcon,
    },
    user: {
        label: 'Спостерігач',
        description: 'Перегляд даних без можливості змін',
        icon: Eye,
    },
}
export const callTypes: CallType[] = [
    {
        value: 'phone',
        label: 'Телефон',
        description: 'Контакти/дзвінки телефоном',
    },
    {
        value: 'radio',
        label: 'Рація',
        description: 'Радіоефір та голосовий звʼязок',
    },
    {
        value: 'messenger',
        label: 'Месенджер',
        description: 'Telegram / Signal / інші месенджери',
    },
]