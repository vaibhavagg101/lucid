/**
 * Unit tests for the Firebase Cloud Functions in src/index.ts.
 *
 * All Firebase/PubSub dependencies are mocked, so the suite runs fully
 * offline: no credentials, emulator, or network access required.
 */

// Test globals are imported from @jest/globals instead of relying on
// ambient types — this keeps `tsc` (the production build) happy since the
// test file lives inside src/.
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import {
  onNewUserSignIn,
  backgroundAudioProcessing,
  triggerStemsCreation,
  validateAudioFile,
} from '../index';
import { getStorage } from 'firebase-admin/storage';
import * as mm from 'music-metadata';

// --- Mocked dependencies -------------------------------------------------

jest.mock('firebase-admin/app', () => ({
  initializeApp: jest.fn(),
}));

// In-memory fake Firestore: writes land in `store` and every set is
// recorded in `setCalls` so the tests can assert on what was saved.
jest.mock('firebase-admin/firestore', () => {
  const store: Record<string, Record<string, Record<string, unknown>>> = {};
  const setCalls: { collection: string; id: string; data: Record<string, unknown> }[] = [];

  return {
    getFirestore: jest.fn(() => ({
      collection: (name: string) => ({
        doc: (id: string) => ({
          set: jest.fn(async (data: Record<string, unknown>) => {
            (store[name] ??= {})[id] = data;
            setCalls.push({ collection: name, id, data });
          }),
          update: jest.fn(async (data: Record<string, unknown>) => {
            (store[name] ??= {})[id] = { ...((store[name] ?? {})[id] ?? {}), ...data };
          }),
          get: jest.fn(async () => ({
            exists: Boolean((store[name] ?? {})[id]),
            data: () => (store[name] ?? {})[id],
          })),
        }),
      }),
    })),
    __mock: {
      store,
      setCalls,
      reset: () => {
        for (const key of Object.keys(store)) delete store[key];
        setCalls.length = 0;
      },
    },
  };
});

// The Pub/Sub client is captured so tests can inspect which topic was used
// and what payload was published.
jest.mock('@google-cloud/pubsub', () => {
  const publishMessage = jest.fn(async () => 'message-id');
  const topic = jest.fn(() => ({ publishMessage }));

  return {
    PubSub: jest.fn(() => ({ topic })),
    __mock: { publishMessage, topic },
  };
});

// defineString values are made predictable (`value:<name>`) so the tests
// can assert which topic a message actually went to.
jest.mock('firebase-functions/params', () => ({
  defineString: jest.fn((name: string) => ({
    value: () => `value:${name}`,
  })),
}));

