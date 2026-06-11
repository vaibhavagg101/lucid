'use server';

import { getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { PubSub } from '@google-cloud/pubsub';

export interface NoiseReduceResponse {
    jobId: string;
}

export interface NoiseReduceRequest {
    token: string,
    gsBucket: string,
    filepath: string,
    filetype: string,
    noiseclip: boolean,
    startPoint?: number,
    endPoint?: number
}

export async function noiseReduce(request: NoiseReduceRequest): Promise<NoiseReduceResponse> {

    if (!getApps().length) {
        initializeApp({
            projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
        });
    }

    if (!request.token) {
        throw new Error("Missing auth token.")
    }

    let userid: string
    try {
        // Verify the token and extract the user's UID
        const decodedToken = await getAuth().verifyIdToken(request.token);
        userid = decodedToken.uid;
    } catch (error) {
        console.error("Firebase verifyIdToken error:", error);
        throw new Error("Unauthenticated user.");
    }

    // Ensure the requested filepath belongs to the authenticated user
    if (!request.filepath.startsWith(`${userid}/`)) {
        throw new Error("Unauthorised: You do not have permission to access this file path.");
    }

    if (request.noiseclip) {
        if (request.startPoint === undefined || request.endPoint === undefined) {
            throw new Error("startPoint and endPoint are required when noiseclip is true");
        }
    }

    const db = getFirestore();
    const pubsub = new PubSub();
    const topicName = process.env.NR_PUBSUB_TOPIC || 'noisereduce-topic';

    try {
        // Create a new job document in Firestore
        const jobRef = await db.collection('jobs').add({
            userid,
            status: 'processing',
            filepath: request.filepath,
            createdAt: new Date()
        });

        const jobId = jobRef.id;

        const payload = {
            jobId,
            gsBucket: request.gsBucket,
            filepath: request.filepath,
            filetype: request.filetype,
            noiseclip: request.noiseclip,
            ...(request.noiseclip && {
                startPoint: request.startPoint,
                endPoint: request.endPoint
            })
        };

        const dataBuffer = Buffer.from(JSON.stringify(payload));
        await pubsub.topic(topicName).publishMessage({ data: dataBuffer });
        
        return { jobId };
    } catch (error) {
        console.error('Error starting noise reduction job:', error);
        throw new Error('Failed to start noise reduction job');
    }
}