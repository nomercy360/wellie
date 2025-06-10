import HeaderDatePicker from "~/components/header-date-picker";
import AccordionCards from "~/components/accordion-cards";

export default function FirstPage() {
    return (
        <div class="relative flex flex-col items-center w-full h-screen overflow-y-auto pb-20">
            {/* Header */}
            <HeaderDatePicker />
            <div class="flex flex-col items-center justify-center h-screen w-full px-2">
                <div class="flex flex-col items-center justify-center  w-full">
                    <h1>Content</h1>
                </div>
                <AccordionCards />
            </div>
        </div>
    )
}