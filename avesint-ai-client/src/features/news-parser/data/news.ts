// avesint-ai-client/src/features/news-parser/data/news.ts
export type NewsItemSeverity = 'low' | 'medium' | 'high'

export type NewsItem = {
    id: string
    title: string
    sourceId: string
    sourceName: string
    severity: NewsItemSeverity
    link?: string
    createdAt: string
}

export type NewsSourceType =
    | 'telegram'
    | 'twitter'
    | 'website'
    | 'rss'
    | 'other'

export type NewsSource = {
    id: string
    name: string
    type: NewsSourceType
    reliability: number // 0–1
    isActive: boolean
    lastSeenAt?: string
}