import sys
import numpy as np
import io
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import noisereduce as nr
from pydub import AudioSegment
from pydub.effects import normalize
from pathlib import Path

def process_file(file_path):
    print(f"Processing: {file_path}")
    
    file_ext = file_path.suffix.lower()[1:]
    audio = AudioSegment.from_file(file_path, format=(None if file_ext != "wav" else "wav"))
    samples = np.array(audio.get_array_of_samples())
    if audio.channels == 2:
        samples = samples.reshape((-1, 2)).T

    # Process without noiseclip
    print(f"  Running without noiseclip...")
    reduced_noise_no_clip = nr.reduce_noise(y=samples, sr=audio.frame_rate, prop_decrease=0.8, n_jobs=2)
    
    if audio.channels == 2:
        reduced_noise_no_clip_export = reduced_noise_no_clip.T.flatten()
    else:
        reduced_noise_no_clip_export = reduced_noise_no_clip
        
    cleaned_audio_no_clip = audio._spawn(reduced_noise_no_clip_export.tobytes())
    cleaned_audio_no_clip = normalize(cleaned_audio_no_clip)
    
    out_path_no_clip = file_path.with_name(f"{file_path.stem}_nr_noclip.{file_ext}")
    export_format = file_ext
    if file_ext == 'm4a':
        export_format = 'ipod' # pydub maps m4a to the ipod ffmpeg format
        
    if cleaned_audio_no_clip.sample_width == 4 and file_ext == 'wav':
        cleaned_audio_no_clip.export(str(out_path_no_clip), format=export_format, parameters=["-acodec", "pcm_f32le"])
    else:
        cleaned_audio_no_clip.export(str(out_path_no_clip), format=export_format)
    print(f"  Saved: {out_path_no_clip.name}")

    # Process with arbitrary short noise clip
    print(f"  Running with noiseclip...")
    # Using first 0.5 seconds as arbitrary noise string
    start_frame = 0
    end_frame = int(0.5 * audio.frame_rate)
    
    # if audio is shorter than 0.5s, skip
    if samples.shape[-1] > end_frame:
        noise_clip = samples[:, start_frame:end_frame] if audio.channels == 2 else samples[start_frame:end_frame]
        reduced_noise_with_clip = nr.reduce_noise(y=samples, y_noise=noise_clip, sr=audio.frame_rate, stationary=True, prop_decrease=0.8, n_jobs=2)
        
        if audio.channels == 2:
            reduced_noise_with_clip_export = reduced_noise_with_clip.T.flatten()
        else:
            reduced_noise_with_clip_export = reduced_noise_with_clip
            
        cleaned_audio_with_clip = audio._spawn(reduced_noise_with_clip_export.tobytes())
        cleaned_audio_with_clip = normalize(cleaned_audio_with_clip)
        
        out_path_with_clip = file_path.with_name(f"{file_path.stem}_nr_withclip.{file_ext}")
        if cleaned_audio_with_clip.sample_width == 4 and file_ext == 'wav':
            cleaned_audio_with_clip.export(str(out_path_with_clip), format=export_format, parameters=["-acodec", "pcm_f32le"])
        else:
            cleaned_audio_with_clip.export(str(out_path_with_clip), format=export_format)
        print(f"  Saved: {out_path_with_clip.name}")
    else:
         print(f"  Audio too short for noiseclip processing. Skipping.")
         
    print(f"Finished: {file_path}")

target_dir = Path("../audio_fingerprint/Test Audio LUCID")
if not target_dir.exists():
    print(f"Directory {target_dir} does not exist.")
    sys.exit(1)

# Get one file from each folder
for folder in target_dir.iterdir():
    if folder.is_dir():
        # Find the first valid audio file
        for file in folder.rglob("*"):
             if file.is_file() and file.suffix.lower() in ['.wav', '.mp3', '.m4a', '.aac', '.webm', '.ogg', '.flac', '.aiff', '.aif'] and "_nr_" not in file.stem:
                 try:
                     process_file(file)
                 except Exception as e:
                     print(f"Error processing {file}: {e}")
                 break # Only process one file per main folder
