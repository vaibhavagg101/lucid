'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '../context/auth-context';
import { filterAudioFilesByUser, renameAudioFile } from '../google-firebase/firestore';
import { useRouter } from 'next/navigation';

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
        <div className="workspace-container glassmorphism-surface shadow-md mt-5 not-lg:shadow-sm shadow-blue-950 relative z-20 mx-auto grid grid-cols-1 lg:w-8/12 md:w-10/12 min-h-10/12 w-full items-center justify-center gap-y-10">
            <h1>Welcome to your workspace, {user.displayName}!</h1>
            <button onClick={() => router.push('/workspace/new-audio')} className="btn btn-primary">
                Create New Audio
            </button>

            {audioFilesLoading ? (
                <p>Loading your audio files...</p>
            ) : error ? (
                <p>{error}</p>
            ) : userAudioFiles.length === 0 ? (
                <p>You have no audio files yet. Start by creating a new one!</p>
            ) : (
                <table>
                    <thead>
                        <tr>
                            <th>Audio File</th>
                            <th>File Type</th>
                            <th>Actions</th>

                        </tr>
                    </thead>
                    <tbody>
                        {userAudioFiles.map((file) => (
                            <tr key={file.id} onClick={() => console.log(file.id)}>
                                <td>{file.filename}</td>
                                <td>{file.filetype}</td>
                                <td>
                                    <button onClick={() => renameAudioFileHelper(file.id)}>
                                        Rename
                                    </button>
                                    <button onClick={() => router.push(`/workspace/audio/${file.id}`)}>
                                        View
                                    </button>

                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            )}
        </div>
    )
}