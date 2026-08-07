import { beforeEach, describe, expect, it, vi } from 'vitest';

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
    expect(mocks.deleteFiles).toHaveBeenCalledWith({ prefix: 'user-1/audio/audio-1.mp3' });
    expect(mocks.docDelete).toHaveBeenCalled();
  });

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
