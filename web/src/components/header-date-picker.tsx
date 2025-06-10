const HeaderDatePicker = () => {


    return (
        <div class="bg-background h-20 flex-shrink-0 w-full flex flex-row justify-between items-center p-5">
            <div class="flex flex-row items-center space-x-3">
                <button class="material-symbols-rounded text-[20px] bg-[#F8F9FA] text-[#051F44] text-sm font-bold px-3 py-2 rounded-[16px]">chevron_left</button>
            </div>
            <button class="bg-[#F8F9FA] text-[#051F44] text-[14px] font-bold  w-[65px] h-[40px] text-center justify-center items-center rounded-[16px]">Today</button>
            <button class="material-symbols-rounded text-[20px] bg-[#F8F9FA] text-[#051F44] text-sm font-bold px-3 py-2 rounded-[16px] ">chevron_forward</button>
        </div>
    );
};

export default HeaderDatePicker;