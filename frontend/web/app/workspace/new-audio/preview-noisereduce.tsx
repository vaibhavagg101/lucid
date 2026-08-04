'use client'

import { noiseReduce, NoiseReduceRequest, NoiseReduceResponse } from '@/app/actions/noisereduce';
import { useCallback, useContext, useEffect, useRef, useState } from 'react';
import { formatTime, NewAudioContext } from './new-audio-context';
import { useAuth } from '@/app/context/auth-context';
import { doc, onSnapshot } from 'firebase/firestore';
import { db, updateNR } from '@/app/google-firebase/firestore';
import { storage } from '@/app/google-firebase/storage';
import { ref, getBlob } from 'firebase/storage';
import WaveSurfer from 'wavesurfer.js';

interface PreviewNoiseReduceProps {
    clipStartMs: number | null;
    clipEndMs: number | null;
    handleSelectClip: () => void;
}

export default function PreviewNoiseReduce({ clipStartMs, clipEndMs, handleSelectClip }: PreviewNoiseReduceProps) {
    const { user, loading } = useAuth()

    const { originalAudioId, fileExt, fileType, changeOriginalAudioBlob, changeCurrentPath, changeError } = useContext(NewAudioContext)

    const [optedForNoiseReduce, setOptedForNoiseReduce] = useState<boolean>(false)
    const [noiseClip, setNoiseClip] = useState(false)
    const [nrBlob, setNrBlob] = useState<Blob | null>(null)
    const [loadingNr, setLoadingNr] = useState<boolean>(false)
    const [nrFilePath, setNrFilePath] = useState<string | null>(null)
    const [ogPlot, setOgPlot] = useState<string | null>(null)
    const [nrPlot, setNrPlot] = useState<string | null>(null)

    const wavesurferContainerRefNR = useRef<HTMLDivElement>(null)
    const waveRef = useRef<WaveSurfer | null>(null)
    const [nrAudioWavePlaying, setNrAudioWavePlaying] = useState<boolean>(false)

    useEffect(() => {
        if (nrBlob && !loadingNr) {
            // Delay before creating the wave
            const nrTimer = setTimeout(() => {

                if (!wavesurferContainerRefNR.current) return;

                if (waveRef.current) {
                    waveRef.current.destroy()
                }

                const wave = WaveSurfer.create(
                    {
                        container: wavesurferContainerRefNR.current,
                        height: 100,
                        waveColor: 'rgb(28, 27, 31)',
                        progressColor: 'rgb(255, 202, 40)',
                        minPxPerSec: 50,
                    }
                )

                // debugging
                wave.on('error', (err) => console.error("WaveSurfer Exception:", err));
                wave.on('decode', (duration) => console.log("Decoded successfully. Duration:", duration));

                wave.on('play', () => setNrAudioWavePlaying(true));
                wave.on('pause', () => setNrAudioWavePlaying(false));

                wave.loadBlob(nrBlob)
                waveRef.current = wave
            }, 100)

            return () => {
                clearTimeout(nrTimer)
                if (waveRef.current) {
                    waveRef.current.destroy()
                    waveRef.current = null
                }
            }
        }
    }, [nrBlob, loadingNr])

    const callNoiseReduce = async () => {
        if (user) {
            const token = await user.getIdToken()
            const gsBucket = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
            const filepath = `${user.uid}/audio/${originalAudioId}.${fileExt}`;
            const filetype = fileType
            if (!originalAudioId || !fileExt || !filetype || !gsBucket) {
                console.error("Missing required parameters for noise reduction")
                return;
            }
            try {
                const request: NoiseReduceRequest = {
                    token,
                    gsBucket,
                    filepath,
                    filetype,
                    noiseclip: noiseClip,
                    ...(noiseClip && clipStartMs !== null && clipEndMs !== null && {
                        startPoint: clipStartMs,
                        endPoint: clipEndMs
                    })
                }
                setLoadingNr(true)
                const response = await noiseReduce(request)
                if (response.jobId) {
                    let unsub: (() => void) | undefined;
                    unsub = onSnapshot(
                        doc(db, 'jobs', response.jobId),
                        async (docSnap) => {
                            if (docSnap.exists()) {
                                const data = docSnap.data();
                                if (data.status === 'completed') {
                                    try {
                                        const rawBlob = await getBlob(ref(storage, data.nr_audio_path))
                                        const audioBlob = new Blob([rawBlob], { type: filetype })
                                        setNrBlob(audioBlob)

                                        console.log("Blob size:", audioBlob.size, "bytes");
                                        console.log("Blob type:", audioBlob.type);

                                        setNrFilePath(data.nr_audio_path)

                                        const ogplot = await getBlob(ref(storage, data.original_plot_path))

                                        const nrplot = await getBlob(ref(storage, data.reduced_plot_path))

                                        if (ogplot && nrplot) {
                                            setOgPlot(URL.createObjectURL(ogplot))
                                            setNrPlot(URL.createObjectURL(nrplot))
                                        }
                                    } catch (e) {
                                        console.error("Error fetching completed assets:", e)
                                        changeError("Failed to fetch generated assets")
                                    } finally {
                                        setLoadingNr(false)
                                        setNoiseClip(false)
                                        if (unsub) unsub()
                                    }
                                } else if (data.status === 'failed') {
                                    setLoadingNr(false)
                                    changeError("Noise reduction failed: " + (data.error || "Unknown error"))
                                    if (unsub) unsub()
                                }
                            }
                        },
                        (error) => {
                            console.error("Firestore onSnapshot error:", error);
                            changeError("Error checking job status. Check your Firestore Security Rules.");
                            setLoadingNr(false);
                            if (unsub) unsub();
                        }
                    );
                } else {
                    setLoadingNr(false)
                    changeError("Noise reduction failed in Nextjs Server")
                }
            }
            catch (err) {
                setLoadingNr(false)
                console.error(err)
                changeError("Noise reduction failed")
            }

        }

    }

    const pickNR = async () => {
        try {
            if (user && nrFilePath && nrBlob && originalAudioId) {
                await updateNR(true, user.uid, originalAudioId, nrFilePath)
                changeOriginalAudioBlob(nrBlob)
                setNrBlob(null)
                setOgPlot(null)
                setNrPlot(null)
                if (waveRef.current) {
                    waveRef.current.destroy()
                    waveRef.current = null
                }
                changeCurrentPath("StartAudioProcessing")
            }
        }
        catch (e) {
            console.log(e)
            changeError(e instanceof Error ? e.message : String(e))
        }
    }

    const pickOG = async () => {
        try {
            if (user && originalAudioId) {
                await updateNR(false, user.uid, originalAudioId)
            }
        }
        catch (e) {
            console.log(e)
            changeError(e instanceof Error ? e.message : String(e))
        }
        setNrBlob(null)
        setOgPlot(null)
        setNrPlot(null)
        if (waveRef.current) {
            waveRef.current.destroy()
            waveRef.current = null
        }
        changeCurrentPath("StartAudioProcessing")
    }

    useEffect(() => {
        return () => {
            if (ogPlot) URL.revokeObjectURL(ogPlot);
            if (nrPlot) URL.revokeObjectURL(nrPlot);
        };
    }, [ogPlot, nrPlot])

    return (
        <div className="flex flex-col items-center gap-4 mt-5 pb-6">
            {optedForNoiseReduce
                ? (
                    <>
                        {!nrBlob && (
                            <div className="flex flex-col items-center gap-3">
                                <button onClick={() => { handleSelectClip(); setNoiseClip(true); }} className="min-w-55 rounded-xl bg-primary px-6 py-3 text-sm font-medium text-on-primary hover:bg-primary-variant cursor-pointer transition-colors">
                                    Select Noise Clip
                                </button>

                                {clipStartMs !== null && clipEndMs !== null && noiseClip && (
                                    <span className="text-sm font-medium text-on-surface-variant text-center">
                                        Selected: {clipStartMs}ms - {clipEndMs}ms
                                    </span>
                                )}
                            </div>)}

                        {noiseClip ?
                            <div className="flex items-center justify-center gap-3">
                                <button
                                    onClick={callNoiseReduce}
                                    className="min-w-55 rounded-xl bg-primary px-6 py-3 text-sm font-medium text-on-primary hover:bg-primary-variant cursor-pointer transition-colors"
                                >
                                    Confirm Selection
                                </button>

                                <button
                                    onClick={() => setNoiseClip(false)}
                                    className="min-w-55 rounded-xl border border-primary bg-transparent px-6 py-3 text-sm font-medium text-primary hover:bg-surface-variant cursor-pointer transition-colors"
                                >
                                    Cancel
                                </button>
                            </div>
                            :
                            null}
                        {!noiseClip && !nrBlob && <button onClick={callNoiseReduce} className="min-w-55 rounded-xl border border-primary bg-transparent px-6 py-3 text-sm font-medium text-primary hover:bg-primary/5 cursor-pointer transition-colors">Start Noise Reduction without Clip</button>}

                        {loadingNr && <p className="mt-4 text-sm text-on-surface-variant">Processing audio and generating plots...</p>}

                        {!loadingNr && nrBlob && (
                            <div className="mt-6 flex w-full max-w-2xl flex-col gap-6 rounded-3xl border border-outline/30 p-6 md:p-8">
                                <div>
                                    <h3 className="mb-3 text-lg font-semibold text-on-surface">Original Audio Plot</h3>
                                    {ogPlot && <img src={ogPlot} alt="Original Audio Plot" className="w-full rounded-2xl border border-outline/30 shadow-sm" />}
                                </div>

                                <div>
                                    <h3 className="mb-3 text-lg font-semibold text-on-surface">Noise Reduced Plot</h3>
                                    {nrPlot && <img src={nrPlot} alt="Noise Reduced Audio Plot" className="w-full rounded-2xl border border-outline/30 shadow-sm" />}
                                </div>

                                <div>
                                    <h3 className="mb-3 text-lg font-semibold text-on-surface">Noise Reduced Audio</h3>
                                    <div ref={wavesurferContainerRefNR} className="w-full overflow-hidden rounded-2xl border border-outline/30 bg-background"></div>

                                    <div className="mt-4 flex justify-center">
                                        <button
                                            onClick={() => waveRef.current?.playPause()}
                                            className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-xl bg-primary text-on-primary transition-colors hover:bg-primary-variant"
                                            aria-label={nrAudioWavePlaying ? 'Pause audio' : 'Play audio'}
                                        >
                                            {nrAudioWavePlaying ? (
                                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5">
                                                    <path d="M6.75 5.25A.75.75 0 017.5 4.5h2.25a.75.75 0 01.75.75v13.5a.75.75 0 01-.75.75H7.5a.75.75 0 01-.75-.75V5.25zm6.75 0a.75.75 0 01.75-.75h2.25a.75.75 0 01.75.75v13.5a.75.75 0 01-.75.75h-2.25a.75.75 0 01-.75-.75V5.25z" />
                                                </svg>
                                            ) : (
                                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5">
                                                    <path d="M8.25 5.25v13.5L18.75 12 8.25 5.25z" />
                                                </svg>
                                            )}
                                        </button>
                                    </div>
                                </div>

                                <div className="flex flex-col items-center gap-3 border-t border-outline/30 pt-6 text-center">
                                    <p className="text-sm text-on-surface-variant">
                                        Pick the noise reduced audio or continue with the original audio.
                                    </p>

                                    <div className="flex flex-col items-center gap-3 sm:flex-row">
                                        <button
                                            onClick={pickNR}
                                            className="min-w-45 rounded-xl bg-primary px-6 py-3 text-sm font-medium text-on-primary transition-colors hover:bg-primary-variant cursor-pointer"
                                        >
                                            Use NR Audio
                                        </button>

                                        <button
                                            onClick={pickOG}
                                            className="min-w-45 rounded-xl border border-primary bg-transparent px-6 py-3 text-sm font-medium text-primary transition-colors hover:bg-surface-variant cursor-pointer"
                                        >
                                            Use Original Audio
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}
                    </>
                )
                : (
                    <div className="flex w-full flex-col items-center justify-center gap-4 sm:flex-row mt-6">
                        <button
                            onClick={() => {
                                setOptedForNoiseReduce(true)
                            }}
                            className="w-full rounded-xl bg-primary px-6 py-3 text-sm font-medium text-on-primary transition-colors hover:bg-primary-variant cursor-pointer sm:w-auto sm:min-w-53.75"
                        >
                            Preview Noise Reduction?
                        </button>

                        <button
                            onClick={() => {
                                pickOG()
                                changeCurrentPath("StartAudioProcessing")
                            }}
                            className="w-full rounded-xl border border-primary bg-transparent px-6 py-3 text-sm font-medium text-primary transition-colors hover:bg-surface-variant cursor-pointer sm:w-auto sm:min-w-67"
                        >
                            Continue without Noise Reduction
                        </button>
                    </div>

                )
            }
        </div>
    )
}