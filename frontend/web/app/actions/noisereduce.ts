'use server';

import { getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';


export interface NoiseReduceResponse {
    original_plot_url: string;
    reduced_plot_url: string;
    nr_audio_url: string;
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
        initializeApp()
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
        throw new Error("Unauthenticated user.")
    }

    // Ensure the requested filepath belongs to the authenticated user
    if (!request.filepath.startsWith(`${userid}/`)) {
        throw new Error("Unauthorised: You do not have permission to access this file path.");
    }

    const apiUrl = process.env.NOISEREDUCE_API_URL;
    const apiKey = process.env.NOISEREDUCE_API_KEY;

    if (!apiUrl || !apiKey) {
        throw new Error('Noise reduction API URL or API key is not configured.');
    }

    if (request.noiseclip) {
        if (request.startPoint === undefined || request.endPoint === undefined) {
            throw new Error("startPoint and endPoint are required when noiseclip is true");
        }
    }

    const body = {
        gsBucket: request.gsBucket,
        filepath: request.filepath,
        filetype: request.filetype,
        noiseclip: request.noiseclip,
        ...(request.noiseclip && {
            startPoint: request.startPoint,
            endPoint: request.endPoint
        })
    };

    try {
        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-API-Key': apiKey
            },
            body: JSON.stringify(body)
        });

        if (!response.ok) {
            let errorMessage;
            try {
                const errorData = await response.json();
                if (errorData.detail) errorMessage = errorData.detail;
            } catch (e) {
                errorMessage = response.statusText ? response.statusText : 'Unknown error';
            }
            throw new Error(`Noise reduction API error (${response.status}): ${errorMessage}`);
        }

        const result: NoiseReduceResponse = await response.json();
        return result;

    } catch (error) {
        console.error('Error during noise reduction:', error);
        throw error;
    }
}