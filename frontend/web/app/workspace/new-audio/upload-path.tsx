'use client'

import { useContext, useRef, useState } from "react";
import { useAuth } from "@/app/context/auth-context";
import { generateAudioDocumentId, createAudioFileDocument } from '../../google-firebase/firestore';
import { uploadAudioFile } from '../../google-firebase/storage';
import { NewAudioContext } from "./new-audio-context";

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50 MB
const ALLOWED_TYPES = [
    'audio/wav',
    'audio/mpeg',
    'audio/mp3',
    'audio/mp4',
    'audio/aac',
    'audio/webm',
    'audio/ogg',
    'audio/flac',
    'audio/aiff',
];
const ALLOWED_EXTENSIONS = ['wav', 'mp3', 'm4a', 'aac', 'webm', 'ogg', 'flac', 'aiff', 'aif'];
export const EXTENSION_TO_TYPE_MAP: Record<string, string[]> = {
    'wav': ['audio/wav'],
    'mp3': ['audio/mpeg', 'audio/mp3'],
    'm4a': ['audio/mp4'],
    'aac': ['audio/aac'],
    'webm': ['audio/webm'],
    'ogg': ['audio/ogg'],
    'flac': ['audio/flac'],
    'aiff': ['audio/aiff'],
    'aif': ['audio/aiff'],
};

export default function UploadPath() {
    const { user, loading } = useAuth()
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [uploading, setUploading] = useState(false);
    const [progress, setProgress] = useState(0);

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
        <>
            <div style={{ marginTop: '20px' }}>
                <input
                    className="hidden"
                    type="file"
                    accept=".wav,.mp3,.m4a,.aac,.webm,.ogg,.flac,.aiff,.aif,audio/wav,audio/mpeg,audio/mp4,audio/aac,audio/webm,audio/ogg,audio/flac,audio/x-flac,audio/aiff,audio/x-aiff"
                    ref={fileInputRef}
                    onChange={handleFileChange}
                />
                <button
                    onClick={triggerFileInput}
                    disabled={uploading || originalAudioId !== null}
                    className={`px-4 py-2 rounded border-none text-on-primary transition-colors ${uploading || originalAudioId !== null
                        ? 'bg-primary opacity-80 cursor-not-allowed'
                        : 'bg-primary hover:bg-primary-variant cursor-pointer'
                        }`}
                >
                    {uploading ? 'Uploading...' : 'Upload Audio File'}
                </button>

                {progress > 0 && (
                    <div className="mt-2.5 max-w-1/2">
                        <div className="w-full bg-surface-variant rounded overflow-hidden">
                            <div
                                className="h-2.5 bg-secondary transition-[width] duration-200 ease-in-out"
                                style={{ width: `${progress}%` }}
                            />
                        </div>
                        <div className="text-xs mt-1 text-on-surface-variant">
                            {Math.round(progress)}%
                        </div>
                    </div>
                )}
            </div>
        </>
    )
}