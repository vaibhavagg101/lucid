import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// noiseReduce follows the same pattern as the other server actions: verify
// token + ownership, create a Firestore job, publish to Pub/Sub. The extra
// bit is the optional noise-clip range, which is only forwarded when the
// user actually selected a clip in the preview.
const mocks = vi.hoisted(() => {
  const verifyIdToken = vi.fn();
  const jobAdd = vi.fn();
  const topic = vi.fn();
  const publishMessage = vi.fn();
  return { verifyIdToken, jobAdd, topic, publishMessage };
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
      add: mocks.jobAdd,
    }),
  }),
}));

// Vitest 4 rejects mockReturnValue when the mock is called with `new`, so
// PubSub is mocked as a real class whose `topic` method returns the shared
// mock function.
vi.mock('@google-cloud/pubsub', () => {
  class PubSubMock {
    topic = mocks.topic;
  }
  return { PubSub: PubSubMock };
});

import { noiseReduce } from './noisereduce';

describe('noiseReduce', () => {
  beforeEach(() => {
    // Force the fallback topic name so the assertions below hold even when
    // NR_PUBSUB_TOPIC happens to be set on the dev machine.
    vi.stubEnv('NR_PUBSUB_TOPIC', '');
    mocks.verifyIdToken.mockReset();
    mocks.jobAdd.mockReset();
    mocks.topic.mockReset();
    mocks.publishMessage.mockReset();
    mocks.topic.mockReturnValue({ publishMessage: mocks.publishMessage });
    mocks.publishMessage.mockResolvedValue('message-id');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('starts a noise reduction job without a noise clip', async () => {
    mocks.verifyIdToken.mockResolvedValue({ uid: 'user-1' });
    mocks.jobAdd.mockResolvedValue({ id: 'job-1' });

    const result = await noiseReduce({
      token: 'token',
      gsBucket: 'my-bucket',
      filepath: 'user-1/audio/audio-1.mp3',
      filetype: 'audio/mpeg',
      noiseclip: false,
    });

    expect(result).toEqual({ jobId: 'job-1' });
    expect(mocks.topic).toHaveBeenCalledWith('noisereduce-topic');
    expect(mocks.publishMessage).toHaveBeenCalledTimes(1);

    // Decode the published buffer to check the container will receive the
    // same fields the frontend sent.
    const payload = JSON.parse(mocks.publishMessage.mock.calls[0][0].data.toString());
    expect(payload).toEqual({
      jobId: 'job-1',
      gsBucket: 'my-bucket',
      filepath: 'user-1/audio/audio-1.mp3',
      filetype: 'audio/mpeg',
      noiseclip: false,
    });
  });

  it('includes the noise clip bounds when noiseclip is enabled', async () => {
    mocks.verifyIdToken.mockResolvedValue({ uid: 'user-1' });
    mocks.jobAdd.mockResolvedValue({ id: 'job-1' });

    await noiseReduce({
      token: 'token',
      gsBucket: 'my-bucket',
      filepath: 'user-1/audio/audio-1.mp3',
      filetype: 'audio/mpeg',
      noiseclip: true,
      startPoint: 1200,
      endPoint: 3500,
    });

    const payload = JSON.parse(mocks.publishMessage.mock.calls[0][0].data.toString());
    expect(payload).toEqual({
      jobId: 'job-1',
      gsBucket: 'my-bucket',
      filepath: 'user-1/audio/audio-1.mp3',
      filetype: 'audio/mpeg',
      noiseclip: true,
      startPoint: 1200,
      endPoint: 3500,
    });
  });

  // Selecting a noise clip without a start/end is a user error the server
  // should catch before anything is published.
  it('rejects a noiseclip request without clip bounds', async () => {
    mocks.verifyIdToken.mockResolvedValue({ uid: 'user-1' });

    await expect(
      noiseReduce({
        token: 'token',
        gsBucket: 'my-bucket',
        filepath: 'user-1/audio/audio-1.mp3',
        filetype: 'audio/mpeg',
        noiseclip: true,
      })
    ).rejects.toThrow('startPoint and endPoint are required when noiseclip is true');
    expect(mocks.topic).not.toHaveBeenCalled();
  });

  it('rejects a filepath that does not belong to the user', async () => {
    mocks.verifyIdToken.mockResolvedValue({ uid: 'user-1' });

    await expect(
      noiseReduce({
        token: 'token',
        gsBucket: 'my-bucket',
        filepath: 'user-2/audio/audio-1.mp3',
        filetype: 'audio/mpeg',
        noiseclip: false,
      })
    ).rejects.toThrow('Unauthorised');
    expect(mocks.topic).not.toHaveBeenCalled();
  });

  it('rejects an unverifiable token', async () => {
    mocks.verifyIdToken.mockRejectedValue(new Error('invalid token'));

    await expect(
      noiseReduce({
        token: 'bad',
        gsBucket: 'my-bucket',
        filepath: 'user-1/audio/audio-1.mp3',
        filetype: 'audio/mpeg',
        noiseclip: false,
      })
    ).rejects.toThrow('Unauthenticated user.');
    expect(mocks.topic).not.toHaveBeenCalled();
  });
});
