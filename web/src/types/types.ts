export type User = {
	avatar_url: string
	created_at: string
	deleted_at: string
	id: string
	name: string
	telegram_id: number
	physical_stats: {
		gender: string
		body_fat_percentage: number
		height: number
		weight: number
	} | null
}

export type CurrentUser = {
	avatar_url: string
	created_at: string
	deleted_at: string
	id: string
	name: string
	telegram_id: number
	updated_at: string
	username: string
}

export type FormHeaderProps = {
	title?: string
	description?: string
	step: number
	children: any
	maxSteps: number
}
