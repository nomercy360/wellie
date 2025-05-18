import {store} from '~/store'


export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL as string

export async function apiRequest<T = any>(endpoint: string, options: RequestInit = {}): Promise<{
    data: T | null
    error: string | null
}> {
    try {
        console.log(`Making request to ${API_BASE_URL}/v1${endpoint} with token: ${store.token?.substring(0, 10)}...`)
        
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
        } catch (e) {
            console.error('Failed to parse JSON response:', e)
            return {error: 'Failed to get response from server', data: null}
        }

        if (!response.ok) {
            const errorMessage =
                Array.isArray(data?.error)
                    ? data.error.join('\n')
                    : typeof data?.error === 'string'
                        ? data.error
                        : `Server error: ${response.status} ${response.statusText}`

            console.error(`API error (${response.status}):`, errorMessage)
            return {error: errorMessage, data: null}
        }

        return {data, error: null}
    } catch (error) {
        console.error('API request failed:', error)
        const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred'
        return {error: errorMessage, data: null}
    }
}


export async function getUser() {
    try {
        const response = await fetch(`${API_BASE_URL}/v1/me`, {
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${store.token}`,
            },
        })

        if (!response.ok) {
            console.error(`Failed to get user: ${response.status} ${response.statusText}`)
            return {error: 'Failed to get user data', data: null}
        }

        const data = await response.json()
        console.log('USER DATA RECEIVED:', data)

        return {data, error: null}

    } catch (error) {
        console.error('Get user error:', error)
        return {error: 'Failed to get user data', data: null}
    }
}

export interface PhysicalData {
    body_fat_percentage: number;
    gender: string;
    height: number;
    weight: number;
}

export async function addUserPhysical(data: PhysicalData) {
    return apiRequest('/physical-stats', {
        method: 'POST',
        body: JSON.stringify(data),
    });
}

export async function getUserPhysical() {
    return apiRequest('/physical-stats', {
        method: 'GET',
    });
}

