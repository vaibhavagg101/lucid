'use client'

import { noiseReduce, NoiseReduceResponse } from '@/app/actions/noisereduce';
import { useCallback, useContext, useState } from 'react';
import { NewAudioContext } from './page';

interface PreviewNoiseReduceProps {
    clipStartMs: number | null;
    clipEndMs: number | null;
    handleSelectClip: () => void;
}

export default function PreviewNoiseReduce({ clipStartMs, clipEndMs, handleSelectClip }: PreviewNoiseReduceProps) {
    const [optedForNoiseReduce, setOptedForNoiseReduce] = useState<boolean>(false)
    const { changeOriginalAudioBlob, changeCurrentPath } = useContext(NewAudioContext)

    return (
        <div>
            {optedForNoiseReduce
                ? (
                    <>
                        <button onClick={handleSelectClip} className='btn-primary px-4 py-2 rounded'>
                            Select Clip
                        </button>
                        {clipStartMs !== null && clipEndMs !== null && (
                            <span className="text-sm font-semibold text-on-surface">
                                Selected: {clipStartMs}ms - {clipEndMs}ms
                            </span>
                        )}
                    </>
                )
                : (
                    <>
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
                    </>
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