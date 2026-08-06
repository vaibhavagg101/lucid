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
import MainSectionContainer from '../components/MainSectionContainer';
import MainContainer from '../components/MainContainer';


export default function NewAudio() {
    // Auth context 
    const { user } = useAuth()

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
                // minPxPerSec: 50,
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
            <div className="main">
                <MainSectionContainer>
                    <MainContainer>
                        <div className="textcenter">
                            {user ? null : 'Please log in.'}
                        </div>

                        {/* Waveform of Original Audio File */}
                        {originalAudioBlob && (
                            <div className="w-full px-4 pt-6 md:px-8 md:pt-8 lg:px-12 lg:pt-10">

                                <div className="flex w-full flex-col items-center rounded-[32px] bg-surface px-5 py-12 shadow-sm sm:px-8 md:px-10 md:py-14 lg:px-12">

                                    <div className="text-center">
                                        <h1 className="text-2xl font-bold text-on-surface sm:text-3xl lg:text-4xl">
                                            Preview Audio
                                        </h1>

                                        <p className="mt-3 text-sm text-on-surface-variant sm:text-base">
                                            Listen and edit your audio before processing.
                                        </p>
                                    </div>

                                    <div className="mt-8 w-full max-w-[1080px] rounded-3xl border border-outline/30 p-6 md:p-8">

                                        <div
                                            ref={wavesurferContainerRefOG}
                                            className="w-full overflow-hidden rounded-2xl border border-outline/30 bg-background"
                                        ></div>

                                        <div className="mt-3 flex w-full justify-between px-1 text-xs font-medium text-on-surface">
                                            <span>0:00</span>
                                            <span>{audioDurationStr}</span>
                                        </div>

                                        <div className="mt-6 flex items-center justify-center gap-3">
                                            <button
                                                onClick={() => originalAudioWave.current?.playPause()}
                                                className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-xl bg-primary text-on-primary transition-colors hover:bg-primary-variant"
                                                aria-label={originalAudioWavePlaying ? "Pause audio" : "Play audio"}
                                            >
                                                {originalAudioWavePlaying ? (
                                                    <svg
                                                        xmlns="http://www.w3.org/2000/svg"
                                                        viewBox="0 0 24 24"
                                                        fill="currentColor"
                                                        className="h-5 w-5"
                                                    >
                                                        <path d="M6.75 5.25A.75.75 0 017.5 4.5h2.25a.75.75 0 01.75.75v13.5a.75.75 0 01-.75.75H7.5a.75.75 0 01-.75-.75V5.25zm6.75 0a.75.75 0 01.75-.75h2.25a.75.75 0 01.75.75v13.5a.75.75 0 01-.75.75h-2.25a.75.75 0 01-.75-.75V5.25z" />
                                                    </svg>
                                                ) : (
                                                    <svg
                                                        xmlns="http://www.w3.org/2000/svg"
                                                        viewBox="0 0 24 24"
                                                        fill="currentColor"
                                                        className="h-5 w-5"
                                                    >
                                                        <path d="M8.25 5.25v13.5L18.75 12 8.25 5.25z" />
                                                    </svg>
                                                )}
                                            </button>

                                            <button
                                                onClick={handleDownload}
                                                className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-xl bg-surface-variant text-primary transition-colors hover:bg-outline/20"
                                                aria-label="Download audio"
                                            >
                                                <svg
                                                    xmlns="http://www.w3.org/2000/svg"
                                                    fill="none"
                                                    viewBox="0 0 24 24"
                                                    strokeWidth={1.8}
                                                    stroke="currentColor"
                                                    className="h-5 w-5"
                                                >
                                                    <path
                                                        strokeLinecap="round"
                                                        strokeLinejoin="round"
                                                        d="M12 3v12m0 0l-4-4m4 4l4-4M5 17v2a2 2 0 002 2h10a2 2 0 002-2v-2"
                                                    />
                                                </svg>
                                            </button>
                                        </div>

                                    </div>
                                </div>
                            </div>

                        )}

                        {user &&
                            <div className='flex-1 flex flex-col mx-auto'>
                                {(() => {
                                    switch (currentPath) {
                                        case "Home":
                                            return (
                                                <div className="flex flex-1 justify-center items-center">
                                                    <div>

                                                        <div className="text-center">
                                                            <h1 className="text-2xl font-bold text-on-surface sm:text-3xl lg:text-4xl">
                                                                How would you like to add new audio?
                                                            </h1>

                                                            <p className="mt-3 text-sm text-on-surface-variant sm:text-base">
                                                                Choose a method below to get started.
                                                            </p>
                                                        </div>

                                                        <div className="mt-10 grid grid-cols-1 gap-5 md:grid-cols-3 md:gap-10">
                                                            <button
                                                                onClick={() => setCurrentPath("UploadPath")}
                                                                className="flex min-h-45 flex-col items-center justify-center rounded-2xl border border-outline/30 shadow-xs glassmorphism-surface p-6 hover:pointer hover:shadow-md cursor-pointer"
                                                            >
                                                                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-surface-variant">
                                                                    <svg
                                                                        xmlns="http://www.w3.org/2000/svg"
                                                                        className="h-6 w-6 text-primary"
                                                                        fill="none"
                                                                        viewBox="0 0 24 24"
                                                                        stroke="currentColor"
                                                                        strokeWidth={1.5}
                                                                    >
                                                                        <path
                                                                            strokeLinecap="round"
                                                                            strokeLinejoin="round"
                                                                            d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5"
                                                                        />
                                                                    </svg>
                                                                </div>

                                                                <span className="mt-5 text-lg font-semibold text-on-surface">
                                                                    Upload File
                                                                </span>

                                                                <span className="mt-3 text-center text-sm text-on-surface-variant">
                                                                    Choose an audio file from your device
                                                                </span>
                                                            </button>

                                                            <button
                                                                onClick={() => setCurrentPath("RecordPath")}
                                                                className="flex min-h-45 flex-col items-center justify-center rounded-2xl border border-outline/30 shadow-xs glassmorphism-surface p-6 hover:pointer hover:shadow-md cursor-pointer"
                                                            >
                                                                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-surface-variant">
                                                                    <svg
                                                                        xmlns="http://www.w3.org/2000/svg"
                                                                        className="h-6 w-6 text-primary"
                                                                        fill="none"
                                                                        viewBox="0 0 24 24"
                                                                        stroke="currentColor"
                                                                        strokeWidth={1.5}
                                                                    >
                                                                        <path
                                                                            strokeLinecap="round"
                                                                            strokeLinejoin="round"
                                                                            d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z"
                                                                        />
                                                                    </svg>
                                                                </div>

                                                                <span className="mt-5 text-lg font-semibold text-on-surface">
                                                                    Record Audio
                                                                </span>

                                                                <span className="mt-3 text-center text-sm text-on-surface-variant">
                                                                    Record directly from your microphone
                                                                </span>
                                                            </button>

                                                            <button
                                                                onClick={() => setCurrentPath("YtPath")}
                                                                className="flex min-h-45 flex-col items-center justify-center rounded-2xl border border-outline/30 shadow-xs glassmorphism-surface p-6 hover:pointer hover:shadow-md cursor-pointer"
                                                            >
                                                                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-surface-variant">
                                                                    <svg
                                                                        xmlns="http://www.w3.org/2000/svg"
                                                                        className="h-6 w-6 text-primary"
                                                                        fill="none"
                                                                        viewBox="0 0 24 24"
                                                                        stroke="currentColor"
                                                                        strokeWidth={1.5}
                                                                    >
                                                                        <path
                                                                            strokeLinecap="round"
                                                                            strokeLinejoin="round"
                                                                            d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244"
                                                                        />
                                                                    </svg>
                                                                </div>

                                                                <span className="mt-5 text-lg font-semibold text-on-surface">
                                                                    Youtube URL
                                                                </span>

                                                                <span className="mt-3 text-center text-sm text-on-surface-variant">
                                                                    Download audio from a YouTube URL
                                                                </span>
                                                            </button>
                                                        </div>
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
                                <button onClick={() => handleChangeError(null)} className="font-bold ml-4 cursor-pointer hover:opacity-75">
                                    ✕
                                </button>
                            </div>
                        )}
                    </MainContainer>
                </MainSectionContainer>
            </div>
        </NewAudioContext.Provider>
    )
}
