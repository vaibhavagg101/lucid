'use client'

import { useContext, useState } from "react"
import { NewAudioContext } from "./new-audio-context"
import { useAuth } from "@/app/context/auth-context"
import { useRef } from "react"
import { processYoutubeURL } from "@/app/actions/youtube"
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from "@/app/google-firebase/firestore"
import { storage } from "@/app/google-firebase/storage"
import { ref, getBlob } from "firebase/storage"
import { EXTENSION_TO_TYPE_MAP } from "./upload-path"
import { isValidYoutubeUrl } from "@/app/utils/youtube-validation"

export default function YtPath() {
    const { user, loading } = useAuth()
    const { originalAudioBlob, changeOriginalAudioId, changeOriginalAudioBlob, changeFileType, changeFileExt, changeError, changeCurrentPath } = useContext(NewAudioContext)
    const [loadingYT, setLoadingYT] = useState<boolean>(false)
    const YTurlRef = useRef<HTMLInputElement>(null)

    const handleConvert = async () => {
        if (user && !loading) {
            const token = await user.getIdToken()
            const url = YTurlRef.current?.value
            if (!url) {
                changeError("Please enter a YouTube URL")
                return
            }
            if (!isValidYoutubeUrl(url)) {
                changeError("Invalid YouTube URL")
                return
            }
            try {
                setLoadingYT(true)
                const response = await processYoutubeURL({ url, token })
                if (response.error) {
                    changeError(response.error)
                    return
                }
                const jobId = response.jobId
                if (jobId) {
                    const unsub = onSnapshot(doc(db, 'jobs', jobId), async (docSnap) => {
                        if (docSnap.exists()) {
                            const data = docSnap.data()
                            if (data.status === 'completed') {
                                changeOriginalAudioId(data.audioid)
                                const filepath: string = data.filepath
                                const fileExt = filepath.split(".").pop()?.toLowerCase() || ""
                                const fileType = EXTENSION_TO_TYPE_MAP[fileExt]?.[0] || ""
                                changeFileExt(fileExt)
                                changeFileType(fileType)
                                const storageRef = ref(storage, filepath)
                                const audioBlob = await getBlob(storageRef)
                                changeOriginalAudioBlob(audioBlob)
                                changeError(null)
                                unsub()
                            } else if (data.status === 'failed') {
                                unsub()
                                changeError('Job failed')
                            }
                        }
                    })
                }

            }
            catch (error) {
                changeError(error as string)
            }
            finally {
                setLoadingYT(false)
                if (originalAudioBlob) {
                    changeCurrentPath("PreviewNoiseReduce")
                }
            }
        }

    }

    return (
        <div className="w-full">
            <div className="flex min-h-110 w-full flex-col items-center justify-center">

                <div className="text-center">
                    <h1 className="text-2xl font-bold text-on-surface md:text-3xl">
                        YouTube URL
                    </h1>

                    <p className="mt-2 text-sm text-on-surface-variant md:text-base">
                        Download audio from a YouTube URL.
                    </p>
                </div>

                <div className="mt-8 w-full max-w-125 rounded-3xl border border-outline/30 px-6 py-8 text-center md:px-10">
                    <div className="rounded-xl bg-tertiary-container px-4 py-3 text-sm text-on-tertiary">
                        This feature is currently blocked due to legal implications.
                    </div>

                    {!loadingYT ? (
                        <div className="mt-6 flex flex-col items-center gap-4">
                            <input
                                type="text"
                                ref={YTurlRef}
                                placeholder="https://www.youtube.com/watch?v=..."
                                disabled
                                className="w-full rounded-xl border border-outline/30 bg-surface px-4 py-3 text-sm text-on-surface placeholder:text-on-surface-variant disabled:opacity-60"
                            />

                            <button
                                onClick={handleConvert}
                                disabled
                                className="rounded-xl bg-primary px-6 py-3 text-sm font-medium text-on-primary opacity-80 cursor-not-allowed"
                            >
                                Convert
                            </button>
                        </div>
                    ) : (
                        <p className="mt-6 text-sm text-on-surface-variant">
                            Converting and downloading your YouTube audio...
                        </p>
                    )}
                </div>
            </div>
        </div>
    )
}