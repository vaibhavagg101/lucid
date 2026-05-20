'use server'

import { getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

interface youtubeURLRequest {
    url: string;
    token: string;
}

interface youtubeURLRequestAPI {
    url: string;
    userid: string;
    gsBucket: string;
}

interface youtubeURLResponse {
    gsBucketURL?: string;
    audioid?: string;
    error?: string;
}

export async function processYoutubeURL(request: youtubeURLRequest): Promise<youtubeURLResponse> {

    if (!getApps().length) {
        initializeApp();
    }

    if (!request.url || !request.token) {
        return {
            error: "Missing URL or unauthenticated user."
        }
    }

    if (!process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET) {
        return {
            error: "Missing Firebase storage bucket in the environment variables."
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

    const url = request.url
    const apiKey = process.env.YOUTUBE_API_KEY
    if (!apiKey) {
        return {
            error: "Missing YouTube API key in the environment variables."
        }
    }

    const apiUrl = process.env.YOUTUBE_API_URL;
    if (!apiUrl) {
        return {
            error: "Missing YouTube API URL in the environment variables."
        }
    }

    const body: youtubeURLRequestAPI = {
        url: url,
        userid: userid,
        gsBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET!
    }

    try {
        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-API-Key': apiKey
            },
            body: JSON.stringify(body)
        })

        if (!response.ok) {
            let errorMessage;
            try {
                const errorData = await response.json();
                if (errorData.detail) errorMessage = errorData.detail;
            } catch (e) {
                errorMessage = response.statusText ? response.statusText : 'Unknown error';
            }
            return {
                error: `API error (${response.status}): ${errorMessage}`
            }
        }
        else {
            const result: youtubeURLResponse = await response.json()
            return result
        }
    }
    catch (error) {
        return {
            error: "Error processing URL."
        }
    }
}