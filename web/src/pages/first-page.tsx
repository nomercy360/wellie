import HeaderDatePicker from "~/components/header-date-picker";
import AccordionCards from "~/components/accordion-cards";

export default function FirstPage() {
    return (
        <div class="relative flex flex-col items-center w-full h-screen overflow-y-auto pb-20">
            <HeaderDatePicker />
            <div class="flex flex-col items-center justify-start h-screen w-full px-2">
                <div class="flex flex-col items-center justify-center text-center gap-5 w-full">
                    <h1 class="text-sm font-bold">Calories left</h1>
                    <span class="text-4xl font-bold">48</span>
                    <span class="text-sm w-[290px] text-gray-500">You are keeping your calories in deficit. Keep going and you’ll achieve your goal.</span>
                </div>
                <AccordionCards />
            </div>
        </div>
    )
}