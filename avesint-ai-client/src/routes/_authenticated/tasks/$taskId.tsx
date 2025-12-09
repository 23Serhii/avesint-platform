import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/_authenticated/tasks/$taskId')({
  component: RouteComponent,
})

function RouteComponent() {
  return <div>Hello "/_authenticated/tasks/$taskId"!</div>
}
