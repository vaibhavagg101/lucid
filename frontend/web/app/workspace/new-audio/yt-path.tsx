'use client'

import { useContext, useState } from "react"
import { NewAudioContext } from "./page"
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
        <div>
            <p>This feature is currently blocked due to legal implications</p>
            {!loadingYT &&
                <div>
                    <input type="text" ref={YTurlRef} />
                    <button className="btn btn-primary" disabled={true} onClick={handleConvert}>
                        Convert
                    </button>
                </div>
            }
            {loadingYT &&
                <div>
                    Converting and downloading your youtube audio...
                </div>
            }
        </div>
    )
}