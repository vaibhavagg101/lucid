'use client';

import { useState, useRef, useContext, createContext, useEffect, useCallback } from 'react';
import { useAuth } from '../../context/auth-context';
import { useRouter } from 'next/navigation';
import RecordPath from './record-path'
import UploadPath from './upload-path'
import YtPath from './yt-path'
import PreviewNoiseReduce from './preview-noisereduce';
import StartAudioProcessing from './start-audio-processing';
import WaveSurfer from 'wavesurfer.js';
import RegionsPlugin from 'wavesurfer.js/dist/plugins/regions.esm.js';

interface NewAudioContextType {
    originalAudioId: string | null;
    changeOriginalAudioId: (path: string) => void;
    fileExt: string | null;
    changeFileExt: (fileExt: string | null) => void;
    fileType: string | null;
    changeFileType: (fileType: string | null) => void;
    originalAudioBlob: Blob | null,
    changeOriginalAudioBlob: (file: Blob) => void;
    error: string | null;
    changeError: (message: string | null) => void;
    currentPath: string;
    changeCurrentPath: (path: string) => void;
}

export const NewAudioContext = createContext<NewAudioContextType>({
    originalAudioId: null,
    changeOriginalAudioId: (path: string) => { },
    fileExt: null,
    changeFileExt: (fileExt: string | null) => { },
    fileType: null,
    changeFileType: (fileType: string | null) => { },
    originalAudioBlob: null,
    changeOriginalAudioBlob: (file: Blob) => { },
    error: null,
    changeError: (message: string | null) => { },
    currentPath: "Home",
    changeCurrentPath: (path: string) => { },
});

export const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
};

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
            <div className="main">
                <div>
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
                    <div>
                        {(() => {
                            switch (currentPath) {
                                case "Home":
                                    return (
                                        <div className='user-input-form flex gap-6'>
                                            <button
                                                onClick={() => {
                                                    setCurrentPath("UploadPath")
                                                }}
                                                className='btn-primary px-4 py-2 rounded'
                                            >
                                                Upload Audio File from Device
                                            </button>
                                            <button
                                                onClick={() => {
                                                    setCurrentPath("RecordPath")
                                                }}
                                                className='btn-primary px-4 py-2 rounded'>
                                                Record Audio
                                            </button>
                                            <button
                                                onClick={() => {
                                                    setCurrentPath("YtPath")
                                                }}
                                                className='btn-primary px-4 py-2 rounded'>
                                                Download Audio using YouTube Link
                                            </button>

                                            {/* TEMPORARY TEST BUTTON */}
                                            {/* <input
                                                type="file"
                                                accept="audio/*"
                                                className="hidden"
                                                id="test-local-file-input"
                                                onChange={(e) => {
                                                    const file = e.target.files?.[0];
                                                    if (file) {
                                                        setOriginalAudioBlob(file);
                                                        setOriginalAudioId("mock-test-id-123");
                                                        setCurrentPath("PreviewNoiseReduce");
                                                    }
                                                }}
                                            />
                                            <button
                                                onClick={() => document.getElementById('test-local-file-input')?.click()}
                                                className="bg-error text-white px-4 py-2 rounded shadow-md hover:bg-red-600 transition-colors"
                                            >
                                                [Test] Load Local Audio
                                            </button> */}
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
            </div>
        </NewAudioContext.Provider>
    )
}
