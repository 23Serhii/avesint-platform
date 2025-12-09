import { createFileRoute } from '@tanstack/react-router'
import { Targets } from '@/features/targets/Targets'

export const Route = createFileRoute('/_authenticated/targets/')({
  component: Targets,
})
