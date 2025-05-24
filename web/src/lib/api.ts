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

export interface Macronutrients {
    proteins_g: number;
    fats_g: number;
    carbs_g: number;
}

export interface Micronutrients {
    [key: string]: number | undefined;
}

export interface Ingredient {
    name: string;
    quantity: number;
    unit: string;
    type: string;
    state: string;
}

export interface FoodLog {
    id: string;
    food_item_id: string;
    name: string;
    quantity: number;
    calories: number;
    image_url: string;
    meal_type: string;
    log_date: string;
    macronutrients: Macronutrients;
    ingredients: Ingredient[];
}

export interface RecognitionSummary {
    total_calories: number;
    total_proteins: number;
    total_carbs: number;
    total_fats: number;
    confidence: number;
    items_detected: number;
}

export interface FoodRecognitionResponse {
    food_logs: FoodLog[];
    summary: RecognitionSummary;
}

export interface FoodItem {
    id: string;
    name: string;
    description: string;
    calories: number;
    image_url: string;
    tags: string[];
    macronutrients: Macronutrients;
    micronutrients: Micronutrients;
    ingredients: Ingredient[];
    cooking_time: string;
}

export interface DailyFoodLog {
    date: string;
    total_calories: number;
    logs: {
        id: string;
        food_item_id: string;
        name: string;
        calories: number;
        log_time: string;
        image_url: string;
    }[];
}


export async function recognizeFood(imageFile: File): Promise<{
    data: FoodRecognitionResponse | null;
    error: string | null;
}> {
    const formData = new FormData();
    formData.append('image', imageFile);

    return apiRequest<FoodRecognitionResponse>('/food/recognize', {
        method: 'POST',
        headers: {
            'Content-Type': undefined as any, // Let browser set multipart/form-data boundary
        },
        body: formData,
    });
}

export async function getFoodItem(id: string): Promise<{
    data: FoodItem | null;
    error: string | null;
}> {
    return apiRequest<FoodItem>(`/food/${id}`, {
        method: 'GET',
    });
}

export async function getFoodLogs(): Promise<{
    data: DailyFoodLog[] | null;
    error: string | null;
}> {
    return apiRequest<DailyFoodLog[]>('/food-logs', {
        method: 'GET',
    });
}

