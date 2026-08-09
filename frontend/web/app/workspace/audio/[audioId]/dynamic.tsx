'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/app/context/auth-context';
import { subscribeToAudioFile, AudioFileDoc } from '@/app/google-firebase/firestore';
import { fetchStorageBlob } from '@/app/google-firebase/storage';
import MainSectionContainer from '@/app/workspace/components/MainSectionContainer';
import MainContainer from '@/app/workspace/components/MainContainer';
import AudioPlayer from './components/AudioPlayer';
import AudioDetails from './components/AudioDetails';
import ChordsPanel from './components/ChordsPanel';
import StemsPanel from './components/StemsPanel';
import MainAudioMIDI from './components/MainAudioMIDI';

type Tab = 'overview' | 'chords' | 'stems';

export default function DynamicAudioFile() {
    const { audioId } = useParams<{ audioId: string }>();
    const { user } = useAuth();
    const router = useRouter();

    const [audioDoc, setAudioDoc] = useState<AudioFileDoc | null>(null);
    const [docLoading, setDocLoading] = useState(true);
    const [notFound, setNotFound] = useState(false);
    const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [currentTime, setCurrentTime] = useState(0);
    const [activeTab, setActiveTab] = useState<Tab>('overview');

    // Live-subscribe so chords/stems appear as soon as background processing finishes.
    useEffect(() => {
        if (!user || !audioId) return;

        const unsubscribe = subscribeToAudioFile(
            audioId,
            (data) => {
                // Treat "not owned by this user" the same as "not found" to avoid leaking existence of other users' files.
                if (!data || data.userId !== user.uid) {
                    setNotFound(true);
                    setAudioDoc(null);
                } else {
                    setNotFound(false);
                    setAudioDoc(data);
                }
                setDocLoading(false);
            },
            (err) => {
                console.error('Error subscribing to audio file:', err);
                setError('Failed to load audio file.');
                setDocLoading(false);
            }
        );

        return () => unsubscribe();
    }, [user, audioId]);

    useEffect(() => {
        if (!audioDoc?.filepath) return;
        let cancelled = false;

        fetchStorageBlob(audioDoc.filepath)
            .then((blob) => {
                if (!cancelled) setAudioBlob(blob);
            })
            .catch((err) => {
                console.error('Error fetching audio blob:', err);
                if (!cancelled) setError('Failed to load audio.');
            });

        return () => {
            cancelled = true;
        };
    }, [audioDoc?.filepath]);

    if (docLoading) {
        return <p>Loading...</p>;
    }

    if (!user) {
        return <p>Login to view this audio file.</p>;
    }

    if (notFound) {
        return (
            <MainSectionContainer>
                <MainContainer>
                    <p className="text-center text-sm text-on-surface-variant">
                        Audio file not found.
                    </p>
                </MainContainer>
            </MainSectionContainer>
        );
    }

    if (!audioDoc) {
        return null;
    }

    const tabs: { id: Tab; label: string }[] = [
        { id: 'overview', label: 'Overview' },
        { id: 'chords', label: 'Chords' },
        { id: 'stems', label: 'Stems' },
        // ...(audioDoc.midi_files?.length ? [{ id: 'midi' as Tab, label: 'MIDI' }] : []),
    ];

    return (
        <MainSectionContainer>
            <MainContainer>
                <div className="flex w-full flex-col gap-6 md:flex-row md:items-center md:justify-between">
                    <div>
                        <button
                            onClick={() => router.push('/workspace')}
                            className="cursor-pointer text-sm font-medium text-on-surface-variant hover:text-on-surface"
                        >
                            ← Back to workspace
                        </button>

                        <h1 className="mt-2 text-2xl font-bold text-on-surface sm:text-3xl">
                            {audioDoc.filename}
                        </h1>
                    </div>
                </div>

                <div className="mt-8 w-full">
                    <AudioPlayer
                        audioBlob={audioBlob}
                        downloadName={`${audioDoc.filename}.${audioDoc.filetype}`}
                        onTimeUpdate={setCurrentTime}
                    />
                </div>

                {audioDoc.separationOption == 0 ? (
                    <div className="mt-8 w-full">
                        <MainAudioMIDI
                            audioId={audioId}
                            audioDoc={audioDoc}
                        />
                    </div>
                ) : null}

                <div className="mt-8 flex w-full gap-2 border-b border-outline/30">
                    {tabs.map((tab) => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`cursor-pointer px-4 py-2 text-sm font-medium transition-colors ${activeTab === tab.id
                                ? 'border-b-2 border-primary text-primary'
                                : 'text-on-surface-variant hover:text-on-surface'
                                }`}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>

                {activeTab === 'overview' && <AudioDetails audioDoc={audioDoc} />}

                {activeTab === 'chords' && (
                    <ChordsPanel chordsCsvPath={audioDoc.chords_csv_filepath} currentTime={currentTime} />
                )}

                {activeTab === 'stems' && (
                    <StemsPanel
                        separatedFiles={audioDoc.separated_files}
                        separationOption={audioDoc.separationOption}
                        separationStatus={audioDoc.separation_status}
                        audioId={audioId}
                    />
                )}

                {error && (
                    <div className="mt-4 flex w-full items-center justify-between rounded-lg border border-red-400 bg-red-100 px-4 py-3 text-red-700 shadow-sm">
                        <span>{error}</span>
                        <button onClick={() => setError(null)} className="ml-4 cursor-pointer font-bold hover:opacity-75">
                            ✕
                        </button>
                    </div>
                )}
            </MainContainer>
        </MainSectionContainer>
    );
}
