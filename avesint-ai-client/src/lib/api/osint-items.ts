// avesint-ai-client/src/lib/api/osint-items.ts
import { api } from './client'

export type OsintReviewVerdict = 'confirmed' | 'disproved' | 'unknown'

export type ReviewOsintItemResponse = {
  ok: true
  osintItemId: string
  sourceId: string
  sourceReliability: number
  verdict: OsintReviewVerdict
  previousVerdict: OsintReviewVerdict
  updatedEvents: Array<{
    eventId: string
    status: 'pending' | 'confirmed' | 'disproved'
  }>
}

export async function reviewOsintItem(
  osintItemId: string,
  verdict: OsintReviewVerdict
): Promise<ReviewOsintItemResponse> {
  const res = await api.post<ReviewOsintItemResponse>(
    `/osint/items/${osintItemId}/review`,
    {
      verdict,
    }
  )
  return res.data
}
