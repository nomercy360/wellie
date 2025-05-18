import { createStore } from 'solid-js/store'
import { User as ApiUser } from '~/types/types'

export type User = ApiUser

export const [store, setStore] = createStore<{
    user: User
    token: string | null
    progressTab: string
}>({
    user: {} as User,
    token: null,
    progressTab: 'rewards'
})

export const setUser = (user: User) => setStore('user', user)

export const setToken = (token: string) => setStore('token', token)

export const setProgressTab = (tab: string) => setStore('progressTab', tab)
