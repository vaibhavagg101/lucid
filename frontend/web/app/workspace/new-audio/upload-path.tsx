'use client'

import { useContext, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/app/context/auth-context";
import { generateAudioDocumentId, createAudioFileDocument, waitForAudioValidation } from '../../google-firebase/firestore';
import { uploadAudioFile } from '../../google-firebase/storage';
import { NewAudioContext } from "./new-audio-context";

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50 MB
const MAX_DURATION = 6.5 * 60; // 6.5 minutes in seconds

export const EXTENSION_TO_TYPE_MAP: Record<string, string[]> = {
    'wav': ['audio/wav', 'audio/x-wav', 'audio/wave', 'audio/vnd.wave'],
    'mp3': ['audio/mpeg', 'audio/mp3', 'audio/mpeg3', 'audio/x-mpeg-3'],
    'm4a': ['audio/mp4', 'audio/x-m4a', 'audio/m4a'],
    'aac': ['audio/aac', 'audio/x-aac', 'audio/aacp'],
    'webm': ['audio/webm'],
    'ogg': ['audio/ogg', 'application/ogg', 'audio/x-ogg'],
    'flac': ['audio/flac', 'audio/x-flac'],
    'aiff': ['audio/aiff', 'audio/x-aiff'],
    'aif': ['audio/aiff', 'audio/x-aiff'],
};
const ALLOWED_EXTENSIONS = Object.keys(EXTENSION_TO_TYPE_MAP);
const ALLOWED_TYPES = Array.from(new Set(Object.values(EXTENSION_TO_TYPE_MAP).flat()));

export default function UploadPath() {
    const router = useRouter();
    const { user, loading } = useAuth()
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [uploading, setUploading] = useState(false);
    const [progress, setProgress] = useState(0);
    const [validatingFile, setValidatingFile] = useState(false);

    const { originalAudioId,
        changeOriginalAudioId,
        fileExt,
        changeFileExt,
        fileType,
        changeFileType,
        originalAudioBlob,
        changeOriginalAudioBlob,
        changeCurrentPath,
        changeError } = useContext(NewAudioContext)

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // Validation: Size
        if (file.size > MAX_FILE_SIZE) {
            changeError('File size must be less than 50 MB.');
            if (fileInputRef.current) {
                fileInputRef.current.value = '';
            }
            return;
        }

        // Validation: Type
        const extension = file.name.split('.').pop()?.toLowerCase() || '';
        const isValidExtension = ALLOWED_EXTENSIONS.includes(extension);

        // Fallback for file.type if it's missing or generic (e.g. application/octet-stream)
        let resolvedType = file.type;
        if (!resolvedType || resolvedType === 'application/octet-stream') {
            const fallbackTypes = EXTENSION_TO_TYPE_MAP[extension];
            if (fallbackTypes && fallbackTypes.length > 0) {
                resolvedType = fallbackTypes[0];
            }
        }

        const isValidType = ALLOWED_TYPES.includes(resolvedType);
        if (!isValidExtension && !isValidType) {
            changeError('Invalid file type. Only .wav, .mp3, .m4a/.aac, .webm, .ogg, .flac, and .aiff/.aif are allowed.');
            if (fileInputRef.current) {
                fileInputRef.current.value = '';
            }
            return;
        }

        const fileExtension = extension;
        const expectedTypes = EXTENSION_TO_TYPE_MAP[extension];
        const typeMatchesExtension = expectedTypes ? expectedTypes.includes(resolvedType) : false;

        if (!typeMatchesExtension) {
            changeError(`File type does not match extension. Expected types for .${extension}: ${expectedTypes?.join(', ')}`);
            if (fileInputRef.current) {
                fileInputRef.current.value = '';
            }
            return;
        }

        if (!user) {
            changeError('You must be logged in to upload files.');
            if (fileInputRef.current) {
                fileInputRef.current.value = '';
            }
            return;
        }

        try {
            setUploading(true);
            setProgress(0);

            // Generate an ID for Storage without writing to the DB yet
            const audioId = generateAudioDocumentId();

            // Upload to Storage
            uploadAudioFile(
                user.uid,
                audioId,
                file,
                fileExtension,
                (p) => setProgress(p),
                (err) => {
                    changeError('Upload failed: ' + err.message);
                    setUploading(false);
                    if (fileInputRef.current) {
                        fileInputRef.current.value = '';
                    }
                },
                async () => {
                    try {
                        // Create Firestore doc
                        await createAudioFileDocument(audioId, user.uid, file.name);

                        setValidatingFile(true)
                        const isValidated = await waitForAudioValidation(audioId);

                        if (!isValidated) {
                            changeError("File validation failed: File must be under 50MB and 6.5 minutes.");
                            setUploading(false);
                            if (fileInputRef.current) {
                                fileInputRef.current.value = '';
                            }

                            setValidatingFile(false)
                            setTimeout(() => {
                                router.push('/workspace');
                            }, 5000);
                            return;
                        }

                        setValidatingFile(false)
                        changeOriginalAudioId(audioId);
                        changeFileExt(fileExtension);
                        changeFileType(resolvedType);
                        changeOriginalAudioBlob(file)
                        setUploading(false);
                        setProgress(100);
                        // Reset input
                        if (fileInputRef.current) {
                            fileInputRef.current.value = '';
                        }
                        // Clear progress and change path after a delay
                        setTimeout(() => {
                            setProgress(0);
                            changeCurrentPath("PreviewNoiseReduce")
                        }, 3000);
                    } catch (err) {
                        changeError('Failed to save file details: ' + (err instanceof Error ? err.message : String(err)));
                        setUploading(false);
                    }
                },
            );

        } catch (err) {
            changeError('An error occurred: ' + (err instanceof Error ? err.message : String(err)));
            setUploading(false);
            if (fileInputRef.current) {
                fileInputRef.current.value = '';
            }
        }
    };

    const triggerFileInput = () => {
        fileInputRef.current?.click();
    };

    return (
        <div className="w-full px-4 py-6 md:px-8 md:py-8 lg:px-12 lg:py-10">
            <div className="mx-auto w-full max-w-[1600px] rounded-[32px] border border-outline/30 bg-surface p-4 md:p-8 lg:p-12">
                <div className="flex min-h-[440px] w-full flex-col items-center justify-center rounded-[28px] bg-background px-4 py-10 shadow-sm md:px-8">

                    <div className="text-center">
                        <h1 className="text-2xl font-bold text-on-surface md:text-3xl">
                            Upload Audio File
                        </h1>

                        <p className="mt-2 text-sm text-on-surface-variant md:text-base">
                            Choose an audio file to begin processing.
                        </p>

                        <p className="mt-2 text-sm text-on-surface-variant md:text-base">
                            Make sure the file is under 50MB and less than 6.5 minutes long to pass validation.
                        </p>
                    </div>

                    <div className="mt-8 flex w-full max-w-[500px] flex-col items-center justify-center rounded-3xl border border-outline/30 px-6 py-10 text-center md:px-10">
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

                        <h2 className="mt-5 text-xl font-semibold text-on-surface md:text-2xl">
                            Choose audio file
                        </h2>

                        <p className="mt-3 text-sm text-on-surface-variant">
                            Select an audio file from your device
                        </p>

                        <input
                            className="hidden"
                            type="file"
                            accept=".wav,.mp3,.m4a,.aac,.webm,.ogg,audio/wav,audio/mpeg,audio/mp4,audio/aac,audio/webm,audio/ogg"
                            ref={fileInputRef}
                            onChange={handleFileChange}
                        />

                        <button
                            onClick={triggerFileInput}
                            disabled={uploading || validatingFile || originalAudioId !== null}
                            className={`mt-5 rounded-xl px-6 py-3 text-sm font-medium text-on-primary transition-colors ${uploading || validatingFile || originalAudioId !== null
                                ? 'bg-primary opacity-80 cursor-not-allowed'
                                : 'bg-primary hover:bg-primary-variant cursor-pointer'
                                }`}
                        >
                            {validatingFile ? 'Validating...' : uploading ? 'Uploading...' : 'Choose file'}
                        </button>

                        {progress > 0 && (
                            <div className="mt-5 w-full max-w-[300px]">
                                <div className="w-full overflow-hidden rounded-full bg-surface-variant">
                                    <div
                                        className="h-2 bg-secondary transition-[width] duration-200 ease-in-out"
                                        style={{ width: `${progress}%` }}
                                    />
                                </div>

                                <p className="mt-2 text-xs text-on-surface-variant">
                                    {Math.round(progress)}%
                                </p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}