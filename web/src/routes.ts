import type {RouteDefinition} from '@solidjs/router'
import HomePage from '~/pages/home-page'
import AddPhysical from '~/pages/add-physical'
import NavigationTabs from '~/components/navigation-tabs'
import CookBook from '~/pages/cook-book'
import FirstPage from '~/pages/first-page'
import SetupProfilePage from './pages/stup-profile-page'
export const routes: RouteDefinition[] = [
    {
        'path': '/',
        'component': NavigationTabs,
        children: [
            {
                'path': '/',
                'component': HomePage,
            },
            {
                'path': '/cook-book',
                'component': CookBook,
            },
            {
                'path': '/first-page',
                'component': FirstPage,
            },
        ],  
    },
    {
        'path': '/setup',
        'component': SetupProfilePage,
    },
    {
        'path': '/add-physical',
        'component': AddPhysical,
    },
]
//группировка маршрутов по функциональности (например, auth/, profile/, etc.) если приложение будет расти.