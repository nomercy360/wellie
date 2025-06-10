import { Motion } from '@motionone/solid';
import { useNavigate } from '@solidjs/router'
import { createSignal, Match, Switch } from 'solid-js';
import { Link } from '~/components/link';
import ProgressTabs from '~/components/progress-tabs';
import { store } from "~/store";


export default function ProgressPage() {

	const [selectedTab, setSelectedTab] = createSignal("rewards");

	const navigate = useNavigate()

	const testArrayItems = [
		1, 2, 3, 4, 5, 6, 7, 8
	]

	const mockDays = [
		"M", "T", "W", "T", "F", "S", "S"
	]

	const handleUpdateTab = (tab: string) => {
		setSelectedTab(tab);
		console.log("PROGRESS TAB", selectedTab());
	}


	return (


		<div class="relative flex flex-col items-center w-full h-screen overflow-y-auto pb-20">
			{/* Header */}
			<div class="h-20 flex-shrink-0 w-full fixed flex flex-row justify-between items-center p-5 z-50 bg-[#E9F6FF]">
				<div class="flex flex-row items-center space-x-3">
					<Link
						href={'/bookmarks'}
						state={{ from: '/' }}
						class="flex items-center justify-center bg-[#FFFFFF] rounded-[16px] size-10">
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


			<Motion.div
				class="w-full"
				initial={{ y: -200, opacity: 10 }}
				animate={{ y: 0, opacity: 1 }}
				transition={{ duration: 0.4 }}
			>

				{/* Content Top*/}
				<div class="relative">
					<div class="bg-[#E9F6FF] h-[400px] gap-4 flex flex-col items-center justify-center">
						{/* Контент */}
						<p class="text-center text-xs font-bold">Days completed</p>
						<p class="text-4xl font-bold">0 / 90</p>
						<p class="text-center w-3/4 text-gray-500">You are keeping your calories in deficit. Keep going and you’ll achieve your goal.</p>
						<div class="flex flex-row items-center justify-center gap-2 mt-8">
							{mockDays.map((item) => (
								<div class="flex flex-row items-center justify-center  w-[32px] h-[32px] rounded-[14px] bg-white p-2">
									<p class="text-xs font-bold">{item}</p>
								</div>
							))}
						</div>
					</div>
					<svg
						class="absolute bottom-0 left-0 w-full"
						viewBox="0 0 1440 40"
						preserveAspectRatio="none"
					>
						<path
							fill="white"
							d="M0,0 C720,40 720,40 1440,0 L1440,40 L0,40 Z"
						/>
					</svg>
				</div>
			</Motion.div>



			{/* Tabs */}
			<div class="w-full flex flex-col items-center justify-center">

				<div class="flex items-center justify-center h-[50px] w-full m-5 ">
					<div
						onClick={() => handleUpdateTab("rewards")}
						class={`cursor-pointer flex items-center justify-center h-[25px] w-auto px-4 py-2 m-2 rounded-full transition 
	  					${selectedTab() === "rewards"
								? "bg-primary text-secondary"
								: "bg-secondary text-primary"
							}`}
					>
						<span>Rewards</span>
					</div>

					<div
						onClick={() => handleUpdateTab("statistics")}
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


			<Switch>
				<Match when={selectedTab() === "rewards"}>
					<Motion.div
						class="w-full"
						initial={{ y: 200, opacity: 0 }}
						animate={{ y: 0, opacity: 1 }}
						transition={{ duration: 0.4 }}
					>
						{/* Content Bottom*/}
						<div class="grid grid-cols-2 h-screen justify-items-center gap-2 px-2  bg-white">
							{testArrayItems.map((item) => (
								<div class="flex flex-row items-center justify-center h-full w-full rounded-[20px] bg-[#EEF9FF]">
									<h1>
										{item}
									</h1>
								</div>
							))}
						</div>
					</Motion.div>
				</Match>
				<Match when={selectedTab() === "statistics"}>
					<Motion.div
						class="w-full"
						initial={{ y: 200, opacity: 0 }}
						animate={{ y: 0, opacity: 1 }}
						transition={{ duration: 0.5 }}
					>
						{/* Content Bottom*/}
						<div class="h-screen justify-items-center gap-2 px-2 bg-white">
							<div class="flex items-start justify-center h-full w-full rounded-[20px] bg-gray-100">
								<h1>
									test
								</h1>
							</div>
						</div>
					</Motion.div>
				</Match>
			</Switch>
		</div>
	)
}
