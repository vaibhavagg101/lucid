'use client';

import { useState, useRef, useContext, useEffect, useCallback } from 'react';
import { NewAudioContext, formatTime } from './new-audio-context';
import { useAuth } from '../../context/auth-context';
import { useRouter } from 'next/navigation';
import RecordPath from './record-path'
import UploadPath from './upload-path'
import YtPath from './yt-path'
import PreviewNoiseReduce from './preview-noisereduce';
import StartAudioProcessing from './start-audio-processing';
import WaveSurfer from 'wavesurfer.js';
import RegionsPlugin from 'wavesurfer.js/dist/plugins/regions.esm.js';


export default function NewAudio() {
    // Auth context 
    const { user, loading } = useAuth()

    // Local states passed as context
    const [originalAudioId, setOriginalAudioId] = useState<string | null>(null);
    const [fileExt, setFileExt] = useState<string | null>(null);
    const [fileType, setFileType] = useState<string | null>(null);
    const [originalAudioBlob, setOriginalAudioBlob] = useState<Blob | null>(null);
    const [error, setError] = useState<string | null>(null);
    const timeoutId = useRef<NodeJS.Timeout | null>(null); // Not passed as context
    const [currentPath, setCurrentPath] = useState<string>("Home");

    // WaveSurfer states
    const [clipStartMs, setClipStartMs] = useState<number | null>(null);
    const [clipEndMs, setClipEndMs] = useState<number | null>(null);
    const [audioDurationStr, setAudioDurationStr] = useState<string>("00:00");
    const wavesurferContainerRefOG = useRef<HTMLDivElement>(null)
    const wsRegionsRef = useRef<any>(null);
    const originalAudioWave = useRef<WaveSurfer | null>(null);
    const [originalAudioWavePlaying, setOriginalAudioWavePlaying] = useState<boolean>(false);

    useEffect(() => {
        if (!wavesurferContainerRefOG.current) return;

        const regions = RegionsPlugin.create();

        const wave = WaveSurfer.create(
            {
                container: wavesurferContainerRefOG.current,
                height: 100,
                waveColor: 'rgb(0, 188, 212)',
                progressColor: 'rgb(10, 15, 40)',
                plugins: [regions],
                minPxPerSec: 50,
            }
        )

        wave.on('ready', () => {
            setAudioDurationStr(formatTime(wave.getDuration()));
        });

        wave.on('play', () => setOriginalAudioWavePlaying(true));
        wave.on('pause', () => setOriginalAudioWavePlaying(false));

        regions.on('region-update', (region) => {
            setClipStartMs(Math.round(region.start * 1000));
            setClipEndMs(Math.round(region.end * 1000));
        });

        // Add wheel event listener for native trackpad pinch/mouse-wheel zooming
        const handleWheel = (e: WheelEvent) => {
            e.preventDefault();
            const currentZoom = wave.options.minPxPerSec || 50;
            if (e.deltaY < 0) {
                // Zoom in
                wave.zoom(currentZoom * 1.1);
            } else {
                // Zoom out
                wave.zoom(Math.max(10, currentZoom / 1.1));
            }
        };
        wavesurferContainerRefOG.current.addEventListener('wheel', handleWheel, { passive: false });

        if (originalAudioBlob) {
            wave.loadBlob(originalAudioBlob);
        }
        originalAudioWave.current = wave;
        wsRegionsRef.current = regions;

        return () => {
            wavesurferContainerRefOG.current?.removeEventListener('wheel', handleWheel);
            wave.destroy();
            originalAudioWave.current = null;
            wsRegionsRef.current = null;
        };
    }, [originalAudioBlob]);

    const handleSelectClip = useCallback(() => {
        if (!wsRegionsRef.current || !originalAudioWave.current) return;
        wsRegionsRef.current.clearRegions();
        const duration = originalAudioWave.current.getDuration();
        // Default region selection
        const start = duration * 0.1;
        const end = Math.min(duration * 0.3, duration);

        wsRegionsRef.current.addRegion({
            start: start,
            end: end,
            color: 'rgba(255, 202, 40, 0.4)',
            resize: true,
            drag: true,
        });

        setClipStartMs(Math.round(start * 1000));
        setClipEndMs(Math.round(end * 1000));
    }, [originalAudioWave]);

    const handleDownload = () => {
        if (!originalAudioBlob) return;
        const url = URL.createObjectURL(originalAudioBlob);
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = url;
        a.download = (originalAudioBlob as File).name || 'downloaded_audio[lucid]';
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
    };

    const handleChangeError = useCallback((message: string | null) => {
        setError(message);
        if (timeoutId.current) {
            clearTimeout(timeoutId.current);
        }
        if (message) {
            timeoutId.current = setTimeout(() => { setError(null) }, 10000)
        }
    }, []);

    // Stop timeout after unmount
    useEffect(() => {
        return () => {
            if (timeoutId.current) clearTimeout(timeoutId.current);
        };
    }, []);

    return (
        <NewAudioContext.Provider value={{
            originalAudioId,
            changeOriginalAudioId: setOriginalAudioId,
            fileExt,
            changeFileExt: setFileExt,
            fileType,
            changeFileType: setFileType,
            originalAudioBlob,
            changeOriginalAudioBlob: setOriginalAudioBlob,
            error,
            changeError: handleChangeError,
            currentPath,
            changeCurrentPath: setCurrentPath,
        }}>
            <div className="main flex flex-col items-center justify-center min-w-dvw h-full bg-background overflow-y-auto">
                <div className="textcenter">
                    {loading ? 'Loading...' : user ? null : 'Please log in.'}
                </div>

                {/* Waveform of Original Audio File */}
                {originalAudioBlob && (
                    <div className='glassmorphism-surface shadow-md w-[95%] mx-auto mt-4 flex flex-col gap-2'>
                        <div ref={wavesurferContainerRefOG} className="w-full relative bg-surface-variant rounded overflow-hidden"></div>
                        <div className="w-full flex justify-between text-xs text-on-surface-variant px-1 mt-1">
                            <span>0:00</span>
                            <span>{audioDurationStr}</span>
                        </div>

                        <div className="flex gap-4 items-center mt-2">
                            <button onClick={() => { originalAudioWave.current?.playPause() }} className='btn-primary px-4 py-2 rounded'>
                                {originalAudioWavePlaying ? 'Pause' : 'Play'}
                            </button>
                            <button onClick={handleDownload} className='btn-primary px-4 py-2 rounded'>
                                Download Audio
                            </button>
                        </div>
                    </div>
                )}

                {user &&
                    <div className='w-11/12 flex-1 flex flex-col'>
                        {(() => {
                            switch (currentPath) {
                                case "Home":
                                    return (
                                        <div className='flex flex-col items-center justify-center w-full flex-1 gap-8 py-8 px-2'>
                                            <div className='text-center'>
                                                <h1 className='text-3xl font-bold text-on-surface'>How would you like to add new audio?</h1>
                                                <p className='text-on-surface-variant mt-2 text-sm'>Choose a method below to get started</p>
                                            </div>
                                            <div className='flex flex-col flex-1 sm:flex-row gap-4 sm:gap-6 w-full h-1/2'>
                                                <button
                                                    onClick={() => setCurrentPath("UploadPath")}
                                                    className="flex-1 min-h-35 h-2/3 flex flex-col items-center justify-center gap-3 rounded-2xl glassmorphism-surface shadow-md hover:shadow-xl hover:-translate-y-1 transition-all p-6 cursor-pointer"
                                                >
                                                    <svg xmlns="http://www.w3.org/2000/svg" className="w-10 h-10 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                                                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                                                    </svg>
                                                    <span className='font-semibold text-on-surface text-lg'>Upload File</span>
                                                    <span className='text-sm text-on-surface-variant text-center'>Choose an audio file from your device</span>
                                                </button>
                                                <button
                                                    onClick={() => setCurrentPath("RecordPath")}
                                                    className="flex-1 min-h-35 h-2/3 flex flex-col items-center justify-center gap-3 rounded-2xl glassmorphism-surface shadow-md hover:shadow-xl hover:-translate-y-1 transition-all p-6 cursor-pointer"
                                                >
                                                    <svg xmlns="http://www.w3.org/2000/svg" className="w-10 h-10 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                                                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z" />
                                                    </svg>
                                                    <span className='font-semibold text-on-surface text-lg'>Record Audio</span>
                                                    <span className='text-sm text-on-surface-variant text-center'>Record directly from your microphone</span>
                                                </button>
                                                <button
                                                    onClick={() => setCurrentPath("YtPath")}
                                                    className="flex-1 min-h-35 h-2/3 flex flex-col items-center justify-center gap-3 rounded-2xl glassmorphism-surface shadow-md hover:shadow-xl hover:-translate-y-1 transition-all p-6 cursor-pointer"
                                                >
                                                    <svg xmlns="http://www.w3.org/2000/svg" className="w-10 h-10 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                                                        <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244" />
                                                    </svg>
                                                    <span className='font-semibold text-on-surface text-lg'>YouTube Link</span>
                                                    <span className='text-sm text-on-surface-variant text-center'>Download audio from a YouTube URL</span>
                                                </button>
                                            </div>
                                        </div>
                                    );
                                case "RecordPath":
                                    return <RecordPath />;
                                case "UploadPath":
                                    return <UploadPath />;
                                case "YtPath":
                                    return <YtPath />;
                                case "PreviewNoiseReduce":
                                    return <PreviewNoiseReduce
                                        clipStartMs={clipStartMs}
                                        clipEndMs={clipEndMs}
                                        handleSelectClip={handleSelectClip}
                                    />;
                                case "StartAudioProcessing":
                                    return <StartAudioProcessing />;
                            }
                        })()}
                    </div>
                }

                {error && (
                    <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative my-4 w-[95%] mx-auto flex justify-between items-center shadow-sm">
                        <span className="block sm:inline">{error}</span>
                        <button onClick={() => handleChangeError(null)} className="font-bold ml-4 hover:opacity-75">
                            ✕
                        </button>
                    </div>
                )}
            </div>
        </NewAudioContext.Provider>
    )
}
