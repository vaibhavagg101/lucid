'use client'

import { noiseReduce, NoiseReduceRequest, NoiseReduceResponse } from '@/app/actions/noisereduce';
import { useCallback, useContext, useEffect, useRef, useState } from 'react';
import { formatTime, NewAudioContext } from './page';
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
                await updateNR(true, nrFilePath, user.uid, originalAudioId)
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

    const pickOG = () => {
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
        <div className="flex flex-col gap-4">
            {optedForNoiseReduce
                ? (
                    <>
                        {!nrBlob && <div className="flex gap-4">
                            <button onClick={() => { handleSelectClip(); setNoiseClip(true); }} className='btn-primary px-4 py-2 rounded'>
                                Select Noise Clip
                            </button>

                            {clipStartMs !== null && clipEndMs !== null && noiseClip && (
                                <span className="text-sm font-semibold text-on-surface self-center">
                                    Selected: {clipStartMs}ms - {clipEndMs}ms
                                </span>
                            )}
                        </div>}

                        {noiseClip ?
                            <div className="flex gap-4">
                                <button onClick={callNoiseReduce} className='btn-primary px-4 py-2 rounded'>Confirm Selection</button>
                                <button onClick={() => setNoiseClip(false)} className='btn-primary px-4 py-2 rounded bg-opacity-50'>Cancel</button>
                            </div>
                            :
                            null}
                        {!noiseClip && !nrBlob && <button onClick={callNoiseReduce} className='btn-primary px-4 py-2 rounded w-fit'>Start Noise Reduction without Clip</button>}

                        {loadingNr && <div className="text-on-surface mt-4">Processing audio and generating plots...</div>}

                        {!loadingNr && nrBlob && (
                            <div className="flex flex-col gap-6 mt-6">
                                <div>
                                    <h3 className="text-lg font-bold text-on-surface mb-2">Original Audio Plot</h3>
                                    {ogPlot && <img src={ogPlot} alt="Original Audio Plot" className="w-full max-w-2xl border rounded shadow-sm" />}
                                </div>
                                <div>
                                    <h3 className="text-lg font-bold text-on-surface mb-2">Noise Reduced Plot</h3>
                                    {nrPlot && <img src={nrPlot} alt="Noise Reduced Audio Plot" className="w-full max-w-2xl border rounded shadow-sm" />}
                                </div>

                                <div className="w-full max-w-2xl">
                                    <h3 className="text-lg font-bold text-on-surface mb-2">Noise Reduced Audio</h3>
                                    <div ref={wavesurferContainerRefNR} className="w-full bg-surface border rounded"></div>
                                    <button
                                        className="btn-primary mt-2 px-4 py-2 rounded"
                                        onClick={() => waveRef.current?.playPause()}
                                    >
                                        {nrAudioWavePlaying ? 'Pause' : 'Play'}
                                    </button>
                                </div>
                                <div>
                                    Pick noisereduced audio or use original audio instead?
                                    <button onClick={pickNR} className='btn-primary px-4 py-2 rounded w-fit'>
                                        Use NR audio
                                    </button>
                                    <button onClick={pickOG} className='btn-primary px-4 py-2 rounded w-fit'>
                                        Use original audio
                                    </button>
                                </div>
                            </div>
                        )}
                    </>
                )
                : (
                    <div className="flex gap-4">
                        <button
                            onClick={() => {
                                setOptedForNoiseReduce(true)
                            }}
                            className='btn-primary px-4 py-2 rounded'>
                            Preview Noise Reduction?
                        </button>
                        <button
                            onClick={() => {
                                changeCurrentPath("StartAudioProcessing")
                            }}
                            className='btn-primary px-4 py-2 rounded'>
                            Continue without Noise Reduction
                        </button>
                    </div>
                )
            }
        </div>
    )
}