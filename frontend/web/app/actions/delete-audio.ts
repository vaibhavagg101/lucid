'use server';

import { getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';

export interface DeleteAudioFileRequest {
    token: string;
    audioId: string;
    gsBucket: string;
}

export interface DeleteAudioFileResponse {
    deleted: boolean;
}

export async function deleteAudioFile(request: DeleteAudioFileRequest): Promise<DeleteAudioFileResponse> {
    if (!getApps().length) {
        initializeApp({
            projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
        });
    }

    if (!request.token || !request.audioId || !request.gsBucket) {
        throw new Error('Missing auth token, audio id, or gs bucket.');
    }

    let userid: string;
    try {
        const decodedToken = await getAuth().verifyIdToken(request.token);
        userid = decodedToken.uid;
    } catch (error) {
        console.error('Firebase verifyIdToken error:', error);
        throw new Error('Unauthenticated user.');
    }

    const db = getFirestore();
    const docRef = db.collection('audio_files').doc(request.audioId);
    const docSnap = await docRef.get();

    if (!docSnap.exists) {
        throw new Error('Audio file not found.');
    }

    const data = docSnap.data();
    if (data?.userId !== userid) {
        throw new Error('Unauthorised: You do not have permission to delete this file.');
    }

    const gsBucket = request.gsBucket.startsWith('gs://') ? request.gsBucket.slice(5) : request.gsBucket;

    try {
        // Deletes the uploaded audio file and its derived-files "directory" (chords/stems/noise-reduce/fingerprint
        // outputs are all stored as blobs prefixed with the original file's own path).
        const bucket = getStorage().bucket(gsBucket);
        await bucket.deleteFiles({ prefix: `${userid}/audio/${request.audioId}.${data?.filetype}` });
    } catch (error) {
        console.error('Error deleting audio files from storage:', error);
        throw new Error('Failed to delete audio files from storage.');
    }

    try {
        await docRef.delete();
    } catch (error) {
        console.error('Error deleting audio file document:', error);
        throw new Error('Failed to delete audio file record.');
    }

    return { deleted: true };
}
