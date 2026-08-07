import { beforeEach, describe, expect, it, vi } from 'vitest';

// deleteAudioFile is the security-sensitive action: it verifies the caller's
// ID token, makes sure the file actually belongs to them, and only then
// removes the GCS blobs and the Firestore document. The admin SDK is fully
// mocked so the suite runs without any real Firebase credentials.
const mocks = vi.hoisted(() => {
  const verifyIdToken = vi.fn();
  const docGet = vi.fn();
  const docDelete = vi.fn();
  const deleteFiles = vi.fn();
  return { verifyIdToken, docGet, docDelete, deleteFiles };
});

vi.mock('firebase-admin/app', () => ({
  getApps: () => [],
  initializeApp: vi.fn(),
}));

vi.mock('firebase-admin/auth', () => ({
  getAuth: () => ({ verifyIdToken: mocks.verifyIdToken }),
}));

vi.mock('firebase-admin/firestore', () => ({
  getFirestore: () => ({
    collection: () => ({
      doc: () => ({
        get: mocks.docGet,
        delete: mocks.docDelete,
      }),
    }),
  }),
}));

vi.mock('firebase-admin/storage', () => ({
  getStorage: () => ({
    bucket: () => ({ deleteFiles: mocks.deleteFiles }),
  }),
}));

import { deleteAudioFile } from './delete-audio';

describe('deleteAudioFile', () => {
  beforeEach(() => {
    // Reset every mock so call counts don't leak between tests.
    mocks.verifyIdToken.mockReset();
    mocks.docGet.mockReset();
    mocks.docDelete.mockReset();
    mocks.deleteFiles.mockReset();
    mocks.docDelete.mockResolvedValue(undefined);
    mocks.deleteFiles.mockResolvedValue(undefined);
  });

  it('deletes the file blobs and the document for the owning user', async () => {
    mocks.verifyIdToken.mockResolvedValue({ uid: 'user-1' });
    mocks.docGet.mockResolvedValue({
      exists: true,
      data: () => ({ userId: 'user-1', filetype: 'mp3' }),
    });

    const result = await deleteAudioFile({
      token: 'token',
      audioId: 'audio-1',
      gsBucket: 'my-bucket',
    });

    expect(result).toEqual({ deleted: true });
    // All derived files live under the original file's path, so one prefix
    // delete wipes the audio, chords, stems, etc. in one go.
    expect(mocks.deleteFiles).toHaveBeenCalledWith({ prefix: 'user-1/audio/audio-1.mp3' });
    expect(mocks.docDelete).toHaveBeenCalled();
  });

  // The bucket can come in with or without the gs:// prefix depending on
  // where it's read from, so both must work.
  it('strips a gs:// prefix from the bucket name', async () => {
    mocks.verifyIdToken.mockResolvedValue({ uid: 'user-1' });
    mocks.docGet.mockResolvedValue({
      exists: true,
      data: () => ({ userId: 'user-1', filetype: 'wav' }),
    });

    await deleteAudioFile({ token: 'token', audioId: 'audio-1', gsBucket: 'gs://my-bucket' });

    expect(mocks.deleteFiles).toHaveBeenCalledWith({ prefix: 'user-1/audio/audio-1.wav' });
  });

  it('rejects a request with missing fields', async () => {
    await expect(
      deleteAudioFile({ token: '', audioId: 'audio-1', gsBucket: 'my-bucket' })
    ).rejects.toThrow('Missing auth token');
    expect(mocks.verifyIdToken).not.toHaveBeenCalled();
  });

  it('rejects an unverifiable token', async () => {
    mocks.verifyIdToken.mockRejectedValue(new Error('invalid token'));

    await expect(
      deleteAudioFile({ token: 'bad', audioId: 'audio-1', gsBucket: 'my-bucket' })
    ).rejects.toThrow('Unauthenticated user.');
  });

  it('rejects a request for a document that does not exist', async () => {
    mocks.verifyIdToken.mockResolvedValue({ uid: 'user-1' });
    mocks.docGet.mockResolvedValue({ exists: false });

    await expect(
      deleteAudioFile({ token: 'token', audioId: 'audio-1', gsBucket: 'my-bucket' })
    ).rejects.toThrow('Audio file not found.');
    expect(mocks.deleteFiles).not.toHaveBeenCalled();
  });

  // The important one: deleting someone else's file must fail and touch
  // nothing.
  it('rejects a request for another user\u2019s file', async () => {
    mocks.verifyIdToken.mockResolvedValue({ uid: 'user-1' });
    mocks.docGet.mockResolvedValue({
      exists: true,
      data: () => ({ userId: 'user-2', filetype: 'mp3' }),
    });

    await expect(
      deleteAudioFile({ token: 'token', audioId: 'audio-1', gsBucket: 'my-bucket' })
    ).rejects.toThrow('Unauthorised');
    expect(mocks.deleteFiles).not.toHaveBeenCalled();
    expect(mocks.docDelete).not.toHaveBeenCalled();
  });
});
