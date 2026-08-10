'use server';

import { getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { PubSub } from '@google-cloud/pubsub';

export interface TabsJobResponse {
    jobId: string;
}

export interface TabsJobRequest {
    token: string;
    gsBucket: string;
    filepath: string;
    audioId: string;
}

export async function triggerTabsConversion(request: TabsJobRequest): Promise<TabsJobResponse> {

    if (!getApps().length) {
        initializeApp({
            projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
        });
    }

    if (!request.token) {
        throw new Error('Missing auth token.');
    }

    let userid: string;
    try {
        const decodedToken = await getAuth().verifyIdToken(request.token);
        userid = decodedToken.uid;
    } catch (error) {
        console.error('Firebase verifyIdToken error:', error);
        throw new Error('Unauthenticated user.');
    }

    // Ensure the requested filepath belongs to the authenticated user
    if (!request.filepath.startsWith(`${userid}/`)) {
        throw new Error('Unauthorised: You do not have permission to access this file path.');
    }

    const db = getFirestore();
    const pubsub = new PubSub();
    const topicName = process.env.TABS_PUBSUB_TOPIC || 'tabs-topic';

    try {
        const jobRef = await db.collection('jobs').add({
            userid,
            status: 'processing',
            filepath: request.filepath,
            createdAt: new Date(),
        });

        const jobId = jobRef.id;

        const payload = {
            jobId,
            gsBucket: request.gsBucket,
            filepath: request.filepath,
            audioId: request.audioId,
        };

        const dataBuffer = Buffer.from(JSON.stringify(payload));
        await pubsub.topic(topicName).publishMessage({ data: dataBuffer });

        return { jobId };
    } catch (error) {
        console.error('Error starting Tabs conversion job:', error);
        throw new Error('Failed to start Tabs conversion job.');
    }
}
