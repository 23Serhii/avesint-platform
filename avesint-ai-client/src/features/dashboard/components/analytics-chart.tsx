// src/features/dashboard/components/analytics-chart.tsx
import { Area, AreaChart, ResponsiveContainer, XAxis, YAxis } from 'recharts'

const data = [
    {
        name: 'Пн',
        events: Math.floor(Math.random() * 40) + 10,
        tasks: Math.floor(Math.random() * 25) + 5,
    },
    {
        name: 'Вт',
        events: Math.floor(Math.random() * 40) + 10,
        tasks: Math.floor(Math.random() * 25) + 5,
    },
    {
        name: 'Ср',
        events: Math.floor(Math.random() * 40) + 10,
        tasks: Math.floor(Math.random() * 25) + 5,
    },
    {
        name: 'Чт',
        events: Math.floor(Math.random() * 40) + 10,
        tasks: Math.floor(Math.random() * 25) + 5,
    },
    {
        name: 'Пт',
        events: Math.floor(Math.random() * 40) + 10,
        tasks: Math.floor(Math.random() * 25) + 5,
    },
    {
        name: 'Сб',
        events: Math.floor(Math.random() * 40) + 10,
        tasks: Math.floor(Math.random() * 25) + 5,
    },
    {
        name: 'Нд',
        events: Math.floor(Math.random() * 40) + 10,
        tasks: Math.floor(Math.random() * 25) + 5,
    },
]

export function AnalyticsChart() {
    return (
        <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={data}>
                <XAxis
                    dataKey="name"
                    stroke="#888888"
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                />
                <YAxis
                    stroke="#888888"
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                />
                <Area
                    type="monotone"
                    dataKey="events"
                    stroke="currentColor"
                    className="text-primary"
                    fill="currentColor"
                    fillOpacity={0.18}
                />
                <Area
                    type="monotone"
                    dataKey="tasks"
                    stroke="currentColor"
                    className="text-muted-foreground"
                    fill="currentColor"
                    fillOpacity={0.12}
                />
            </AreaChart>
        </ResponsiveContainer>
    )
}