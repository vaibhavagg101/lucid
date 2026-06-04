'use client'

import { noiseReduce, NoiseReduceRequest, NoiseReduceResponse } from '@/app/actions/noisereduce';
import { useCallback, useContext, useEffect, useRef, useState } from 'react';
import { formatTime, NewAudioContext } from './page';
import { useAuth } from '@/app/context/auth-context';
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
    const [loadingNrBlob, setLoadingNrBlob] = useState<boolean>(false)
    const [nrFilePath, setNrFilePath] = useState<string | null>(null)
    const [ogPlot, setOgPlot] = useState<string | null>(null)
    const [nrPlot, setNrPlot] = useState<string | null>(null)

    const wavesurferContainerRefNR = useRef<HTMLDivElement>(null)
    const waveRef = useRef<WaveSurfer | null>(null)
    const [nrAudioWavePlaying, setNrAudioWavePlaying] = useState<boolean>(false)

    useEffect(() => {
        if (nrBlob) {
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

            wave.on('play', () => setNrAudioWavePlaying(true));
            wave.on('pause', () => setNrAudioWavePlaying(false));
            
            wave.loadBlob(nrBlob)
            waveRef.current = wave

            return () => {
                wave.destroy()
                waveRef.current = null
            }
        }
    }, [nrBlob])

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
                setLoadingNrBlob(true)
                const response = await noiseReduce(request)
                if (response.nr_audio_url) {
                    const audioBlob = await fetch(response.nr_audio_url).then((res) => res.blob())
                    setNrBlob(audioBlob)
                    setNrFilePath(`${user.uid}/audio/${originalAudioId}.${fileExt}/nr-audio`)
                    const ogplot = await fetch(response.original_plot_url).then((res) => res.blob())
                    const nrplot = await fetch(response.reduced_plot_url).then((res) => res.blob())
                    if (ogplot && nrplot) {
                        setOgPlot(URL.createObjectURL(ogplot))
                        setNrPlot(URL.createObjectURL(nrplot))
                    }
                    setLoadingNrBlob(false)
                } else {
                    setLoadingNrBlob(false)
                    changeError("Noise reduction failed")
                }
            }
            catch (err) {
                setLoadingNrBlob(false)
                console.error(err)
                changeError("Noise reduction failed")
            }

        }

    }

    return (
        <div className="flex flex-col gap-4">
            {optedForNoiseReduce
                ? (
                    <>
                        <div className="flex gap-4">
                            <button onClick={() => { handleSelectClip(); setNoiseClip(true); }} className='btn-primary px-4 py-2 rounded'>
                                Select Noise Clip
                            </button>

                            {clipStartMs !== null && clipEndMs !== null && noiseClip && (
                                <span className="text-sm font-semibold text-on-surface self-center">
                                    Selected: {clipStartMs}ms - {clipEndMs}ms
                                </span>
                            )}
                        </div>

                        {noiseClip ?
                            <div className="flex gap-4">
                                <button onClick={callNoiseReduce} className='btn-primary px-4 py-2 rounded'>Confirm Selection</button>
                                <button onClick={() => setNoiseClip(false)} className='btn-primary px-4 py-2 rounded bg-opacity-50'>Cancel</button>
                            </div>
                            :
                            null}
                        {!noiseClip && <button onClick={callNoiseReduce} className='btn-primary px-4 py-2 rounded w-fit'>Start Noise Reduction without Clip</button>}

                        {loadingNrBlob && <div className="text-on-surface mt-4">Processing audio and generating plots...</div>}

                        {!loadingNrBlob && nrBlob && (
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
    // Noise Reduce stuff
    // const [isProcessing, setIsProcessing] = useState(false);
    // const [noiseReduceResult, setNoiseReduceResult] = useState<NoiseReduceResponse | null>(null);

    // const [audioTrack, setAudioTrack] = useState<Blob | null>(null)

    // const handleNoiseReduce = async () => {
    //     if (!originalAudioId || !uploadedFileType || !user) return;

    //     setIsProcessing(true);
    //     setError(null);

    //     try {
    //         // NOTE: Ensure the gsBucket and filepath match your actual Firebase Storage structure.
    //         const gsBucket = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "Main-Audio-Files-Bucket";
    //         const filepath = `${user.uid}/audio/${originalAudioId}.${uploadedFileExt}`;

    //         const response = await noiseReduce(
    //             gsBucket,
    //             filepath,
    //             uploadedFileType,
    //             false // noiseclip
    //         );

    //         setNoiseReduceResult(response);
    //     } catch (err) {
    //         setError('Noise reduction failed: ' + (err instanceof Error ? err.message : String(err)));
    //     } finally {
    //         setIsProcessing(false);
    //     }
    // };

    return (
        <></>
    )
}