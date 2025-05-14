import {createStore} from 'solid-js/store'
import {User as ApiUser} from '~/lib/api'

export type User = ApiUser

export const [store, setStore] = createStore<{
    user: User
    token: string | null
}>({
    user: {} as User,
    token: null,
})

export const setUser = (user: User) => setStore('user', user)

export const setToken = (token: string) => setStore('token', token)

