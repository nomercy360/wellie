import { useNavigate } from '@solidjs/router'


export default function Index() {
	const navigate = useNavigate()

	return (
		<div class="container mx-auto px-4 py-6 max-w-md flex flex-col items-center overflow-y-auto h-screen">
			<h1>
				Hello
			</h1>
		</div>
	)
}
