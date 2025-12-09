// src/features/ai/ai-inline-bar.tsx
import { useAiStream } from '@/features/osint/use-ai-stream'

export function AiInlineBar() {
  const { events, connected } = useAiStream()

  const latest = events.slice(0, 3)

  return (
    <div className="mb-3 rounded border bg-card/50 p-2 text-xs">
      <div className="flex items-center gap-2">
        <span
          className={
            'inline-flex h-2 w-2 rounded-full ' +
            (connected ? 'bg-green-500' : 'bg-muted-foreground')
          }
          aria-label={connected ? 'AI connected' : 'AI disconnected'}
        />
        <span className="font-medium">AI активність</span>
        <span className="ms-auto text-[11px] text-muted-foreground">
          {connected ? 'онлайн' : 'офлайн'}
        </span>
      </div>
      {latest.length > 0 ? (
        <ul className="mt-1 list-disc space-y-0.5 ps-5">
          {latest.map((e) => (
            <li key={e.id} className="text-muted-foreground">
              <span className="me-2 rounded bg-muted px-1 py-0.5 text-[10px] uppercase">{e.type}</span>
              <span className="text-foreground">{e.title}</span>
            </li>
          ))}
        </ul>
      ) : (
        <div className="mt-1 text-muted-foreground">Подій поки немає</div>
      )}
    </div>
  )
}
