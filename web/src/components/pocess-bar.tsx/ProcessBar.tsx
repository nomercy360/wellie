import { Motion } from '@motionone/solid'
import { For, Show } from 'solid-js'
import { cn } from '~/lib/utils'

type FormHeaderProps = {
    title?: string
    description?: string
    step: number
    children: any
    maxSteps: number
}


export default function ProcessBar(props: FormHeaderProps) {
    return (
        <Motion.div
            animate={{
                opacity: [0, 1],
                y: [100, 0],
            }}
            transition={{ duration: 1 }}
        >
            <div
            class="w-full flex flex-col h-screen items-center justify-start overflow-y-scroll pb-20"
        >
            <div class="flex-shrink-0 max-w-[350px] text-center py-6 flex flex-col items-center justify-start w-full">
                <div class="flex flex-row items-center justify-center space-x-1">
                    <For each={[...Array(props.maxSteps).keys()]}>
                        {(index) => (
                            <div
                                class={cn(
                                    'w-4 h-1.5 rounded-xl',
                                    index <= props.step - 1 ? 'bg-[#007AFF]' : 'bg-muted',
                                )}
                            />
                        )}
                    </For>
                </div>
                <Show when={props.title}>
                    <p class="mt-5 leading-tight text-2xl font-extrabold">
                        {props.title}
                    </p>
                </Show>
                <Show when={props.description}>
                    <p class="mt-2 text-sm text-secondary-foreground">
                        {props.description}
                    </p>
                </Show>
            </div>
            {props.children}
        </div>
        </Motion.div>
    )
}
