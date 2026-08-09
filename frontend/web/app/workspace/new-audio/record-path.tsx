'use client'

import { useContext, useState, useRef, useEffect } from "react";
import { useAuth } from "@/app/context/auth-context";
import { generateAudioDocumentId, createAudioFileDocument } from '../../google-firebase/firestore';
import { uploadAudioFile } from '../../google-firebase/storage';
import { NewAudioContext } from "./new-audio-context";
import WaveSurfer from 'wavesurfer.js';

export default function RecordPath() {
    const { user } = useAuth()
    const { changeOriginalAudioId, changeOriginalAudioBlob, changeFileType, changeFileExt, changeError, changeCurrentPath } = useContext(NewAudioContext)

    const [isRecording, setIsRecording] = useState(false);
    const [recordingTime, setRecordingTime] = useState(0);
    const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [permissionGranted, setPermissionGranted] = useState<boolean | null>(null);

    const [uploadingBlob, setUploadingBlob] = useState<boolean>(false)
    const [uploadProgress, setUploadProgress] = useState(0)

    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const chunksRef = useRef<Blob[]>([]);
    const timerRef = useRef<NodeJS.Timeout | null>(null);

    const waveformRef = useRef<HTMLDivElement>(null);
    const wavesurferRef = useRef<WaveSurfer | null>(null);

    const canvasRef = useRef<HTMLCanvasElement>(null);
    const audioContextRef = useRef<AudioContext | null>(null);
    const analyserRef = useRef<AnalyserNode | null>(null);
    const animationFrameRef = useRef<number | null>(null);

    const drawVisualizer = () => {
        if (!canvasRef.current || !analyserRef.current) return;
        const canvas = canvasRef.current;
        const canvasCtx = canvas.getContext("2d");
        if (!canvasCtx) return;

        const analyser = analyserRef.current;
        const bufferLength = analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);

        const draw = () => {
            animationFrameRef.current = requestAnimationFrame(draw);

            if (canvas.width !== canvas.clientWidth || canvas.height !== canvas.clientHeight) {
                canvas.width = canvas.clientWidth;
                canvas.height = canvas.clientHeight;
            }

            analyser.getByteFrequencyData(dataArray);

            canvasCtx.clearRect(0, 0, canvas.width, canvas.height);

            const barWidth = (canvas.width / bufferLength) * 2.5;
            let barHeight;
            let x = 0;

            for (let i = 0; i < bufferLength; i++) {
                barHeight = dataArray[i] / 4; // Scale dynamically for height=64
                canvasCtx.fillStyle = 'rgba(0, 188, 212, 0.3)';
                // Center the bar vertically, minimum 2px height for silence line
                canvasCtx.fillRect(x, (canvas.height / 2) - (barHeight / 2), barWidth, Math.max(2, barHeight));
                x += barWidth + 1;
            }
        };
        draw();
    };

    // Request permissions
    const requestMicrophonePermission = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            setPermissionGranted(true);
            return stream;
        } catch (err) {
            console.error("Microphone permission denied:", err);
            setPermissionGranted(false);
            changeError("Microphone access denied. Please allow microphone permissions in your browser settings.");
            return null;
        }
    };

    const startRecording = async () => {
        changeError(null);
        let stream = streamRef.current;

        if (!stream) {
            stream = await requestMicrophonePermission();
            if (!stream) return;
            streamRef.current = stream;
        }

        try {
            // Initialize Audio Visualization
            const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
            const audioCtx = new AudioContextClass();
            const analyser = audioCtx.createAnalyser();
            const source = audioCtx.createMediaStreamSource(stream);
            source.connect(analyser);
            analyser.fftSize = 256;
            audioContextRef.current = audioCtx;
            analyserRef.current = analyser;

            // Let browser decide the best format for maximum compatibility (Safari usually prefers mp4, Chrome prefers webm)
            const mediaRecorder = new MediaRecorder(stream);
            mediaRecorderRef.current = mediaRecorder;
            chunksRef.current = [];

            mediaRecorder.ondataavailable = (e) => {
                if (e.data && e.data.size > 0) {
                    chunksRef.current.push(e.data);
                }
            };

            mediaRecorder.onstop = () => {
                const mimeType = mediaRecorder.mimeType || 'audio/webm';
                const blob = new Blob(chunksRef.current, { type: mimeType });
                setAudioBlob(blob);
            };

            // Collect data in chunks every 200ms
            mediaRecorder.start(200);
            setIsRecording(true);
            setRecordingTime(0);
            timerRef.current = setInterval(() => {
                setRecordingTime(prev => prev + 1);
            }, 1000);

        } catch (err) {
            console.error("Error starting MediaRecorder:", err);
            changeError("Failed to start recording. Your browser might not support this feature.");
        }
    };

    const stopRecording = () => {
        if (mediaRecorderRef.current && isRecording) {
            mediaRecorderRef.current.stop();
            setIsRecording(false);
            if (timerRef.current) clearInterval(timerRef.current);
            if (streamRef.current) {
                streamRef.current.getTracks().forEach(track => track.stop());
                streamRef.current = null;
            }

            // Cleanup visualizer
            if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
            if (audioContextRef.current) {
                audioContextRef.current.close().catch(console.error);
                audioContextRef.current = null;
            }
            if (canvasRef.current) {
                const ctx = canvasRef.current.getContext("2d");
                if (ctx) ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
            }
        }
    };

    useEffect(() => {
        if (isRecording && recordingTime >= 385) {
            stopRecording();
            changeError("Maximum recording limit of 6.5 minutes reached.");
        }
    }, [recordingTime, isRecording]);

    // Runs after the canvas/mic-bar elements have mounted, so their refs are attached before drawing starts
    useEffect(() => {
        if (isRecording) {
            drawVisualizer();
        }
    }, [isRecording]);

    const handleDiscard = () => {
        setAudioBlob(null);
        setRecordingTime(0);
        if (wavesurferRef.current) {
            wavesurferRef.current.destroy();
            wavesurferRef.current = null;
        }
        setIsPlaying(false);
    };

    const handleConfirm = () => {
        if (audioBlob) {
            const now = new Date();
            // Format: YYYY-MM-DD_HH-MM-SS
            const timestamp = now.getFullYear() + '-' +
                String(now.getMonth() + 1).padStart(2, '0') + '-' +
                String(now.getDate()).padStart(2, '0') + '_' +
                String(now.getHours()).padStart(2, '0') + '-' +
                String(now.getMinutes()).padStart(2, '0') + '-' +
                String(now.getSeconds()).padStart(2, '0');

            let extension = 'webm';
            const mimeType = audioBlob.type.toLowerCase();
            if (mimeType.includes('mp4')) {
                extension = 'm4a';
            } else if (mimeType.includes('ogg')) {
                extension = 'ogg';
            } else if (mimeType.includes('wav')) {
                extension = 'wav';
            } else if (mimeType.includes('mpeg')) {
                extension = 'mp3';
            }

            const filename = `recording_${timestamp}.${extension}`;
            const file = new File([audioBlob], filename, { type: audioBlob.type });

            try {
                // setting here so the user can download the file in case of failure
                changeOriginalAudioBlob(file)

                if (!user) {
                    throw new Error("Unauthorised. Login to upload.")
                }

                setUploadingBlob(true)
                setUploadProgress(0)
                const newDocId = generateAudioDocumentId()
                uploadAudioFile(user.uid, newDocId, file, extension,
                    (progress) => { setUploadProgress(progress) },
                    (error) => {
                        throw new Error(error.message)
                    },
                    async () => {
                        try {
                            await createAudioFileDocument(newDocId, user.uid, file.name);
                        }
                        catch (e) {
                            throw new Error("Failed to update database.")
                        }

                        changeOriginalAudioId(newDocId)
                        changeFileExt(extension)
                        changeFileType(audioBlob.type)
                        setUploadProgress(100)
                        setUploadingBlob(false)

                        handleDiscard()

                        setTimeout(() => {
                            setUploadProgress(0);
                            changeCurrentPath("PreviewNoiseReduce")
                        }, 1000);
                    })
            }
            catch (error) {
                console.log(error)
                changeError(error as string)
                return
            }
        }
    };

    // Initialize WaveSurfer when audioBlob is ready
    useEffect(() => {
        if (audioBlob && waveformRef.current) {
            const wavesurfer = WaveSurfer.create({
                container: waveformRef.current,
                waveColor: 'rgb(0, 188, 212)',
                progressColor: 'rgb(10, 15, 40)',
                height: 80,
                barWidth: 2,
                barGap: 1,
                barRadius: 2,
                normalize: true,
            });

            wavesurfer.loadBlob(audioBlob);

            wavesurfer.on('play', () => setIsPlaying(true));
            wavesurfer.on('pause', () => setIsPlaying(false));
            wavesurfer.on('finish', () => setIsPlaying(false));

            wavesurferRef.current = wavesurfer;

            return () => {
                wavesurfer.destroy();
            };
        }
    }, [audioBlob]);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (timerRef.current) clearInterval(timerRef.current);
            if (streamRef.current) {
                streamRef.current.getTracks().forEach(track => track.stop());
            }
            if (wavesurferRef.current) {
                wavesurferRef.current.destroy();
            }
            if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
            if (audioContextRef.current) {
                audioContextRef.current.close().catch(console.error);
            }
        };
    }, []);

    const formatTime = (seconds: number) => {
        const m = Math.floor(seconds / 60);
        const s = Math.floor(seconds % 60);
        return `${m}:${s < 10 ? '0' : ''}${s}`;
    };

    const handlePlayPause = () => {
        if (wavesurferRef.current) {
            wavesurferRef.current.playPause();
        }
    };

    return (
        <div className="w-full">
            <div className="flex min-h-110 w-full flex-col items-center justify-center">

                <div className="text-center">
                    <h1 className="text-2xl font-bold text-on-surface md:text-3xl">
                        Record Audio
                    </h1>

                    <p className="mt-2 text-sm text-on-surface-variant md:text-base">
                        Record directly from your microphone.
                    </p>
                </div>

                {permissionGranted === false && (
                    <div className="mb-4 w-full max-w-125 rounded-xl bg-error/10 p-3 text-center text-sm text-error">
                        Microphone access is required to record audio.
                    </div>
                )}

                {uploadingBlob && (
                    <p className="mb-4 text-sm text-on-surface-variant">
                        Your file is being uploaded to the cloud...
                    </p>
                )}

                {uploadProgress > 0 && (
                    <div className="mb-6 w-full max-w-125">
                        <div className="w-full overflow-hidden rounded bg-surface-variant">
                            <div
                                className="h-2.5 bg-secondary transition-[width] duration-200 ease-in-out"
                                style={{ width: `${uploadProgress}%` }}
                            />
                        </div>

                        <p className="mt-1 text-xs text-on-surface-variant">
                            {Math.round(uploadProgress)}%
                        </p>
                    </div>
                )}

                <div className="mt-8 w-full max-w-125 rounded-3xl border border-outline/30 px-6 py-8 md:px-10">
                    {!audioBlob ? (
                        <div className="flex flex-col items-center w-full">
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

                            <div className="mt-5 text-3xl font-semibold text-on-surface">
                                {formatTime(recordingTime)}
                            </div>

                            <div className="mt-6 flex h-10 w-4/5 max-w-72 items-center justify-center">
                                {isRecording && (
                                    <canvas
                                        ref={canvasRef}
                                        className="h-10 w-full rounded-xl opacity-80"
                                    />
                                )}
                            </div>

                            <div className="mt-4">
                                {isRecording ? (
                                    <button
                                        onClick={stopRecording}
                                        className="rounded-xl bg-error px-6 py-3 text-sm font-medium text-on-error transition-colors hover:bg-red-700 cursor-pointer"
                                    >
                                        <span className="mr-2 inline-block h-3 w-3 rounded-sm bg-on-error"></span>
                                        Stop Recording
                                    </button>
                                ) : (
                                    <button
                                        onClick={startRecording}
                                        className="rounded-xl bg-primary px-6 py-3 text-sm font-medium text-on-primary transition-colors hover:bg-primary-variant cursor-pointer"
                                    >
                                        <span className="mr-2 inline-block h-3 w-3 rounded-full bg-error"></span>
                                        Start Recording
                                    </button>
                                )}
                            </div>

                            <p className="mt-5 text-sm text-on-surface-variant">
                                Max Recording Time: 6.5 minutes
                            </p>
                        </div>
                    ) : (
                        <div className="flex flex-col items-center">
                            <p className="rounded-full bg-surface-variant px-3 py-1 text-sm text-on-surface-variant">
                                Recording complete ({formatTime(recordingTime)})
                            </p>

                            <div className="mt-6 w-full">
                                <div ref={waveformRef} className="w-full"></div>

                                <div className="mt-4 flex justify-center">
                                    <button
                                        onClick={handlePlayPause}
                                        className="rounded-xl bg-secondary px-5 py-3 text-sm font-medium text-on-secondary transition-colors hover:bg-secondary-variant cursor-pointer"
                                    >
                                        {isPlaying ? 'Pause' : 'Play'}
                                    </button>
                                </div>
                            </div>

                            <div className="mt-6 flex w-full flex-col gap-3 sm:flex-row">
                                <button
                                    onClick={handleDiscard}
                                    disabled={uploadingBlob}
                                    className="flex-1 rounded-xl border border-error px-4 py-3 text-sm font-medium text-error transition-colors hover:bg-error/10 cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                    Discard
                                </button>

                                <button
                                    onClick={handleConfirm}
                                    disabled={uploadingBlob}
                                    className="flex-1 rounded-xl bg-primary px-4 py-3 text-sm font-medium text-on-primary transition-colors hover:bg-primary-variant cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                    Use Recording
                                </button>
                            </div>
                        </div>
                    )}
                </div>

            </div>
        </div>
    )
}