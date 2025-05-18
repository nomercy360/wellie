import { createSignal } from "solid-js";
import { Motion } from "@motionone/solid";

export default function WiggleItem() {
    const [editMode, setEditMode] = createSignal(false);

    return (
        <div class="p-4">
            <button
                onClick={() => setEditMode(!editMode())}
                class="mb-4 px-4 py-2 bg-blue-500 text-white rounded"
            >
                {editMode() ? "Выход из редактирования" : "Вход в редактирование"}
            </button>

            <div class="grid grid-cols-2 gap-1">
                <Motion.div
                    animate={
                        editMode()
                            ? {
                                rotate: [3, -3, 3], // колебание влево-вправо
                            }
                            : {
                                rotate: 0,
                            }
                    }
                    transition={
                        editMode()
                            ? {
                                duration: 0.25,
                                repeat: Infinity,

                            }
                            : { duration: 0.2 }
                    }
                    class="w-20 h-20 bg-red-400 rounded-lg flex items-center justify-center text-white text-xl shadow-md"
                >
                    🗑️
                </Motion.div>
                <Motion.div
                    animate={
                        editMode()
                            ? {
                                rotate: [3, -3, 3], // колебание влево-вправо
                            }
                            : {
                                rotate: 0,
                            }
                    }
                    transition={
                        editMode()
                            ? {
                                duration: 0.25,
                                repeat: Infinity,

                            }
                            : { duration: 0.2 }
                    }
                    class="w-20 h-20 bg-blue-400 rounded-lg flex items-center justify-center text-white text-xl shadow-md"
                >
                    🗑️
                </Motion.div>
                <Motion.div
                    animate={
                        editMode()
                            ? {
                                rotate: [3, -3, 3], // колебание влево-вправо
                            }
                            : {
                                rotate: 0,
                            }
                    }
                    transition={
                        editMode()
                            ? {
                                duration: 0.25,
                                repeat: Infinity,

                            }
                            : { duration: 0.2 }
                    }
                    class="w-20 h-20 bg-red-400 rounded-lg flex items-center justify-center text-white text-xl shadow-md"
                >
                    🗑️
                </Motion.div>
                <Motion.div
                    animate={
                        editMode()
                            ? {
                                rotate: [3, -3, 3], // колебание влево-вправо
                            }
                            : {
                                rotate: 0,
                            }
                    }
                    transition={
                        editMode()
                            ? {
                                duration: 0.25,
                                repeat: Infinity,

                            }
                            : { duration: 0.2 }
                    }
                    class="w-20 h-20 bg-blue-400 rounded-lg flex items-center justify-center text-white text-xl shadow-md"
                >
                    🗑️
                </Motion.div>
            </div>
        </div>
    );
}