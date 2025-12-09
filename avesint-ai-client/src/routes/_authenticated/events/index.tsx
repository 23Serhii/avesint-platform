import { createFileRoute } from '@tanstack/react-router'
import { Events } from '@/features/events'

// Справжня «Стрічка подій» тепер працює, з вбудованою AI‑панеллю (див. VITE_FEATURE_AI_ASSISTANT)
export const Route = createFileRoute('/_authenticated/events/')({
  component: Events,
})
