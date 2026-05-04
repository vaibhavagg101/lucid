'use client';

import { useState, useRef } from 'react';
import { useAuth } from '../../context/auth-context';
import { createAudioFileDocument } from '../../google-firebase/firestore';
import { uploadAudioFile } from '../../google-firebase/storage';
import { useRouter } from 'next/router';


const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50 MB
const ALLOWED_TYPES = [
    'audio/wav',
    'audio/x-wav',
    'audio/mpeg',
    'audio/mp3',
    'audio/mp4',
    'audio/x-m4a',
    'audio/aac'
];
const ALLOWED_EXTENSIONS = ['wav', 'mp3', 'm4a', 'aac'];

export default function NewAudio() {
    const { user, loading } = useAuth();
    const [uploading, setUploading] = useState(false);
    const [progress, setProgress] = useState(0);
    const [error, setError] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [originalAudioId, setOriginalAudioId] = useState<string | null>(null);
    const [previewNoiseReduction, setPreviewNoiseReduction] = useState(false);

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setError(null);

        // Validation: Size
        if (file.size > MAX_FILE_SIZE) {
            setError('File size must be less than 50 MB.');
            if (fileInputRef.current) {
                fileInputRef.current.value = '';
            }
            return;
        }

        // Validation: Type
        const extension = file.name.split('.').pop()?.toLowerCase();
        const isValidExtension = ALLOWED_EXTENSIONS.includes(extension || '');
        const isValidType = ALLOWED_TYPES.includes(file.type);

        if (!isValidExtension && !isValidType) {
            setError('Invalid file type. Only .wav, .mp3, and .m4a/.aac are allowed.');
            if (fileInputRef.current) {
                fileInputRef.current.value = '';
            }
            return;
        }

        if (!user) {
            setError('You must be logged in to upload files.');
            if (fileInputRef.current) {
                fileInputRef.current.value = '';
            }
            return;
        }

        try {
            setUploading(true);
            setProgress(0);

            // 1. Add to Firestore to get ID
            const audioId = await createAudioFileDocument(user.uid, file.name);

            // 2. Upload to Storage
            uploadAudioFile(
                user.uid,
                audioId,
                file,
                (p) => setProgress(p),
                (err) => {
                    setError('Upload failed: ' + err.message);
                    setUploading(false);
                    if (fileInputRef.current) {
                        fileInputRef.current.value = '';
                    }
                },
                () => {
                    setOriginalAudioId(audioId);
                    setUploading(false);
                    setProgress(100);
                    // Reset input
                    if (fileInputRef.current) {
                        fileInputRef.current.value = '';
                    }
                    // Optionally clear progress after a delay
                    setTimeout(() => {
                        setProgress(0);
                    }, 3000);
                    // Enable noise reduction preview
                    setPreviewNoiseReduction(true);
                },
            );

        } catch (err) {
            setError('An error occurred: ' + (err instanceof Error ? err.message : String(err)));
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
            <div className="main" style={{ padding: '20px' }}>
                <div>
                    {loading ? 'Loading...' : user ? `Welcome, ${user.displayName || user.email}` : 'Please log in.'}
                </div>

                {user && (
                    <div style={{ marginTop: '20px' }}>
                        <input
                            type="file"
                            accept=".wav,.mp3,.m4a,.aac,audio/wav,audio/mpeg,audio/mp4,audio/aac"
                            // style={{ display: 'none' }} 
                            ref={fileInputRef}
                            onChange={handleFileChange}
                        />
                        <button
                            onClick={triggerFileInput}
                            disabled={uploading || originalAudioId !== null}
                            style={{
                                padding: '10px 20px',
                                cursor: uploading || originalAudioId !== null ? 'not-allowed' : 'pointer',
                                backgroundColor: uploading || originalAudioId !== null ? '#ccc' : '#007bff',
                                color: '#fff',
                                border: 'none',
                                borderRadius: '4px'
                            }}
                        >
                            {uploading ? 'Uploading...' : 'Upload Audio File'}
                        </button>

                        {progress > 0 && (
                            <div style={{ marginTop: '10px', maxWidth: '300px' }}>
                                <div style={{ width: '100%', backgroundColor: '#e0e0e0', borderRadius: '4px', overflow: 'hidden' }}>
                                    <div
                                        style={{
                                            width: `${progress}%`,
                                            height: '10px',
                                            backgroundColor: '#28a745',
                                            transition: 'width 0.2s ease-in-out'
                                        }}
                                    />
                                </div>
                                <div style={{ fontSize: '12px', marginTop: '4px', color: '#555' }}>
                                    {Math.round(progress)}%
                                </div>
                            </div>
                        )}

                        {error && (
                            <div style={{ color: 'red', marginTop: '10px', fontSize: '14px' }}>
                                {error}
                            </div>
                        )}
                        <br>
                        </br>
                        {previewNoiseReduction && originalAudioId && (
                            <button
                                onClick={() => alert('Previewing noise reduction for audio ID: ' + originalAudioId)}
                                style={{
                                    padding: '10px 20px',
                                    backgroundColor: '#17a2b8',
                                    color: '#fff',
                                    border: 'none',
                                    borderRadius: '4px',
                                    cursor: 'pointer'
                                }}
                            >
                                Preview Noise Reduction
                            </button>
                        )}
                    </div>
                )}
            </div>
        </>
    )
}
