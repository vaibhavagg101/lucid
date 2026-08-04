
import { getStorage, ref, uploadBytesResumable, UploadTask, getBlob } from 'firebase/storage';
import { app } from './authentication';

export const storage = getStorage(app, process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET);

// Fetches a private file through the SDK (respects Storage security rules) rather than a public download URL.
export const fetchStorageBlob = (filepath: string): Promise<Blob> => {
  return getBlob(ref(storage, filepath));
};

export const triggerBlobDownload = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.style.display = 'none';
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  URL.revokeObjectURL(url);
  document.body.removeChild(a);
};

export const uploadAudioFile = (
  userId: string,
  audioId: string,
  file: File,
  fileExtension: string,
  onProgress: (progress: number) => void,
  onError: (error: Error) => void,
  onComplete: () => void
): UploadTask => {
  const filePath = `${userId}/audio/${audioId}.${fileExtension}`;
  const storageRef = ref(storage, filePath);

  const uploadTask = uploadBytesResumable(storageRef, file);

  uploadTask.on('state_changed',
    (snapshot) => {
      const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
      onProgress(progress);
    },
    (error) => {
      onError(error);
    },
    () => {
      onComplete();
    }
  );

  return uploadTask;
};
