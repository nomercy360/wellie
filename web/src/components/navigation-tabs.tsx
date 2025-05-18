import { cn } from '~/lib/utils'
import { useLocation } from '@solidjs/router'
import { Link } from '~/components/link'
import { store } from '~/store'
import { Motion } from '@motionone/solid'


export default function NavigationTabs(props: any) {
    const location = useLocation()

    const tabs = [
        {
            href: '/first-page',
            icon: 'home_storage',
        },
        {
            href: '/',
            icon: 'home',
        },
        {
            href: '/cook-book',
            icon: 'newsstand',
        },
        {
            href: '/add-physical',
            icon: 'add_circle',
        },
    ]

    return (
        <Motion.div
            animate={{
                opacity: [0, 1],
                y: [100, 0],
            }}
            transition={{ duration: 1 }}
        >
            <div
                class="flex flex-col items-center justify-start shadow-sm h-[110px] fixed bottom-0 w-full z-50"
            >
                <div class="flex justify-center flex-row rounded-full space-x-4 shadow-xl bg-white px-2">
                    {tabs.map(({ href, icon }) => (
                        <Link 
                            href={href}
                            state={{ from: location.pathname }}
                            class={cn('size-10 flex items-center justify-center flex-col text-sm text-gray-400', {
                                'bg-none': location.pathname === href,
                            })}
                        >
                            <span
                                class={cn('material-symbols-rounded text-[20px]', { 'text-black': location.pathname === href })}>
                                {icon}
                            </span>
                        </Link>
                    ))}
                </div>
            </div>
            {props.children}
        </Motion.div>
    )
}