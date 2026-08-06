import { useEffect, useState } from 'react';
import { fetchStorageBlob } from '../../google-firebase/storage';

// Renders the audio fingerprint PNG stored in Storage (private, so it's fetched via getBlob rather than a public URL).
function FingerprintThumbnail({ filepath, alt }) {
    const [imageUrl, setImageUrl] = useState(null);

    useEffect(() => {
        if (!filepath) return;
        let cancelled = false;
        let objectUrl = null;

        fetchStorageBlob(filepath)
            .then((blob) => {
                if (cancelled) return;
                objectUrl = URL.createObjectURL(blob);
                setImageUrl(objectUrl);
            })
            .catch((error) => {
                console.error('Error fetching fingerprint image:', error);
            });

        return () => {
            cancelled = true;
            if (objectUrl) URL.revokeObjectURL(objectUrl);
        };
    }, [filepath]);

    if (!imageUrl) return null;

    return (
        <img
            src={imageUrl}
            alt={alt}
            className="h-14 w-14 shrink-0 rounded-lg border border-outline/30 bg-surface-variant object-cover sm:h-16 sm:w-16"
        />
    );
}

export default FingerprintThumbnail;
