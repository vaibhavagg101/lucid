'use server';

export interface NoiseReduceResponse {
    original_plot_url: string;
    reduced_plot_url: string;
    nr_audio_url: string;
}

export async function noiseReduce(
    gsBucket: string,
    filepath: string,
    noiseclip: boolean,
    startPoint?: number,
    endPoint?: number
): Promise<NoiseReduceResponse> {
    const apiUrl = process.env.NOISEREDUCE_API_URL;
    const apiKey = process.env.NOISEREDUCE_API_KEY;

    if (!apiUrl || !apiKey) {
        throw new Error('Noise reduction API URL or API key is not configured.');
    }

    if (noiseclip) {
        if (startPoint === undefined || endPoint === undefined) {
            throw new Error("startPoint and endPoint are required when noiseclip is true");
        }
    }

    const body = {
        gsBucket,
        filepath,
        noiseclip,
        ...(noiseclip && { startPoint, endPoint })
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