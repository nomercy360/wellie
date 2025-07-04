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
                class="flex flex-col items-center justify-start h-[85px] fixed bottom-0 w-full"
                style={{
                    "z-index": 999,
                }}
            >
                <div class="flex justify-center items-center flex-row rounded-full space-x-4 shadow-[0_10px_15px_-3px_rgba(0,0,0,0.3)] bg-white px-2 h-[45px]">
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