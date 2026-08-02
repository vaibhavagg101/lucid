import pandas as pd
import numpy as np

# Krumhansl-Schmuckler key profiles for major and minor keys
MAJOR_PROFILE = [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88]
MINOR_PROFILE = [6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17]

PITCH_CLASSES = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B']
PITCH_MAP = {
    'C': 0, 'B#': 0,
    'C#': 1, 'Db': 1,
    'D': 2,
    'D#': 3, 'Eb': 3,
    'E': 4, 'Fb': 4,
    'F': 5, 'E#': 5,
    'F#': 6, 'Gb': 6,
    'G': 7,
    'G#': 8, 'Ab': 8,
    'A': 9,
    'A#': 10, 'Bb': 10,
    'B': 11, 'Cb': 11
}

def parse_chord(chord_string):
    if str(chord_string).strip() == 'N':
        return None, None
        
    base_chord = chord_string.split('/')[0]
    
    parts = base_chord.split(':')
    if len(parts) != 2:
        return None, None
        
    root_str, quality = parts[0], parts[1]
    
    if root_str not in PITCH_MAP:
        return None, None
        
    root_pc = PITCH_MAP[root_str]
    return root_pc, quality

def chord_to_pitch_distribution(root_pc, quality):
    pitches = np.zeros(12)
    
    if root_pc is None:
        return pitches
        
    pitches[root_pc] = 1.0
    
    if quality in ['maj', '7', 'maj7']:
        pitches[(root_pc + 4) % 12] = 1.0 # Major third
        pitches[(root_pc + 7) % 12] = 1.0 # Perfect fifth
        if quality == '7':
             pitches[(root_pc + 10) % 12] = 1.0 # Minor seventh
        elif quality == 'maj7':
             pitches[(root_pc + 11) % 12] = 1.0 # Major seventh
    elif quality in ['min', 'min7']:
        pitches[(root_pc + 3) % 12] = 1.0 # Minor third
        pitches[(root_pc + 7) % 12] = 1.0 # Perfect fifth
        if quality == 'min7':
             pitches[(root_pc + 10) % 12] = 1.0 # Minor seventh
    elif quality == 'dim':
        pitches[(root_pc + 3) % 12] = 1.0 # Minor third
        pitches[(root_pc + 6) % 12] = 1.0 # Diminished fifth
    elif quality == 'aug':
        pitches[(root_pc + 4) % 12] = 1.0 # Major third
        pitches[(root_pc + 8) % 12] = 1.0 # Augmented fifth
    else:
        # Fallback: Just use root if quality is unknown or complex
        # You can expand this logic for sus4, hdim, etc.
        pass
        
    return pitches

def create_key_profiles():
    profiles = {}
    
    major_base = np.array(MAJOR_PROFILE)
    major_base = major_base - np.mean(major_base)
    
    minor_base = np.array(MINOR_PROFILE)
    minor_base = minor_base - np.mean(minor_base)
    
    for i, pc_name in enumerate(PITCH_CLASSES):
        shifted_major = np.roll(major_base, i)
        shifted_minor = np.roll(minor_base, i)
        
        profiles[f"{pc_name} Major"] = shifted_major
        profiles[f"{pc_name} Minor"] = shifted_minor
        
    return profiles

def detect_key_from_chords(csv_file):
    try:
        df = pd.read_csv(csv_file)
    except Exception as e:
        print(f"Error reading {csv_file}: {e}")
        return None
        
    if not {'start_time', 'end_time', 'chord'}.issubset(df.columns):
        print(f"Missing required columns in {csv_file}")
        return None

    df['duration'] = df['end_time'] - df['start_time']
    
    total_pitch_distribution = np.zeros(12)
    
    # Group by chord to get total duration for each unique chord, which is much faster than iterrows
    chord_durations = df[df['duration'] > 0].groupby('chord')['duration'].sum()
    
    for chord_str, duration in chord_durations.items():
        root_pc, quality = parse_chord(chord_str)
        
        if root_pc is not None:
            chord_pitches = chord_to_pitch_distribution(root_pc, quality)
            total_pitch_distribution += (chord_pitches * duration)
            
    if np.sum(total_pitch_distribution) == 0:
        return "Unknown"
        
    total_pitch_distribution = total_pitch_distribution - np.mean(total_pitch_distribution)
    
    profiles = create_key_profiles()
    best_key = None
    best_correlation = -1.0
    
    correlations = {}
    
    for key_name, profile in profiles.items():
        # Pearson correlation
        if np.std(total_pitch_distribution) == 0 or np.std(profile) == 0:
            corr = 0
        else:
            correlation_matrix = np.corrcoef(total_pitch_distribution, profile)
            corr = correlation_matrix[0, 1]
            
        correlations[key_name] = corr
        
        if corr > best_correlation:
            best_correlation = corr
            best_key = key_name
            
    # top_3 = sorted(correlations.items(), key=lambda x: x[1], reverse=True)[:3]
    
    return best_key
