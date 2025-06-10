import { createSignal } from "solid-js";

const cardItems = [1, 2, 3, 4];

const CardItem = (props: {
  item: number;
  index: number;
  allExpanded: boolean;
  setAllExpanded: (expanded: boolean) => void;
}) => {
  const handleClick = () => {
    props.setAllExpanded(!props.allExpanded);
  };

  return (
    <div
      onClick={handleClick}
      class="absolute left-0 transition-all duration-300 ease-in-out cursor-pointer w-full"
      style={{
                 bottom: props.allExpanded ? `${props.index * 124}px` : `${props.index * 20}px`, 
        "z-index": props.allExpanded ? props.index + 1 : 100 - props.index, 
        height: "120px",
      }}
    >
      <div class="flex flex-col border border-4 border-white rounded-[12px] bg-[#EEF9FF] items-center justify-center h-full w-full  overflow-hidden">
        <p class="text-lg font-bold">{props.item}</p>
        {props.allExpanded && (
          <div class="text-sm mt-2 text-gray-700 px-4 text-center">
            Дополнительная информация о карточке {props.item}
          </div>
        )}
      </div>
    </div>
  );
};

const AccordionCards = () => {
  const [allExpanded, setAllExpanded] = createSignal<boolean>(false);

  return (
    <div class="relative w-full max-w-md mx-auto" style={{ height: allExpanded() ? "492px" : "500px" }}>
      {cardItems.map((item, index) => (
        <CardItem
          item={item}
          index={index}
          allExpanded={allExpanded()}
          setAllExpanded={setAllExpanded}
        />
      ))}
    </div>
  );
};

export default AccordionCards;