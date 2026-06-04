
import { getBlob, getStorage, ref, uploadBytesResumable, UploadTask } from 'firebase/storage';
import { app } from './authentication';

const storage = getStorage(app, process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET);

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
