import { Link } from "~/components/link";
import { store } from "~/store";

export default function CookBook() {
    return (
        <div class="relative flex flex-col items-center w-full h-screen overflow-y-auto pb-20">
            {/* Header */}
            <div class="bg-background h-20 flex-shrink-0 w-full flex flex-row justify-between items-center p-5">
                <div class="flex flex-row items-center space-x-3">
                    <Link
                        href={'/bookmarks'}
                        state={{ from: '/' }}
                        class="flex items-center justify-center bg-secondary rounded-[16px] size-10">
                        <span class="material-symbols-rounded text-[20px]">page_info</span>
                    </Link>
                </div>
                <h1 class="text-nowrap text-sl font-extrabold">Progress</h1>
                <Link href={"/profile/edit"} class="flex flex-row space-x-2 items-center justify-start" >
                    <img
                        src={store.user?.avatar_url ? store.user?.avatar_url : 'https://placehold.co/40x40'}
                        alt={store.user?.name}
                        class="size-9 rounded-[16px]"
                    />
                </Link>
            </div>
            <h1 class="text-md font-bold">Cookbook</h1>
            <div class="flex flex-col items-center w-[300px] gap-2 justify-center text-center h-screen">
                <h1 class="text-2xl w-[200px] font-bold">Recepies are coming soon</h1>
                <p class="text-sm text-[#7A8CA1]">You are keeping your calories in deficit. Keep going and you’ll achieve your goal.</p>
                <button class="bg-[#F8F9FA] text-[#051F44] text-sm font-bold px-4 mt-4 py-2 rounded-[16px]">Notify me</button>
            </div>
        </div>
    )
}