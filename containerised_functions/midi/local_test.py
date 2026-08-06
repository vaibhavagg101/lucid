import os
import argparse
from basic_pitch.inference import predict_and_save
from basic_pitch import ICASSP_2022_MODEL_PATH

def main():
    parser = argparse.ArgumentParser(description="Test basic-pitch core logic locally.")
    parser.add_argument("--audio", type=str, help="Path to the test audio file (e.g., test_audio.mp3).")
    args = parser.parse_args()

    # If no audio file is provided, try to find one in the current directory
    audio_path = args.audio
    
    if not audio_path:
        supported_exts = ('.mp3', '.wav', '.m4a', '.flac', '.ogg', '.aiff', '.webm', '.aac')
        for f in os.listdir('.'):
            if f.lower().endswith(supported_exts):
                audio_path = f
                break
                
    if not audio_path or not os.path.exists(audio_path):
        print("Error: No test audio file found in the current directory.")
        print("Please place an audio file (e.g., test_audio.mp3) here or specify it using --audio.")
        return

    output_dir = os.getcwd()
    
    print(f"Processing '{audio_path}' with basic-pitch...")
    
    try:
        # Core logic: generate MIDI using basic-pitch
        predict_and_save(
            [audio_path],
            output_dir,
            True,
            False,
            False,
            False,
            ICASSP_2022_MODEL_PATH
        )
        print(f"Success! MIDI file generated for '{audio_path}' in the current directory.")
    except Exception as e:
        print(f"Failed to process audio: {e}")

if __name__ == "__main__":
    main()
