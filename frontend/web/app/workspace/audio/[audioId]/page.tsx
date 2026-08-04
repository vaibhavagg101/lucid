import DynamicAudioFile from './dynamic'

export const metadata = {
    title: 'Audio File | LUCID',
    description: 'Play your audio, view chords, stems and MIDI files.',
}

export default function AudioFilePage() {
    return <div className='main'>
        <DynamicAudioFile />
    </div>
}
