'use server'

import { getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { data } from 'framer-motion/client';
import { storage } from '../google-firebase/storage';
import { isValidYoutubeUrl, validateYoutubeVideoDuration } from '../utils/youtube-validation';

interface youtubeURLRequest {
    url: string;
    token: string;
}

interface youtubePubSubMessage {
    jobId: string;
    url: string;
    userid: string;
    gsBucket: string;
}

export async function processYoutubeURL(request: youtubeURLRequest) {

    if (!getApps().length) {
        initializeApp({
            projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
        });
    }

    if (!request.url || !request.token) {
        return {
            error: "Missing URL or unauthenticated user."
        }
    }

    if (!isValidYoutubeUrl(request.url)) {
        return {
            error: "Invalid YouTube URL format."
        }
    }

    const durationCheck = await validateYoutubeVideoDuration(request.url);
    if (!durationCheck.isValid) {
        if (durationCheck.error) {
            console.log("Video duration validation failed, but will be checked on the cloud function.")
        }
        return {
            error: durationCheck.error || "Video duration validation failed."
        }
    }

    if (!process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET) {
        return {
            error: "Missing Firebase storage bucket in the environment variables."
        }
    }

    if (!process.env.YOUTUBE_PUBSUB_TOPIC) {
        return {
            error: "Missing Youtube PubSub Topic env variable"
        }
    }

    let userid: string;
    try {
        // Verify the token and extract the user's UID
        const decodedToken = await getAuth().verifyIdToken(request.token);
        userid = decodedToken.uid;
    } catch (error) {
        return {
            error: "Invalid or expired authentication token."
        }
    }

    try {
        const db = getFirestore();
        const userDocRef = db.collection('users').doc(userid);
        const userDoc = await userDocRef.get();

        if (!userDoc.exists) {
            return {
                error: "User not found in database."
            }
        }

        const userData = userDoc.data();
        if (userData && userData.youtubeUses >= 3) {
            return {
                error: "Daily limit for YouTube URLs reached."
            }
        }

        const jobRef = await db.collection('jobs').add({
            userid,
            status: 'processing',
            url: request.url,
            createdAt: new Date()
        })

        const jobId = jobRef.id

        const { PubSub } = require('@google-cloud/pubsub')
        const pubSubClient = new PubSub()
        const topic = pubSubClient.topic(process.env.YOUTUBE_PUBSUB_TOPIC)

        const data: youtubePubSubMessage = {
            jobId: jobId,
            url: request.url,
            userid: userid,
            gsBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET as string
        }
        const dataBuffer = Buffer.from(JSON.stringify(data))

        await topic.publishMessage({ data: dataBuffer });
        return { jobId: jobId }
    }
    catch (error) {
        console.log(error)
        throw new Error("Youtube URL to audio conversion failed")
    }
}