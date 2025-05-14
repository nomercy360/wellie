import {store} from '~/store'

export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL as string

export async function apiRequest<T = any>(endpoint: string, options: RequestInit = {}): Promise<{
    data: T | null
    error: string | null
}> {
    try {
        const response = await fetch(`${API_BASE_URL}/v1${endpoint}`, {
            ...options,
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${store.token}`,
                ...(options.headers || {}),
            },
        })

        let data
        try {
            data = await response.json()
        } catch {
            return {error: 'Failed to get response from server', data: null}
        }

        if (!response.ok) {
            const errorMessage =
                Array.isArray(data?.error)
                    ? data.error.join('\n')
                    : typeof data?.error === 'string'
                        ? data.error
                        : 'An error occurred'

            return {error: errorMessage, data: null}
        }

        return {data, error: null}
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred'
        return {error: errorMessage, data: null}
    }
}

export interface User {
    id: string
    telegram_id: number
    username: string
    avatar_url: string
    name: string
    created_at: string
    updated_at: string
}