jest.mock('firebase-functions/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}));

// The trigger wrappers are stubbed out so the raw handlers can be invoked
// directly with a synthetic event object.
jest.mock('firebase-functions/v1', () => ({
  auth: {
    user: () => ({
      onCreate: (handler: unknown) => handler,
    }),
  },
}));

jest.mock('firebase-functions/v2/firestore', () => ({
  onDocumentCreated: (_path: string, handler: unknown) => handler,
  onDocumentUpdated: (_path: string, handler: unknown) => handler,
}));

jest.mock('firebase-admin/storage', () => ({
  getStorage: jest.fn(),
}));

jest.mock('music-metadata', () => ({
  parseStream: jest.fn(),
}));

// --- Test helpers ---------------------------------------------------------

const dbMock = (jest.requireMock('firebase-admin/firestore') as any).__mock as {
  setCalls: { collection: string; id: string; data: Record<string, unknown> }[];
  reset: () => void;
};

const pubsubMock = (jest.requireMock('@google-cloud/pubsub') as any).__mock as {
  publishMessage: any;
  topic: any;
};

type EventDoc = { data: () => any; ref?: any };

// The handlers read snapshots through a .data() method, so a plain object
// with that shape is enough to stand in for a Firestore document snapshot.
function makeDoc(data: any, ref?: any): EventDoc {
  return { data: () => data, ref };
}

function makeUpdatedEvent(before: any, after: any) {
  return { data: { before: makeDoc(before), after: makeDoc(after) } };
}

function makeCreatedEvent(data: any, ref: any) {
  return { data: makeDoc(data, ref) };
}

// The update mock is typed as `any` so `expect(ref.update).toHaveBeenCalledWith(...)`
// accepts any payload (Jest 30 type-checks it against the mock's inferred signature).
function makeDocRef() {
  return { update: jest.fn(async () => {}) as any };
}

// Defaults to a valid 1MB / 5 minute file; individual tests override the
// pieces they care about.
function makeFile(overrides: Record<string, unknown> = {}) {
  return {
    exists: jest.fn(async () => [true]),
    getMetadata: jest.fn(async () => [{ size: '1048576' }]),
    createReadStream: jest.fn(() => ({ destroy: jest.fn() })),
    delete: jest.fn(async () => {}),
    ...overrides,
  };
}

let currentFile: any;

beforeEach(() => {
  // Fresh state for every test so mocks and call counts don't leak over.
  dbMock.reset();
  pubsubMock.publishMessage.mockClear();
  pubsubMock.topic.mockClear();
  (mm.parseStream as any).mockReset();

  (getStorage as any).mockReset();
  (getStorage as any).mockReturnValue({
    bucket: jest.fn(() => ({ file: jest.fn(() => currentFile) })),
  });

  currentFile = makeFile();
});

// --- onNewUserSignIn -------------------------------------------------------

describe('onNewUserSignIn', () => {
  it('creates a user document with a default youtubeUses counter', async () => {
    await onNewUserSignIn({
      uid: 'user-1',
      email: 'alice@example.com',
      displayName: 'Alice',
    } as any);

    expect(dbMock.setCalls).toHaveLength(1);
    expect(dbMock.setCalls[0]).toEqual({
      collection: 'users',
      id: 'user-1',
      data: {
        uid: 'user-1',
        username: 'alice',
        email: 'alice@example.com',
        displayName: 'Alice',
        youtubeUses: 0,
      },
    });
  });

  // Accounts without an email (e.g. GitHub-only signups) shouldn't crash
  // the handler.
  it('falls back to "unknown" when the email has no username part', async () => {
    await onNewUserSignIn({ uid: 'user-2', email: undefined, displayName: null } as any);

    expect(dbMock.setCalls[0].data.username).toBe('unknown');
  });
});

// --- backgroundAudioProcessing ---------------------------------------------

describe('backgroundAudioProcessing', () => {
  const audioDoc = (usingNoiseReduced: boolean | null) => ({
    id: 'audio-1',
    usingNoiseReduced,
    filepath: 'user-1/audio/audio-1.mp3',
    filetype: 'mp3',
  });

  it('publishes a processing message when usingNoiseReduced flips to true', async () => {
    await backgroundAudioProcessing(makeUpdatedEvent(audioDoc(null), audioDoc(true)) as any);

    expect(pubsubMock.topic).toHaveBeenCalledWith('value:BG_PROCESSING_PUBSUB_TOPIC');
    expect(pubsubMock.publishMessage).toHaveBeenCalledTimes(1);

    // Decode the published buffer to check the containers get everything
    // they need (bucket included) to pull the file and process it.
    const payload = JSON.parse(pubsubMock.publishMessage.mock.calls[0][0].data.toString());
    expect(payload).toEqual({
      audio_id: 'audio-1',
      usingNoiseReduced: true,
      filepath: 'user-1/audio/audio-1.mp3',
      filetype: 'mp3',
      gsBucket: 'value:GSBUCKET',
    });
  });

  it('publishes a processing message when usingNoiseReduced flips to false', async () => {
    await backgroundAudioProcessing(makeUpdatedEvent(audioDoc(true), audioDoc(false)) as any);

    expect(pubsubMock.publishMessage).toHaveBeenCalledTimes(1);
  });

  it('does not publish when usingNoiseReduced is unchanged', async () => {
    await backgroundAudioProcessing(makeUpdatedEvent(audioDoc(false), audioDoc(false)) as any);

    expect(pubsubMock.publishMessage).not.toHaveBeenCalled();
  });

  it('does not publish when usingNoiseReduced is missing from the update', async () => {
    await backgroundAudioProcessing(
      makeUpdatedEvent({ id: 'audio-1' }, { id: 'audio-1' }) as any
    );

    expect(pubsubMock.publishMessage).not.toHaveBeenCalled();
  });
});

// --- triggerStemsCreation ---------------------------------------------------

describe('triggerStemsCreation', () => {
  const audioDoc = (separationOption: number) => ({
    id: 'audio-1',
    separationOption,
    filepath: 'user-1/audio/audio-1.mp3',
    filetype: 'mp3',
  });

  it('publishes a stem message when separationOption changes', async () => {
    await triggerStemsCreation(makeUpdatedEvent(audioDoc(0), audioDoc(2)) as any);

    expect(pubsubMock.topic).toHaveBeenCalledWith('value:STEM_PUBSUB_TOPIC');
    expect(pubsubMock.publishMessage).toHaveBeenCalledTimes(1);

    const payload = JSON.parse(pubsubMock.publishMessage.mock.calls[0][0].data.toString());
    expect(payload).toEqual({
      separationOption: 2,
      filepath: 'user-1/audio/audio-1.mp3',
      filetype: 'mp3',
      gsBucket: 'value:GSBUCKET',
    });
  });

  it('does not publish when separationOption is unchanged', async () => {
    await triggerStemsCreation(makeUpdatedEvent(audioDoc(2), audioDoc(2)) as any);

    expect(pubsubMock.publishMessage).not.toHaveBeenCalled();
  });
});

// --- validateAudioFile ------------------------------------------------------

describe('validateAudioFile', () => {
  const eventData = { filepath: 'user-1/audio/audio-1.mp3' };

  it('marks the document as validated for a valid file', async () => {
    (mm.parseStream as any).mockResolvedValue({ format: { duration: 300 } });
    const ref = makeDocRef();

    await validateAudioFile(makeCreatedEvent(eventData, ref) as any);

    expect(ref.update).toHaveBeenCalledWith({ validated: true });
    expect(currentFile.delete).not.toHaveBeenCalled();
  });

  it('marks the document as unvalidated when the file does not exist', async () => {
    currentFile = makeFile({ exists: jest.fn(async () => [false]) });
    const ref = makeDocRef();

    await validateAudioFile(makeCreatedEvent(eventData, ref) as any);

    expect(ref.update).toHaveBeenCalledWith({ validated: false });
    expect(currentFile.delete).not.toHaveBeenCalled();
  });

  it('rejects files larger than 50MB and deletes them', async () => {
    currentFile = makeFile({
      getMetadata: jest.fn(async () => [{ size: String(51 * 1024 * 1024) }]),
    });
    const ref = makeDocRef();

    await validateAudioFile(makeCreatedEvent(eventData, ref) as any);

    expect(currentFile.delete).toHaveBeenCalled();
    expect(ref.update).toHaveBeenCalledWith({ validated: false });
  });

  it('rejects files longer than 6.5 minutes and deletes them', async () => {
    (mm.parseStream as any).mockResolvedValue({ format: { duration: 400 } });
    const ref = makeDocRef();

    await validateAudioFile(makeCreatedEvent(eventData, ref) as any);

    expect(currentFile.delete).toHaveBeenCalled();
    expect(ref.update).toHaveBeenCalledWith({ validated: false });
  });

  // A file we can't even read metadata for is treated as invalid rather
  // than letting an unparseable upload slip through.
  it('marks the document as unvalidated when metadata parsing fails', async () => {
    (mm.parseStream as any).mockRejectedValue(new Error('decode failed'));
    const ref = makeDocRef();

    await validateAudioFile(makeCreatedEvent(eventData, ref) as any);

    expect(ref.update).toHaveBeenCalledWith({ validated: false });
  });
});
