import { createQuery } from "@tanstack/solid-query"
import { getUser, addUserPhysical, PhysicalData } from "~/lib/api"
import { Match, Switch, createEffect, createSignal, onMount, onCleanup } from "solid-js"
import { CurrentUser } from "~/types/types"
import { useMainButton } from "~/lib/useMainButton"
import { useNavigate } from "@solidjs/router"
export default function AddPhysical() {
    const [bodyFat, setBodyFat] = createSignal<number>(0);
    const [gender, setGender] = createSignal<string>("male");
    const [height, setHeight] = createSignal<number>(170);
    const [weight, setWeight] = createSignal<number>(70);
    const [isSubmitting, setIsSubmitting] = createSignal<boolean>(false);
    const [submitResult, setSubmitResult] = createSignal<{success: boolean, message: string} | null>(null);

    const mainButton = useMainButton()

    const navigate = useNavigate()

    const user = createQuery<CurrentUser>(() => ({
        queryKey: ['user'],
        queryFn: async () => {
            const result = await getUser();
            if (result.error) {
                throw new Error(result.error);
            }
            return result.data;
        },
    }))

    const handleSubmit = async () => {
        if (isSubmitting()) return;
        
        setIsSubmitting(true);
        setSubmitResult(null);
        
        try {
            const physicalData: PhysicalData = {
                body_fat_percentage: bodyFat(),
                gender: gender(),
                height: height(),
                weight: weight()
            };
            
            const result = await addUserPhysical(physicalData);
            
            if (result.error) {
                setSubmitResult({
                    success: false,
                    message: `Ошибка: ${result.error}`
                });
            } else {
                setSubmitResult({
                    success: true,
                    message: "Физические данные успешно сохранены!"
                });
                
                setTimeout(() => {
                    navigate('/');
                }, 1500);
            }
        } catch (error) {
            setSubmitResult({
                success: false,
                message: `Произошла ошибка: ${error instanceof Error ? error.message : "Неизвестная ошибка"}`
            });
        } finally {
            setIsSubmitting(false);
        }
    };

    createEffect(() => {
        if (bodyFat() > 0 && height() > 0 && weight() > 0) {
            mainButton.enable('Сохранить данные')
        } else {
            mainButton.disable('Сохранить данные')
        }
    })

    onMount(() => {
        mainButton.onClick(handleSubmit);
        
    });

    onCleanup(() => {
        mainButton.offClick(handleSubmit);
        mainButton.hide()
    });

    return (
        <div class="relative flex flex-col items-center w-full h-screen">
            <div class="bg-background h-20 fixed flex-shrink-0 w-full flex flex-row justify-between items-center p-5 z-10">
                <h1 class="text-black text-2xl font-extrabold">Физические данные</h1>
            </div>

            <div class="text-center flex-1 overflow-y-auto w-full mt-20 p-4">
                <Switch>
                    <Match when={user.isLoading}>
                        <p class="mt-4">Загрузка данных пользователя...</p>
                    </Match>

                    <Match when={user.error}>
                        <div class="mt-4">
                            <p class="text-red-500">Ошибка загрузки данных: {user.error?.message}</p>
                            <button
                                class="mt-12 px-4 py-2 bg-primary text-white rounded-2xl"
                                onClick={() => user.refetch()}
                            >
                                Повторить
                            </button>
                        </div>
                    </Match>

                    <Match when={!user.isLoading && user.data}>
                        <div class="mt-8">
                            <div class="flex flex-col gap-4">
                                <div class="flex flex-col">
                                    <label class="text-left mb-1 text-sm font-semibold">Пол</label>
                                    <select 
                                        value={gender()} 
                                        onChange={(e) => setGender(e.target.value)}
                                        class="p-2 border rounded-lg"
                                    >
                                        <option value="male">Мужской</option>
                                        <option value="female">Женский</option>
                                    </select>
                                </div>
                                
                                <div class="flex flex-col">
                                    <label class="text-left mb-1 text-sm font-semibold">Рост (см)</label>
                                    <input 
                                        type="number" 
                                        value={height()} 
                                        onInput={(e) => setHeight(parseFloat(e.target.value))}
                                        class="p-2 border rounded-lg"
                                        min="50"
                                        max="250"
                                        step="0.1"
                                    />
                                </div>
                                
                                <div class="flex flex-col">
                                    <label class="text-left mb-1 text-sm font-semibold">Вес (кг)</label>
                                    <input 
                                        type="number" 
                                        value={weight()} 
                                        onInput={(e) => setWeight(parseFloat(e.target.value))}
                                        class="p-2 border rounded-lg"
                                        min="30"
                                        max="300"
                                        step="0.1"
                                    />
                                </div>
                                
                                <div class="flex flex-col">
                                    <label class="text-left mb-1 text-sm font-semibold">Процент жира (%)</label>
                                    <input 
                                        type="number" 
                                        value={bodyFat()} 
                                        onInput={(e) => setBodyFat(parseFloat(e.target.value))}
                                        class="p-2 border rounded-lg"
                                        min="0"
                                        max="100"
                                        step="0.1"
                                    />
                                </div>
                                
                                {isSubmitting() && (
                                    <p class="mt-4">Сохранение...</p>
                                )}
                                
                                {submitResult() && (
                                    <div class={`mt-2 p-2 text-sm rounded-lg ${submitResult()?.success ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                                        {submitResult()?.message}
                                    </div>
                                )}
                            </div>
                        </div>
                    </Match>
                </Switch>
            </div>
        </div>
    )
}