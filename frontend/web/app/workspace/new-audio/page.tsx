'use client';

import { useState, useRef } from 'react';
import { useAuth } from '../../context/auth-context';
import { createAudioFileDocument } from '../../google-firebase/firestore';
import { uploadAudioFile } from '../../google-firebase/storage';
import { useRouter } from 'next/navigation';
import { noiseReduce, NoiseReduceResponse } from '@/app/actions/noisereduce';


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
const EXTENSION_TO_TYPE_MAP: Record<string, string[]> = {
    'wav': ['audio/wav', 'audio/x-wav'],
    'mp3': ['audio/mpeg', 'audio/mp3'],
    'm4a': ['audio/mp4', 'audio/x-m4a'],
    'aac': ['audio/aac']
};

export default function NewAudio() {
    const { user, loading } = useAuth();
    const [uploading, setUploading] = useState(false);
    const [progress, setProgress] = useState(0);
    const [error, setError] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [originalAudioId, setOriginalAudioId] = useState<string | null>(null);
    const [previewNoiseReduction, setPreviewNoiseReduction] = useState(false);
    // Noise Reduce stuff
    const [isProcessing, setIsProcessing] = useState(false);
    const [noiseReduceResult, setNoiseReduceResult] = useState<NoiseReduceResponse | null>(null);
    const [uploadedFileExt, setUploadedFileExt] = useState<string | null>(null);
    const [uploadedFileType, setUploadedFileType] = useState<string | null>(null);

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
        setUploadedFileType(file.type);

        const fileExtension = extension || '';
        const expectedTypes = EXTENSION_TO_TYPE_MAP[extension || ''];
        const typeMatchesExtension = expectedTypes ? expectedTypes.includes(file.type) : false;

        if (!typeMatchesExtension) {
            setError(`File type does not match extension. Expected types for .${extension}: ${expectedTypes?.join(', ')}`);
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
                fileExtension,
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
                    setUploadedFileExt(fileExtension);
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

    const handleNoiseReduce = async () => {
        if (!originalAudioId || !uploadedFileType || !user) return;

        setIsProcessing(true);
        setError(null);

        try {
            // NOTE: Ensure the gsBucket and filepath match your actual Firebase Storage structure.
            const gsBucket = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "Main-Audio-Files-Bucket";
            const filepath = `${user.uid}/audio/${originalAudioId}.${uploadedFileExt}`;

            const response = await noiseReduce(
                gsBucket,
                filepath,
                uploadedFileType,
                false // noiseclip
            );

            setNoiseReduceResult(response);
        } catch (err) {
            setError('Noise reduction failed: ' + (err instanceof Error ? err.message : String(err)));
        } finally {
            setIsProcessing(false);
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
                        <button>
                            Record Audio
                        </button>
                        <button
                            onClick={() => console.log('Open YouTube input box')}
                        >
                            Upload YouTube URL
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
                                onClick={handleNoiseReduce}
                                disabled={isProcessing}
                                style={{
                                    padding: '10px 20px',
                                    cursor: isProcessing ? 'not-allowed' : 'pointer',
                                    backgroundColor: isProcessing ? '#ccc' : '#28a745',
                                    color: '#fff',
                                    border: 'none',
                                    borderRadius: '4px'
                                }}
                            >
                                {isProcessing ? 'Processing...' : 'Preview Noise Reduction'}
                            </button>
                        )}

                        {noiseReduceResult && (
                            <div style={{ marginTop: '30px', borderTop: '1px solid #ddd', paddingTop: '20px' }}>
                                <h3>Noise Reduction Results</h3>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', marginTop: '10px' }}>
                                    <div>
                                        <h4>Original Audio Plot</h4>
                                        <img src={noiseReduceResult.original_plot_url} alt="Original Audio Plot" style={{ width: '100%', maxWidth: '800px', borderRadius: '4px' }} />
                                    </div>
                                    <div>
                                        <h4>Reduced Noise Plot</h4>
                                        <img src={noiseReduceResult.reduced_plot_url} alt="Reduced Noise Audio Plot" style={{ width: '100%', maxWidth: '800px', borderRadius: '4px' }} />
                                    </div>
                                    <div>
                                        <h4>Processed Audio</h4>
                                        <audio controls src={noiseReduceResult.nr_audio_url} style={{ width: '100%', maxWidth: '400px' }} />
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </>
    )
}
