import { Motion } from '@motionone/solid';
import { useNavigate } from '@solidjs/router'
import { Link } from '~/components/link';
import ProgressTabs from '~/components/progress-tabs';
import { store } from "~/store";


export default function HomePage() {

	const navigate = useNavigate()

	const testArrayItems = [
		1, 2, 3, 4, 5, 6, 7, 8
	]


	console.log("USER", store.user)

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
				transition={{ duration: 1 }}
			>

				{/* Content Top*/}
				<div class="relative">
					<div class="bg-[#E9F6FF] h-[400px] flex flex-col items-center justify-center">
						{/* Контент */}
						<h1 class="text-2xl font-bold">0 / 90</h1>
						<p class="text-center px-4">You are keeping your calories in deficit. Keep going and you’ll achieve your goal.</p>
					</div>

					{/* Волна снизу */}
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
			

			<ProgressTabs />


			<Motion.div
				class="w-full"
				initial={{ y: 200, opacity: 0 }}
				animate={{ y: 0, opacity: 1 }}
				transition={{ duration: 1 }}
			>
				{/* Content Bottom*/}
				<div class="grid grid-cols-2 justify-items-center gap-2 px-3 h-full w-full bg-white">
					{testArrayItems.map((item) => (
						<div class="flex flex-row items-center justify-center h-[204px] w-[204px] rounded-[20px] bg-[#EEF9FF]">
							<h1>
								{item}
							</h1>
						</div>
					))}
				</div>
			</Motion.div>


		</div>
	)
}
