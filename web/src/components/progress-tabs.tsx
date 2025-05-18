import { createSignal, Show } from "solid-js";
import { setProgressTab, store } from "~/store";

export default function ProgressTabs() {
  const [selectedTab, setSelectedTab] = createSignal("rewards");


  const handleUpdateTab = (tab: string) => {
    setSelectedTab(tab);
    setProgressTab(tab);
  }

  return (
    <div class="w-full flex flex-col items-center justify-center">

      {/* Tabs */}
      <div class="flex items-center justify-center h-[50px] w-full m-5 ">
        <div
          onClick={() => setSelectedTab("rewards")}
          class={`cursor-pointer flex items-center justify-center h-[25px] w-auto px-4 py-2 m-2 rounded-full transition 
            ${selectedTab() === "rewards"
              ? "bg-primary text-secondary"
              : "bg-secondary text-primary"
            }`}
        >
          <span>Rewards</span>
        </div>

        <div
          onClick={() => setSelectedTab("statistics")}
          class={`cursor-pointer flex items-center justify-center h-[25px] w-auto px-4 py-2 m-2 rounded-full transition 
            ${selectedTab() === "statistics"
              ? "bg-primary text-secondary"
              : "bg-secondary text-primary"
            }`}
        >
          <span>Statistics</span>
        </div>
      </div>
    </div>
  );
}