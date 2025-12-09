import { createFileRoute, redirect } from '@tanstack/react-router'

// Тимчасовий редірект: «OSINT / AI» веде до уніфікованого Stream з фільтром type=osint
export const Route = createFileRoute('/_authenticated/osint/')({
    beforeLoad: () => {
        throw redirect({
            to: '/_authenticated/stream/',
            search: { type: 'osint' },
        })
    },
    component: () => null,
})