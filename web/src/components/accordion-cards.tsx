import { createSignal, onMount, onCleanup } from "solid-js";

const cardItems = [{ '1234': 1234, time: '08:30', desc: 'Lazy varenniki with strawberry jam', img: '/image.png' }, { '1234': 1234, time: '08:30', desc: 'Lazy varenniki with strawberry jam', img: '/image.png' }, { '1234': 1234, time: '08:30', desc: 'Lazy varenniki with strawberry jam', img: '/image.png' }, { '1234': 1234, time: '08:30', desc: 'Lazy varenniki with strawberry jam', img: '/image.png' }];
const tabs = ['cal', 'prt', 'lqd', 'crb', 'fat', 'scr'];

const Tab = (props: { name: string; isActive: boolean; onClick: () => void }) => (
    <button
        onClick={props.onClick}
        class=" text-[10px] font-bold uppercase rounded-full text-center transition-colors duration-200"
        style={{
            width: '35px',
            height: '20px',
            color: props.isActive ? 'white' : 'black',
            'background-color': props.isActive ? 'black' : '#F8F9FA'
        }}
    >
        {props.name}
    </button>
);

interface CardInfo {
    '1234': number,
    time: string,
    desc: string,
    img: string
}

const CardItem = (props: {
    item: CardInfo;
    index: number;
    allExpanded: boolean;
    setAllExpanded: (expanded: boolean) => void;
    scrollProgress: number;
}) => {
    const handleClick = () => {
        props.setAllExpanded(!props.allExpanded);
    };

    // Интерполируем позицию на основе прогресса скролла
    const bottomPosition = () => {
        const collapsedPos = props.index * 35;
        const expandedPos = props.index * 184;
        return collapsedPos + (expandedPos - collapsedPos) * props.scrollProgress;
    };

    const zIndex = () => {
        return props.allExpanded ? props.index + 1 : cardItems.length + props.index;
    };

    return (
        <div
            onClick={handleClick}
            class="absolute left-0 transition-all duration-150 ease-out cursor-pointer w-full"
            style={{
                bottom: `${bottomPosition()}px`,
                "z-index": -zIndex(),
          
            }}
        >
            <div class="flex flex-col bg-[#EEF9FF]  h-[180px] rounded-[12px] border-4 border-white">

                <div class="flex items-start justify-between w-full">
                    <p class="text-sm mt-2 text-gray-700 px-4 text-center transition-opacity duration-200">
                        {props.item['1234']}
                    </p>
                    <p class="text-sm mt-2 text-gray-700 px-4 text-center transition-opacity duration-200">
                        {props.item.time}
                    </p>

                </div>

                <div class="flex items-end">
                    <p class="text-sl">{props.item.desc}</p>
                    <img src={props.item.img} alt="evevr" />
                </div>
            </div>

        </div>
    );
};

const AccordionCards = () => {
    const [allExpanded, setAllExpanded] = createSignal<boolean>(false);
    const [scrollProgress, setScrollProgress] = createSignal<number>(0);
    const [activeTab, setActiveTab] = createSignal<string>(tabs[0]);
    let containerRef: HTMLDivElement | undefined;

    // Высота контейнера на основе прогресса скролла
    const containerHeight = () => {
        const minHeight = 270;
        const maxHeight = 492;
        return minHeight + (maxHeight - minHeight) * scrollProgress();
    };

    const handleWheel = (e: WheelEvent) => {
        e.preventDefault();

        const delta = e.deltaY;
        const sensitivity = 0.03; // Чувствительность скролла

        setScrollProgress(prev => {
            const newProgress = prev + (delta > 0 ? sensitivity : -sensitivity);
            return Math.max(0, Math.min(1, newProgress));
        });

        // Автоматически устанавливаем allExpanded на основе прогресса
        if (scrollProgress() > 0.8 && !allExpanded()) {
            setAllExpanded(true);
        } else if (scrollProgress() < 0.2 && allExpanded()) {
            setAllExpanded(false);
        }
    };

    onMount(() => {
        if (containerRef) {
            containerRef.addEventListener('wheel', handleWheel, { passive: false });
        }
    });

    onCleanup(() => {
        if (containerRef) {
            containerRef.removeEventListener('wheel', handleWheel);
        }
    });

    return (
        <div class="w-full max-w-md mt-[120px]">
            
            <div
                ref={containerRef!}
                class="relative w-full transition-all duration-150 ease-out"
                style={{ height: `${containerHeight()}px` }}
            >
                <div class="flex gap-2 mb-4 justify-center">
                {tabs.map(tab => (
                    <Tab
                        name={tab}
                        isActive={activeTab() === tab}
                        onClick={() => setActiveTab(tab)}
                    />
                ))}
            </div>
                {cardItems.map((item, index) => (
                    <CardItem
                        item={item}
                        index={index}
                        allExpanded={allExpanded()}
                        setAllExpanded={setAllExpanded}
                        scrollProgress={scrollProgress()}
                    />
                ))}
            </div>
        </div>
    );
};

export default AccordionCards;