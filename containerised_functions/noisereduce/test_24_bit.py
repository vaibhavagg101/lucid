import io
import numpy as np
import noisereduce as nr
from pydub import AudioSegment
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import base64

ALLOWED_EXTENSIONS = {'wav'}

def handle24Bit(samples) -> np.ndarray:
    return samples

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

def normalise(audio):
    samples = np.array(audio.get_array_of_samples())
    
    if audio.sample_width == 1:
        samples = samples.astype(np.float32)
        samples = (samples - 128.0) / 128.0
        
    elif audio.sample_width == 2:
        samples = samples.astype(np.float32)
        samples /= 32768.0
        
    # elif audio.sample_width == 3:
    #     return (handle24Bit(samples))

    elif audio.sample_width == 4:
        samples = samples.astype(np.float32)
        samples /= 2147483648.0
    
    # what about 24-bit?

    else:
        raise ValueError(f"Unsupported bit depth: {audio.sample_width * 8}-bit")

    return samples

def denormalise(float_samples, sample_width=2):
    float_samples = np.array(float_samples, dtype=np.float32)
    float_samples = np.nan_to_num(float_samples)

    if sample_width == 1:
        scaled = (float_samples * 127.0) + 128.0
        return np.clip(scaled, 0, 255).astype(np.uint8)

    elif sample_width == 2:
        scaled = float_samples * 32768.0
        return np.clip(scaled, -32768, 32767).astype(np.int16)

    elif sample_width == 4:
        scaled = float_samples * 2147483648.0
        return np.clip(scaled, -2147483648, 2147483647).astype(np.int32)

    else:
        raise ValueError("Unsupported sample width. Use 1, 2, or 4.")

if __name__ == '__main__':
    
    file = "/mnt/c/Users/vaibh/Downloads/file_example_MP3_1MG.mp3"

    audio = AudioSegment.from_file(file)

    print(audio.sample_width)
    print(audio.frame_rate)
    print(audio.channels)
    print(audio.duration_seconds)
    print(audio.frame_count())
    print(audio.duration_seconds * audio.frame_rate * audio.channels * audio.sample_width)

    samples = np.array(audio.get_array_of_samples())
    
    print(samples.shape)
    print(samples.dtype)
    print(samples.max())
    print(samples.min())
    print(samples[0:10])

    samples = normalise(audio)
    samples = denormalise(samples, audio.sample_width)
    print(samples.shape)
    print(samples.dtype)
    print(samples.max())
    print(samples.min())
    print(samples[0:10])

    test_audio = AudioSegment(samples.tobytes(), sample_width=audio.sample_width, frame_rate=audio.frame_rate, channels=audio.channels)
    test_audio.export("test.mp3", format="mp3")

    if audio.channels == 2:
        samples = samples.reshape((-1, 2)).T

    print(samples.shape)
    print(samples.dtype)
    print(samples.max())
    print(samples.min())

