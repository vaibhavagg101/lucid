import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// triggerMidiConversion runs on the server: it verifies the caller's token
// and that the stem filepath belongs to them, creates a Firestore job, and
// publishes to Pub/Sub. The admin SDK and PubSub are both mocked here.
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

import { triggerMidiConversion } from './midi';

describe('triggerMidiConversion', () => {
  beforeEach(() => {
    // Force the fallback topic name so the assertions below hold even when
    // MIDI_PUBSUB_TOPIC happens to be set on the dev machine.
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

    // The published payload is a JSON buffer; decode it back to verify
    // exactly what the MIDI container will receive.
    const payload = JSON.parse(mocks.publishMessage.mock.calls[0][0].data.toString());
    expect(payload).toEqual({
      jobId: 'job-1',
      gsBucket: 'my-bucket',
      filepath: 'user-1/audio/audio-1.mp3',
      audioId: 'audio-1',
    });
  });

  // Stems live under /{userId}/..., so any path outside that prefix is
  // rejected before a job is even created.
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
