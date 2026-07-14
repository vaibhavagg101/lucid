import os
import base64
import json
from pydub import AudioSegment
from fastapi import FastAPI

app = FastAPI(title="Audio Fingerprint - Google Cloud Run")

# # Initialize Firebase Admin
# if not firebase_admin._apps:
#     firebase_admin.initialize_app()
# db = firestore.client()

# def getFileFromGCS(gsBucket: str, filepath: str):
#     try:
#         storage_client = storage.Client()
#         bucket = storage_client.bucket(gsBucket)
#         blob = bucket.blob(filepath)
        
#         file = io.BytesIO()
#         blob.download_to_file(file)
#         file.seek(0)
#         file.filename = filepath.split('/')[-1]
#         return file
#     except Exception as e:
#         print(f"Error fetching file {filepath} from bucket {gsBucket}: {e}")
#         raise HTTPException(status_code=500, detail="Failed to fetch file from storage")

import numpy as np
from scipy.fft import rfft
import math
import matplotlib.pyplot as plt
from matplotlib.colors import LinearSegmentedColormap

def main():
    # file = AudioSegment.from_file("Free Bird.flac")
    file = AudioSegment.from_file("02. Tuesday’s Gone.flac")
    audio_frame_rate = file.frame_rate
    if file.channels == 2:
        file = file.set_channels(1)
    samples = file.get_array_of_samples()
    numpy_array = np.array(samples)

    frequencies = [int(440*(2**(i/12))) for i in range(-48,37)]
    mid_frequencies = [(frequencies[i] + frequencies[i+1])//2 for i in range(len(frequencies)-1)]

    image_array = []
    image_array_amplitudes = []
    max_amplitude = -math.inf

    prev_sample_number = 0
    for sample_number in range(audio_frame_rate, len(numpy_array), audio_frame_rate):
        fft_array = rfft(numpy_array[prev_sample_number:sample_number])
        magnitudes = np.abs(fft_array)
        octaves_amplitude = [int(np.mean(magnitudes[mid_frequencies[i]:mid_frequencies[i+1]])) for i in range(len(mid_frequencies)-1)]
        curr_max_amplitude = np.max(octaves_amplitude)
        if max_amplitude < curr_max_amplitude:
            max_amplitude = curr_max_amplitude    
        image_array_amplitudes.append(octaves_amplitude)
        prev_sample_number = sample_number

    for octaves_amplitude in image_array_amplitudes:
        octaves_db = [round(20 * math.log10(max(x, 1) / max_amplitude), 1) for x in octaves_amplitude]
        image_array.append(octaves_db)
    
    image_array = np.array(image_array)
    dark_blue = (25/255, 39/255, 108/255) 
    light_blue = (240/255, 248/255, 255/255) 
    cmap = LinearSegmentedColormap.from_list('custom_blue', [light_blue, dark_blue])
    fig, ax = plt.subplots(figsize=(12, 12))
    cax = ax.imshow(image_array, cmap=cmap, aspect='auto', vmin=np.min(image_array), vmax=0)
    ax.axis('off')
    plt.tight_layout()
    # plt.savefig("free_bird_square.png", dpi=300, bbox_inches='tight', pad_inches=0)
    plt.savefig("tuesday's_gone_square.png", dpi=300, bbox_inches='tight', pad_inches=0)
    print("Square image saved.")

if __name__ == "__main__":
    main()