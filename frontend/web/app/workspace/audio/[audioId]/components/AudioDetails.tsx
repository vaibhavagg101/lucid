import { AudioFileDoc } from '@/app/google-firebase/firestore';

interface AudioDetailsProps {
    audioDoc: AudioFileDoc;
}

function DetailBadge({ label, value }: { label: string; value: string }) {
    return (
        <div className="rounded-2xl border border-outline/30 px-4 py-3">
            <p className="text-xs font-medium text-on-surface-variant">{label}</p>
            <p className="mt-1 text-sm font-semibold text-on-surface">{value}</p>
        </div>
    );
}

export default function AudioDetails({ audioDoc }: AudioDetailsProps) {
    const uploadedDate = audioDoc.uploadedAt?.toDate?.();

    return (
        <div className="mt-8 grid w-full grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            <DetailBadge label="Filename" value={`${audioDoc.filename}.${audioDoc.filetype}`} />
            <DetailBadge label="Key" value={audioDoc.key || 'Detecting...'} />
            <DetailBadge label="BPM" value={audioDoc.bpm ? `${Math.round(audioDoc.bpm)}` : 'Detecting...'} />

            {audioDoc.channels != null && (
                <DetailBadge
                    label="Channels"
                    value={audioDoc.channels === 2 ? 'Stereo' : audioDoc.channels === 1 ? 'Mono' : `${audioDoc.channels}`}
                />
            )}

            {audioDoc.frame_rate != null && (
                <DetailBadge label="Sample Rate" value={`${audioDoc.frame_rate} Hz`} />
            )}

            {audioDoc.sample_width != null && (
                <DetailBadge label="Bit Depth" value={`${audioDoc.sample_width * 8} bits`} />
            )}

            <DetailBadge label="Noise Reduced" value={audioDoc.usingNoiseReduced ? 'Yes' : 'No'} />

            {uploadedDate && (
                <DetailBadge label="Uploaded" value={uploadedDate.toLocaleDateString('en-GB')} />
            )}
        </div>
    );
}
