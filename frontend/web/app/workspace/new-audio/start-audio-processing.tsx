'use client'

import { useContext, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/app/context/auth-context'
import { NewAudioContext } from './new-audio-context'
import { updateSeparationOption } from '@/app/google-firebase/firestore'

type SeparationOption = 0 | 2 | 4 | 6;

const OPTIONS: { value: SeparationOption; title: string; description: string }[] = [
    { value: 2, title: '2 Stems', description: 'Vocals and Others' },
    { value: 4, title: '4 Stems', description: 'Vocals, Drums, Bass and Other' },
    { value: 6, title: '6 Stems', description: 'Vocals, Drums, Bass, Guitar, Piano and Other' },
    { value: 0, title: 'No Separation', description: 'Keep the audio as a single track' },
];

export default function StartAudioProcessing() {
    const { user } = useAuth()
    const router = useRouter()
    const { originalAudioId, changeError } = useContext(NewAudioContext)

    const [selectedOption, setSelectedOption] = useState<SeparationOption | null>(null)
    const [submitting, setSubmitting] = useState(false)

    const handleSelect = (option: SeparationOption) => {
        setSelectedOption(option)
    }

    const canSubmit = selectedOption !== null

    const handleSubmit = async () => {
        if (!user || !originalAudioId || selectedOption === null) return

        setSubmitting(true)
        try {
            await updateSeparationOption(user.uid, originalAudioId, selectedOption)
            router.push(`/workspace/audio/${originalAudioId}`)
        } catch (err) {
            changeError(err instanceof Error ? err.message : 'Failed to start audio processing.')
        } finally {
            setSubmitting(false)
        }
    }

    return (
        <div className="w-full">
            <div className="flex min-h-110 sm:mt-6 md:mt-1 w-full flex-col items-center justify-center">

                <div className="text-center">
                    <h1 className="text-2xl font-bold text-on-surface md:text-3xl">
                        Choose Stem Separation
                    </h1>

                    <p className="mt-3 text-sm text-on-surface-variant md:text-base">
                        Pick how you would like this audio split into stems.
                    </p>
                </div>

                <div className="mt-10 grid w-full max-w-4xl grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
                    {OPTIONS.map((option) => {
                        const isSelected = selectedOption === option.value
                        return (
                            <button
                                key={option.value}
                                onClick={() => handleSelect(option.value)}
                                disabled={submitting}
                                className={`flex min-h-45 flex-col items-center justify-center rounded-2xl border p-6 shadow-xs glassmorphism-surface transition-all duration-200 hover:shadow-md dark:hover:bg-white/10 dark:hover:border-white/20 cursor-pointer disabled:cursor-not-allowed disabled:opacity-60 ${isSelected ? 'border-primary ring-2 ring-primary/30' : 'border-outline/30'
                                    }`}
                            >
                                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-surface-variant">
                                    <svg
                                        xmlns="http://www.w3.org/2000/svg"
                                        className="h-6 w-6 text-primary dark:text-white/80"
                                        fill="none"
                                        viewBox="0 0 24 24"
                                        stroke="currentColor"
                                        strokeWidth={1.5}
                                    >
                                        {option.value === 0 ? (
                                            <path
                                                strokeLinecap="round"
                                                strokeLinejoin="round"
                                                d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"
                                            />
                                        ) : (
                                            <path
                                                strokeLinecap="round"
                                                strokeLinejoin="round"
                                                d="M6 6.878V6a2.25 2.25 0 012.25-2.25h7.5A2.25 2.25 0 0118 6v.878m-12 0c.235-.083.487-.128.75-.128h10.5c.263 0 .515.045.75.128m-12 0A2.25 2.25 0 004.5 9v.878m13.5-3A2.25 2.25 0 0119.5 9v.878m0 0a2.246 2.246 0 00-.75-.128H5.25c-.263 0-.515.045-.75.128m15 0A2.25 2.25 0 0121 12v6a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 18v-6c0-.98.626-1.813 1.5-2.122"
                                            />
                                        )}
                                    </svg>
                                </div>

                                <span className="mt-5 text-lg font-semibold text-on-surface">
                                    {option.title}
                                </span>

                                <span className="mt-3 text-center text-sm text-on-surface-variant">
                                    {option.description}
                                </span>
                            </button>
                        )
                    })}
                </div>

                {selectedOption !== null && (
                    <button
                        onClick={handleSubmit}
                        disabled={!canSubmit || submitting}
                        className={`mt-8 min-w-55 rounded-xl px-6 py-3 text-sm font-medium text-on-primary transition-colors ${!canSubmit || submitting
                            ? 'bg-primary opacity-60 cursor-not-allowed'
                            : 'bg-primary hover:bg-primary-variant cursor-pointer'
                            }`}
                    >
                        {submitting ? 'Processing...' : 'Confirm & Continue'}
                    </button>
                )}
            </div>
        </div>
    )
}
