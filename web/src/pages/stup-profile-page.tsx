import { Motion } from '@motionone/solid'
import { useNavigate } from '@solidjs/router'
import {
  createEffect,
  createSignal,
  For,
  Match,
  onCleanup,
  onMount,
  Show,
  Switch
} from 'solid-js'

import ProcessBar from '~/components/pocess-bar.tsx/ProcessBar'
import WiggleItem from '~/components/test'
import { useBackButton } from '~/lib/useBackButton'
import { useMainButton } from '~/lib/useMainButton'
import { useNavigation } from '~/lib/useNavigation'


const stepTitles = {
  1: 'Nutrition tracking without hassle',
  2: 'What is your age?',
  3: 'What is your weight?',
  4: 'What is your height?',
  5: 'What is your body fat?',
  6: 'What is your target weight?',
  7: 'How fast do you want to move?',
  8: 'How fast do you want to move?',
  9: 'Set your weekly activity levels',
}

const stepDescriptions = {
  1: 'Nutrition tracking without hassle',
  2: 'Sacred is made for people to know. Search for friends you or share your link, so they can find you.',
  3: 'Sacred is made for people to know. Search for friends you or share your link, so they can find you.',
  4: 'Sacred is made for people to know. Search for friends you or share your link, so they can find you.',
  5: 'Sacred is made for people to know. Search for friends you or share your link, so they can find you.',
  6: 'Wellie helps to find and save gift ideas for yourself and loved ones, and never miss important dates.',
  7: 'Wellie helps to find and save gift ideas for yourself and loved ones, and never miss important dates.',
  8: 'Wellie helps to find and save gift ideas for yourself and loved ones, and never miss important dates.',
  9: 'Wellie helps to find and save gift ideas for yourself and loved ones, and never miss important dates.',
}

export default function SetupProfilePage() {
  const [step, setStep] = createSignal(1)
  const [title, setTitle] = createSignal('Nutrition tracking without hassle')
  const [description, setDescription] = createSignal('Wellie helps to find and save gift ideas for yourself and loved ones, and never miss important dates.')


  const navigate = useNavigate()
  const mainButton = useMainButton()
  const backButton = useBackButton()
  const { navigateBack } = useNavigation()

  const onContinue = async () => {
    if (step() === 1) {
      setStep(2)
      setTitle(stepTitles[2])
      setDescription(stepDescriptions[2])
    } else if (step() === 2) {
      setStep(3)
      setTitle(stepTitles[3])
      setDescription(stepDescriptions[3])
    } else if (step() === 3) {
      setStep(4)
      setTitle(stepTitles[4])
      setDescription(stepDescriptions[4])
    } else if (step() === 4) {
      setStep(5)
      setTitle(stepTitles[5])
      setDescription(stepDescriptions[5])
    } else if (step() === 5) {
      setStep(6)
      setTitle(stepTitles[6])
      setDescription(stepDescriptions[6])
    } else if (step() === 6) {
      setStep(7)
      setTitle(stepTitles[7])
      setDescription(stepDescriptions[7])
    } else if (step() === 7) {
      setStep(8)
      setTitle(stepTitles[8])
      setDescription(stepDescriptions[8])
    } else if (step() === 8) {
      setStep(9)
      setTitle(stepTitles[9])
      setDescription(stepDescriptions[9])
    } else if (step() === 9) {
      try {
        //await ...
        navigate('/')
      } catch (error) {
        console.error(error)
      }
    }
  }

  function decrementStep() {
    if (step() > 1) {
      setStep(step() - 1)
      return true
    }
    return false
  }

  const handleBackButton = () => {
    if (!decrementStep()) {
      navigate('/')
    }
  }

  onMount(() => {
    mainButton.onClick(onContinue)
    backButton.onClick(handleBackButton)
    backButton.setVisible()
    if (navigateBack) {
      backButton.offClick(navigateBack)
    }
  })

  onCleanup(() => {
    mainButton.hide()
    mainButton.offClick(onContinue)
    backButton.offClick(handleBackButton)
    backButton.hide()
  })

  createEffect(() => {
    if (step() === 1) {
      mainButton.enable('Start for free')
    } else {
      mainButton.enable('Continue')
    }
  })






  return (
    <div class="flex flex-col items-center justify-center h-screen">
      <ProcessBar step={step()} maxSteps={9}>
        <For each={[...Array(9).keys()]}>
          {(index) => (
            <Show when={step() === index + 1}>
              <Motion.div
                initial={{ opacity: 0, y: 50, scale: 0.95, filter: "blur(10px)" }}
                animate={{ opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }}
                exit={{ opacity: 0, y: -50, scale: 0.95, filter: "blur(10px)" }}
                transition={{ duration: 1 }}

              >
                <div class="flex-shrink-0 max-w-[350px] text-center py-6 flex flex-col items-center justify-start w-full">
                  <h1 class="text-2xl font-bold">{title()}</h1>
                  <p class="text-sm text-gray-500">{description()}</p>
                  <div class="text-sm text-gray-500">Step {index + 1}</div>
               
                </div>
              </Motion.div>
            </Show>
          )}
        </For>
      </ProcessBar>
    </div>
  )
}

// сделать кастомный по сути хук, который будет содержать в себе логику для всех этапов.  ы