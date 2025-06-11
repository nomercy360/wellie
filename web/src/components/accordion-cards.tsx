import { createSignal, onMount, onCleanup } from "solid-js";

const cardItems = [1, 2, 3, 4];

const CardItem = (props: {
  item: number;
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
    const collapsedPos = props.index * 20;
    const expandedPos = props.index * 124;
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
        height: "120px",
      }}
    >
      <div class="flex flex-col border border-4 border-white rounded-[12px] bg-[#EEF9FF] items-center justify-center h-full w-full overflow-hidden">
        <p class="text-lg font-bold">{props.item}</p>
        {(props.allExpanded || props.scrollProgress > 0.3) && (
          <div 
            class="text-sm mt-2 text-gray-700 px-4 text-center transition-opacity duration-200"
            style={{ opacity: Math.max(0, (props.scrollProgress - 0.3) / 0.7) }}
          >
            Дополнительная информация о карточке {props.item}
          </div>
        )}
      </div>
    </div>
  );
};

const AccordionCards = () => {
  const [allExpanded, setAllExpanded] = createSignal<boolean>(false);
  const [scrollProgress, setScrollProgress] = createSignal<number>(0);
  let containerRef: HTMLDivElement | undefined;

  // Высота контейнера на основе прогресса скролла
  const containerHeight = () => {
    const minHeight = 300;
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
    <div 
      ref={containerRef!}
      class="relative w-full max-w-md mx-auto transition-all duration-150 ease-out" 
      style={{ height: `${containerHeight()}px` }}
    >


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
  );
};

export default AccordionCards;