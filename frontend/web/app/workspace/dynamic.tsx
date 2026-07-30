'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '../context/auth-context';
import { filterAudioFilesByUser, renameAudioFile } from '../google-firebase/firestore';
import { useRouter } from 'next/navigation';
import HeroSection from './components/HeroSection';
import MainSectionContainer from './components/MainSectionContainer';
import MainContainer from './components/MainContainer';
import AudioFilesHistorySection from './components/AudioFilesHistorySection';


export default function DynamicWorkspace() {
    const [userAudioFiles, setUserAudioFiles] = useState<any[]>([])
    const [audioFilesLoading, setAudioFilesLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const { user, loading } = useAuth()
    const router = useRouter()

    useEffect(() => {
        if (user) {
            setError(null)
            setAudioFilesLoading(true)
            const fetchedAudioFiles = async () => {
                try {
                    const files = await filterAudioFilesByUser(user.uid)
                    setUserAudioFiles(files)
                }
                catch (error) {
                    console.error('Error fetching audio files:', error)
                    setError('Failed to fetch audio files.')
                    return []
                }
                finally {
                    setAudioFilesLoading(false)
                }
            }
            fetchedAudioFiles()
        }
    }, [user])

    if (loading) {
        return <p>Loading...</p>
    }

    if (!user) {
        return <p>Login to view your workspace.</p>
    }

    async function renameAudioFileHelper(audioId: string) {
        const fileNameRegex = /^[a-zA-Z0-9.\-_()]+( [a-zA-Z0-9.\-_()]+)*$/
        const newName = prompt('Enter new name for the audio file:')
        if (user && newName && newName.trim() !== '' && newName.length <= 100 && fileNameRegex.test(newName)) {
            try {
                await renameAudioFile(user.uid, audioId, newName)
                setUserAudioFiles((prevFiles) =>
                    prevFiles.map((file) =>
                        file.id === audioId ? { ...file, filename: newName } : file
                    )
                )
            } catch (error) {
                console.error('Error renaming audio file:', error)
                alert('Failed to rename audio file.')
            }
        }
        else {
            alert('Invalid name. Please use 1-100 characters. Only letters, numbers, spaces, dots, dashes, underscores and parantheses are allowed.')
        }
    }

    return (
        <MainSectionContainer>
            <MainContainer>

                <HeroSection
                    userName={user.displayName || 'User'}
                    onCreateAudio={() => router.push('/workspace/new-audio')}
                />

                <AudioFilesHistorySection
                    files={userAudioFiles}
                    loading={audioFilesLoading}
                    error={error}
                    onRename={renameAudioFileHelper}
                    onView={(audioId) => router.push(`/workspace/audio/${audioId}`)}
                />
            </MainContainer>
        </MainSectionContainer>
    )
}