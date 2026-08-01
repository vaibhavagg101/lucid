import sys
import numpy as np
from scipy.fft import rfft
import math
import matplotlib.pyplot as plt
from matplotlib.colors import LinearSegmentedColormap
from pydub import AudioSegment
from pathlib import Path

def process_file(file_path):
    print(f"Processing: {file_path}")
    file = AudioSegment.from_file(file_path)
    audio_frame_rate = file.frame_rate
    if file.channels == 2:
        file = file.set_channels(1)
    samples = file.get_array_of_samples()
    numpy_array = np.array(samples)

    frequencies = [int(440*(2**(i/12))) for i in range(-48,37)]
    mid_frequencies = [(frequencies[i] + frequencies[i+1])//2 for i in range(len(frequencies)-1)]

    image_array = []
    image_array_amplitudes = []
    max_octave_indexes = []
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
        max_octave_indexes.append(np.argmax(octaves_amplitude))
        prev_sample_number = sample_number

    for octaves_amplitude in image_array_amplitudes:
        octaves_db = [round(20 * math.log10(max(x, 1) / max_amplitude), 1) for x in octaves_amplitude]
        image_array.append(octaves_db)

    dark_blue = (25/255, 39/255, 108/255) 
    light_blue = (240/255, 248/255, 255/255) 
    cmap = LinearSegmentedColormap.from_list('custom_blue', [light_blue, dark_blue])
    image_array = np.array(image_array)

    rgb_image_array = np.zeros((image_array.shape[0], image_array.shape[1], 3))

    for i in range(image_array.shape[0]):
        for j in range(image_array.shape[1]):
            norm_val = (image_array[i, j] - np.min(image_array)) / (0 - np.min(image_array))
            color = cmap(norm_val)[:3]
            rgb_image_array[i, j] = color
        max_idx = max_octave_indexes[i]
        rgb_image_array[i, max_idx] = (255/255, 202/255, 40/255)

    fig, ax = plt.subplots(figsize=(12, 12))
    ax.imshow(rgb_image_array, aspect='auto')
    ax.axis('off')
    plt.tight_layout()
    
    out_path = file_path.with_name(file_path.stem + "_fingerprint.png")
    plt.savefig(str(out_path), dpi=300, bbox_inches='tight', pad_inches=0)
    plt.close()
    print(f"Audio processed successfully: {file_path}")

target_dir = Path("Test Audio LUCID")
for f in target_dir.rglob("*"):
    if f.is_file() and not f.name.endswith(".png"):
        try:
            process_file(f)
        except Exception as e:
            print(f"Error processing {f}: {e}")

