// src/routes/_authenticated/settings/ai.tsx
import { createFileRoute } from '@tanstack/react-router'
import { SettingsAI } from '@/features/settings/ai/index.tsx'

export const Route = createFileRoute('/_authenticated/settings/ai')({
  component: SettingsAI,
})