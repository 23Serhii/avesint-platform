import { createFileRoute, redirect } from '@tanstack/react-router'

// Тимчасовий редірект: «Новини / парсер» веде до уніфікованого Stream (тип osint поки що)
export const Route = createFileRoute('/_authenticated/news-parser/')({
  beforeLoad: () => {
    throw redirect({
      to: '/_authenticated/stream/',
      search: { type: 'osint' },
    })
  },
  component: () => null,
})
