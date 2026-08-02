import os
import subprocess
import pandas as pd
import glob

def process_chords(audio_path):
    """
    Runs chord recognition on an audio file, outputs a .lab file,
    saves it to a CSV file, and returns a pandas DataFrame.
    """
    base_dir = os.path.dirname(os.path.abspath(__file__))
    
    audio_dir = os.path.dirname(audio_path)
    audio_name = os.path.basename(audio_path)
    base_name = os.path.splitext(audio_name)[0]
    
    lab_path = os.path.join(audio_dir, f"{base_name}_chord.lab")
    csv_path = os.path.join(audio_dir, f"{base_name}_chord.csv")
    
    script_dir = os.path.join(base_dir, "ISMIR2019-Large-Vocabulary-Chord-Recognition")
    script_path = os.path.join(script_dir, "chord_recognition.py")
    
    # 1. Run chord_recognition.py to create the .lab file
    command = ["python3", script_path, audio_path, lab_path]
    print(f"Running command: {' '.join(command)}")
    
    try:
        # Run inside the script's directory so it finds its local dependencies
        subprocess.run(command, check=True, cwd=script_dir)
        print("Chord recognition completed successfully.")
    except subprocess.CalledProcessError as e:
        print(f"Error running chord recognition: {e}")
        return None

    if not os.path.exists(lab_path):
        print(f"Output file {lab_path} not found.")
        return None

    # 2. Read the .lab file directly into a pandas DataFrame (tab/space delimited)
    try:
        df = pd.read_csv(
            lab_path, 
            sep=r'\s+', 
            header=None, 
            names=["start_time", "end_time", "chord"]
        )
    except Exception as e:
        print(f"Error parsing dataframe: {e}")
        return None
    
    # 3. Write it out to a CSV file
    df.to_csv(csv_path, index=False)
    print(f"Saved chords to {csv_path}")

    import key_detection as kd
    detected_key = kd.detect_key_from_chords(csv_path)
    print(f"Detected key: {detected_key}")
    
    return df

def test_on_lucid_directory():
    base_dir = os.path.dirname(os.path.abspath(__file__))
    test_audio_dir = os.path.join(
        base_dir, "..", "audio_fingerprint", "Test Audio LUCID"
    )
    
    # Iterate through all subdirectories in Test Audio LUCID
    for root, dirs, files in os.walk(test_audio_dir):
        # We only want to process one audio file per subfolder
        # So we filter out the non-audio files or take the first valid audio file we find.
        audio_files = [
            f for f in files if f.lower().endswith(('.mp3', '.wav', '.aiff', '.flac', '.m4a', '.ogg'))
        ]
        
        if audio_files:
            # Take the first audio file found in this subdirectory
            first_audio_file = os.path.join(root, audio_files[0])
            print(f"Processing: {first_audio_file}")
            
            df = process_chords(first_audio_file)
            if df is not None:
                print(f"Successfully processed {audio_files[0]}")
            else:
                print(f"Failed to process {audio_files[0]}")
            print("-" * 40)

if __name__ == "__main__":
    # Test on the lucid directory
    test_on_lucid_directory()
