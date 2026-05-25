'use client'

import { useContext, useState, useRef, useEffect } from "react";
import { NewAudioContext } from "./page";
import WaveSurfer from 'wavesurfer.js';

export default function RecordPath() {
    const { changeOriginalAudioBlob, changeError, changeCurrentPath } = useContext(NewAudioContext);

    const [isRecording, setIsRecording] = useState(false);
    const [recordingTime, setRecordingTime] = useState(0);
    const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [permissionGranted, setPermissionGranted] = useState<boolean | null>(null);

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
            analyser.getByteFrequencyData(dataArray);

            canvasCtx.clearRect(0, 0, canvas.width, canvas.height);

            const barWidth = (canvas.width / bufferLength) * 2.5;
            let barHeight;
            let x = 0;

            for (let i = 0; i < bufferLength; i++) {
                barHeight = dataArray[i] / 4; // Scale dynamically for height=64
                canvasCtx.fillStyle = 'rgb(0, 188, 212)';
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
            drawVisualizer();

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
        if (isRecording && recordingTime >= 600) {
            stopRecording();
            changeError("Maximum recording limit of 10 minutes reached.");
        }
    }, [recordingTime, isRecording]);

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
            
            

            changeOriginalAudioBlob(file);
            changeCurrentPath("PreviewNoiseReduce");
        }
    };

    const handleDiscard = () => {
        setAudioBlob(null);
        setRecordingTime(0);
        if (wavesurferRef.current) {
            wavesurferRef.current.destroy();
            wavesurferRef.current = null;
        }
        setIsPlaying(false);
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
        <div className="flex flex-col items-center mt-6 p-6 glassmorphism-surface shadow-md rounded-2xl max-w-1/2 not-md:w-full mx-auto">
            <h2 className="text-2xl font-bold mb-6 text-primary">Record Audio</h2>

            {permissionGranted === false && (
                <div className="bg-error/10 text-error p-3 rounded mb-4 w-full text-center text-sm">
                    Microphone access is required to record audio.
                </div>
            )}

            {!audioBlob ? (
                <div className="flex flex-col items-center w-full">
                    <div className="text-5xl mb-6 text-on-surface">
                        {formatTime(recordingTime)}
                    </div>

                    <div className="max-w-lg h-16 mb-8 rounded flex items-center justify-center overflow-hidden">
                        <canvas ref={canvasRef} height={64} className="w-full h-full opacity-80" />
                    </div>
                    {isRecording ? (
                        <button
                            onClick={stopRecording}
                            className="bg-error hover:bg-red-700 text-white font-semibold py-3 px-8 rounded-full transition-all flex items-center gap-3 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
                        >
                            <span className="w-4 h-4 bg-white rounded-sm"></span> Stop Recording
                        </button>
                    ) : (
                        <button
                            onClick={startRecording}
                            className="bg-primary hover:bg-primary-variant text-white font-semibold py-3 px-8 rounded-full hover:cursor-pointer flex items-center gap-3 shadow-md hover:shadow-lg transform hover:-translate-y-0.5"
                        >
                            <span className="w-4 h-4 bg-error rounded-full animate-pulse"></span> Start Recording
                        </button>
                    )}

                    <p className="text-tertiary  text-md mt-6 font-semibold text-center">
                        Max recording limit: 10 minutes
                    </p>
                </div>
            ) : (
                <div className="flex flex-col items-center w-full">
                    <p className="mb-4 text-sm font-medium text-on-surface-variant bg-surface-variant px-3 py-1 rounded-full">
                        Recording complete ({formatTime(recordingTime)})
                    </p>

                    <div className="w-full mb-6 rounded-xl p-4">
                        <div ref={waveformRef} className="w-full"></div>
                        <div className="flex justify-center mt-4">
                            <button
                                onClick={handlePlayPause}
                                className="bg-secondary hover:bg-secondary-variant font-medium rounded-lg hover:cursor-pointer text-white p-3 shadow-md flex items-center justify-center w-20 h-12"
                            >
                                {isPlaying ? (
                                    <p>Pause</p>
                                ) : (
                                    <p>Play</p>
                                )}
                            </button>
                        </div>
                    </div>

                    <div className="flex gap-4 w-full">
                        <button
                            onClick={handleDiscard}
                            className="flex-1 border-2 border-error text-error hover:bg-error hover:text-white hover:cursor-pointer font-semibold py-2.5 px-4 rounded-lg transition-colors"
                        >
                            Discard
                        </button>
                        <button
                            onClick={handleConfirm}
                            className="flex-1 bg-primary hover:bg-primary-variant text-white hover:cursor-pointer font-semibold py-2.5 px-4 rounded-lg transition-colors shadow-md"
                        >
                            Use Recording
                        </button>
                    </div>
                </div>
            )}
        </div>
    )
}