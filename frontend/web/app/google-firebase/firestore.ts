import { getFirestore, collection, doc, setDoc, getDocs, getDoc, query, where, updateDoc } from 'firebase/firestore';
import { app } from './authentication';

const db = getFirestore(app);

export const createAudioFileDocument = async (userId: string, fileName: string) => {
  const audioFilesRef = collection(db, 'audio_files');
  const newAudioDoc = doc(audioFilesRef);
  const audioId = newAudioDoc.id;

  await setDoc(newAudioDoc, {
    id: audioId,
    filename: fileName.split('.').at(0) || fileName,
    filetype: fileName.split('.').pop()?.toLowerCase(),
    userId: userId,
    filepath: `${userId}/audio/${audioId}`,
    uploadedAt: new Date(),
    usingNoiseReduced: false,
    noiseReducedFilepath: null,
    separationOption: 0,
    bpm: null,
    key: null,
    chordProgression: null,
  });

  return audioId;
};

export const filterAudioFilesByUser = async (userId: string) => {
  try {
    const audioFilesRef = collection(db, 'audio_files');
    const q = query(audioFilesRef, where('userId', '==', userId));
    const querySnapshot = await getDocs(q);

    const audioFiles = querySnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data()
    }));

    return audioFiles;
  } catch (error) {
    console.error("Error fetching audio files:", error);
    throw error;
  }
};

export const renameAudioFile = async (userId: string, audioId: string, newName: string): Promise<void> => {
  try {
    const audioDocRef = doc(db, 'audio_files', audioId);
    const audioDoc = await getDoc(audioDocRef);

    if (!audioDoc.exists()) {
      throw new Error('Audio file not found');
    }

    if (audioDoc.data().userId !== userId) {
      throw new Error('Unauthorized');
    }

    await updateDoc(audioDocRef, {
      filename: newName
    });
  } catch (error) {
    console.error("Error renaming audio file:", error);
    throw error;
  }
};