import { getFirestore, collection, doc, setDoc, getDocs, getDoc, query, where, updateDoc, onSnapshot } from 'firebase/firestore';
import { app } from './authentication';

export const db = getFirestore(app);

export const generateAudioDocumentId = () => {
  return doc(collection(db, 'audio_files')).id;
};

export const createAudioFileDocument = async (audioId: string, userId: string, fileName: string) => {
  const audioFilesRef = collection(db, 'audio_files');
  const newAudioDoc = doc(audioFilesRef, audioId);

  await setDoc(newAudioDoc, {
    id: audioId,
    filename: fileName.split('.').at(0) || fileName,
    filetype: fileName.split('.').pop()?.toLowerCase(),
    userId: userId,
    filepath: `${userId}/audio/${audioId}.${fileName.split('.').pop()?.toLowerCase()}`,
    uploadedAt: new Date(),
    usingNoiseReduced: null,
    separationOption: 0,
    bpm: null,
    key: null,
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

export async function updateNR(pickedNR: boolean, userId: string, audioId: string, filepath?: string | null) {
  if (!userId || !audioId) {
    throw new Error("UserId, or AudioId not provided")
  }
  const audioDocRef = doc(collection(db, 'audio_files'), audioId)
  const audioDoc = await getDoc(audioDocRef)

  if (!audioDoc.exists()) {
    throw new Error('Audio file not found');
  }

  if (audioDoc.data().userId !== userId) {
    throw new Error('Unauthorized');
  }

  const originalFilepath = audioDoc.data().filepath;

  try {
    if (pickedNR) {
      if (!filepath) {
        throw new Error("Filepath not provided.")
      }
      await updateDoc(audioDocRef, {
        filepath: filepath,
        usingNoiseReduced: true,
        originalFilepath: originalFilepath
      })
    }
    else {
      await updateDoc(audioDocRef, {
        usingNoiseReduced: false
      })
    }
  }
  catch (e) {
    throw new Error("Failed to update database")
  }
}
export const waitForAudioValidation = (audioId: string): Promise<boolean> => {
  return new Promise((resolve, reject) => {
    const unsubscribe = onSnapshot(
      doc(db, 'audio_files', audioId),
      (docSnap) => {
        if (!docSnap.exists()) {
          unsubscribe();
          reject(new Error("Document does not exist"));
          return;
        }
        const data = docSnap.data();
        if (data.validated !== undefined) {
          unsubscribe();
          resolve(data.validated);
        }
      },
      (error) => {
        unsubscribe();
        reject(error);
      }
    );
  });
};
