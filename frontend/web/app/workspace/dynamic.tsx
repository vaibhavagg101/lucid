'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '../context/auth-context';
import { filterAudioFilesByUser, renameAudioFile } from '../google-firebase/firestore';
import { deleteAudioFile } from '../actions/delete-audio';
import { useRouter } from 'next/navigation';
import MainSectionContainer from './components/MainSectionContainer';
import MainContainer from './components/MainContainer';
import AudioFilesHistorySection from './components/AudioFilesHistorySection';
import WelcomeSection from './components/WelcomeSection';
import ConfirmDialog from './components/ConfirmDialog';
import RenameDialog from './components/RenameDialog';

export default function DynamicWorkspace() {
    const [userAudioFiles, setUserAudioFiles] = useState<any[]>([])
    const [audioFilesLoading, setAudioFilesLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null)
    const [pendingRenameId, setPendingRenameId] = useState<string | null>(null)
    const { user } = useAuth()
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

    if (!user) {
        return <p>Login to view your workspace.</p>
    }

    async function submitRename(newName: string) {
        if (!user || !pendingRenameId) return
        await renameAudioFile(user.uid, pendingRenameId, newName)
        setUserAudioFiles((prevFiles) =>
            prevFiles.map((file) =>
                file.id === pendingRenameId ? { ...file, filename: newName } : file
            )
        )
        setPendingRenameId(null)
    }

    async function confirmDeleteAudioFile() {
        const audioId = pendingDeleteId
        setPendingDeleteId(null)
        if (!user || !audioId) return
        const gsBucket = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
        if (!gsBucket) {
            alert('Failed to delete audio file.')
            return
        }

        try {
            const token = await user.getIdToken()
            await deleteAudioFile({ token, audioId, gsBucket })
            setUserAudioFiles((prevFiles) => prevFiles.filter((file) => file.id !== audioId))
        } catch (error) {
            console.error('Error deleting audio file:', error)
            alert('Failed to delete audio file.')
        }
    }

    return (
        <MainSectionContainer>
            <MainContainer>
                <WelcomeSection
                    userName={user.displayName || 'User'}
                    onCreateAudio={() => router.push('/workspace/new-audio')}
                />
                <AudioFilesHistorySection
                    files={userAudioFiles}
                    loading={audioFilesLoading}
                    error={error}
                    onRename={setPendingRenameId}
                    onDelete={setPendingDeleteId}
                />
            </MainContainer>

            <RenameDialog
                open={pendingRenameId !== null}
                initialValue={userAudioFiles.find((file) => file.id === pendingRenameId)?.filename ?? ''}
                onRename={submitRename}
                onCancel={() => setPendingRenameId(null)}
            />

            <ConfirmDialog
                open={pendingDeleteId !== null}
                title="Delete audio file"
                message="This cannot be undone. The file and all its generated data will be permanently removed."
                confirmLabel="Delete"
                onConfirm={confirmDeleteAudioFile}
                onCancel={() => setPendingDeleteId(null)}
            />
        </MainSectionContainer>
    )
}