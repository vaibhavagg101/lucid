import math
from pathlib import Path
import pretty_midi

from tuttut.logic.tab import Tab, fill_measure_str
from tuttut.logic.theory import Tuning

def format_time(seconds: float) -> str:
    mins = int(seconds // 60)
    secs = int(seconds % 60)
    return f"{mins:02d}:{secs:02d}"

def build_timestamped_tab_str(tab_obj: Tab, measures_per_line: int = 3) -> str:
    """
    Formats the tuttut Tab object into wrapped multi-line blocks with timestamp headers.
    
    Args:
        tab_obj (Tab): Processed tuttut Tab object.
        measures_per_line (int): Number of measures to group per horizontal block.
        
    Returns:
        str: Formatted ASCII tab string with timestamps.
    """
    res_blocks = []
    tuning_strings = tab_obj.tuning.strings
    nstrings = len(tuning_strings)
    all_measures = tab_obj.tab["measures"]
    
    # Process in chunks of measures_per_line
    for chunk_idx in range(0, len(all_measures), measures_per_line):
        chunk_measures = all_measures[chunk_idx : chunk_idx + measures_per_line]
        
        # Extract event timestamps within this chunk
        chunk_times = [
            event["time"]
            for m in chunk_measures
            for event in m["events"]
            if "time" in event
        ]
        start_t = min(chunk_times) if chunk_times else 0.0
        end_t = max(chunk_times) if chunk_times else start_t
        
        m_start = chunk_idx + 1
        m_end = chunk_idx + len(chunk_measures)
        header = f"[{format_time(start_t)} - {format_time(end_t)}] Measures {m_start}-{m_end}"
        
        # Build 6 string lines for this chunk
        string_lines = []
        for string in tuning_strings:
            h = string.degree
            h += "||" if len(h) > 1 else " ||"
            string_lines.append(h)
            
        for measure in chunk_measures:
            for ievent, event in enumerate(measure["events"]):
                if "notes" in event:
                    for note in event["notes"]:
                        string, fret = note["string"], note["fret"]
                        string_lines[string] += str(fret)

                    next_event_timing = (
                        measure["events"][ievent + 1]["measure_timing"]
                        if ievent < len(measure["events"]) - 1
                        else 1.0
                    )
                    dashes_to_add = max(
                        1, math.floor((next_event_timing - event["measure_timing"]) * 16)
                    )

                    string_lines = fill_measure_str(string_lines)

                    for istring in range(nstrings):
                        string_lines[istring] += "-" * dashes_to_add

            for istring in range(nstrings):
                string_lines[istring] += "|"
                
        block_text = header + "\n" + "\n".join(string_lines)
        res_blocks.append(block_text)
        
    return "\n\n".join(res_blocks)

def main():
    midi_filename = "test.mid"
    base_dir = Path(__file__).parent.resolve()
    midi_path = base_dir / midi_filename

    if not midi_path.exists():
        print(f"Error: MIDI file not found at {midi_path}")
        return

    print(f"Loading MIDI file: {midi_path}")
    midi_data = pretty_midi.PrettyMIDI(str(midi_path))
    
    print("Processing MIDI file with tuttut to generate guitar tablature...")
    tab_name = midi_path.stem
    tuning = Tuning()  # Standard guitar tuning (E A D G B E)
    
    tab = Tab(tab_name, tuning, midi_data, output_dir=str(base_dir))
    
    # Generate multi-line timestamped ASCII tab
    timestamped_tab_text = build_timestamped_tab_str(tab, measures_per_line=3)
    
    # Export to .txt file in the same directory
    output_txt_path = base_dir / f"{tab_name}.txt"
    with open(output_txt_path, "w") as f:
        f.write(timestamped_tab_text + "\n")
        
    print("\n" + "=" * 80)
    print(f"GENERATED TIMESTAMPED TABLATURE FOR: {midi_filename}")
    print("=" * 80 + "\n")
    print(timestamped_tab_text)
    
    print("\n" + "=" * 80)
    if output_txt_path.exists():
        print(f"SUCCESS: Saved timestamped text file at {output_txt_path}")
    else:
        print(f"WARNING: Text file was not found at {output_txt_path}")
    print("=" * 80)

if __name__ == "__main__":
    main()
