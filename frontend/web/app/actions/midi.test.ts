import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

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

vi.mock('@google-cloud/pubsub', () => {
  class PubSubMock {
    topic = mocks.topic;
  }
  return { PubSub: PubSubMock };
});

import { triggerMidiConversion } from './midi';

describe('triggerMidiConversion', () => {
  beforeEach(() => {
    // Ensure the fallback topic name is used regardless of the developer's environment.
    vi.stubEnv('MIDI_PUBSUB_TOPIC', '');
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

  it('starts a MIDI job for a file owned by the user', async () => {
    mocks.verifyIdToken.mockResolvedValue({ uid: 'user-1' });
    mocks.jobAdd.mockResolvedValue({ id: 'job-1' });

    const result = await triggerMidiConversion({
      token: 'token',
      gsBucket: 'my-bucket',
      filepath: 'user-1/audio/audio-1.mp3',
      audioId: 'audio-1',
    });

    expect(result).toEqual({ jobId: 'job-1' });
    expect(mocks.jobAdd).toHaveBeenCalledWith(
      expect.objectContaining({ userid: 'user-1', status: 'processing' })
    );
    expect(mocks.topic).toHaveBeenCalledWith('midi-topic');
    expect(mocks.publishMessage).toHaveBeenCalledTimes(1);

    const payload = JSON.parse(mocks.publishMessage.mock.calls[0][0].data.toString());
    expect(payload).toEqual({
      jobId: 'job-1',
      gsBucket: 'my-bucket',
      filepath: 'user-1/audio/audio-1.mp3',
      audioId: 'audio-1',
    });
  });

  it('rejects a filepath that does not belong to the user', async () => {
    mocks.verifyIdToken.mockResolvedValue({ uid: 'user-1' });

    await expect(
      triggerMidiConversion({
        token: 'token',
        gsBucket: 'my-bucket',
        filepath: 'user-2/audio/audio-1.mp3',
        audioId: 'audio-1',
      })
    ).rejects.toThrow('Unauthorised');
    expect(mocks.jobAdd).not.toHaveBeenCalled();
    expect(mocks.topic).not.toHaveBeenCalled();
  });

  it('rejects an unverifiable token', async () => {
    mocks.verifyIdToken.mockRejectedValue(new Error('invalid token'));

    await expect(
      triggerMidiConversion({
        token: 'bad',
        gsBucket: 'my-bucket',
        filepath: 'user-1/audio/audio-1.mp3',
        audioId: 'audio-1',
      })
    ).rejects.toThrow('Unauthenticated user.');
    expect(mocks.jobAdd).not.toHaveBeenCalled();
  });
});
