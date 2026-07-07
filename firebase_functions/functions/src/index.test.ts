/// <reference types="jest" />
const firebaseFunctionsTest = require("firebase-functions-test");

// Initialize firebase-functions-test before importing the module we are testing
const testEnv = firebaseFunctionsTest();

// Mock getFirestore
const mockSet = jest.fn();
const mockUpdate = jest.fn();
const mockDoc = jest.fn((path?: string) => ({
    set: mockSet,
    update: mockUpdate,
}));
const mockCollection = jest.fn((path?: string) => ({
    doc: mockDoc,
}));

jest.mock("firebase-admin/firestore", () => {
    const originalModule = jest.requireActual("firebase-admin/firestore");
    return {
        ...originalModule,
        getFirestore: jest.fn(() => ({
            collection: mockCollection,
        })),
    };
});

import { getFirestore } from "firebase-admin/firestore";
import { onNewUserSignIn, generateAudioFingerprint } from "./index";

describe("Cloud Functions", () => {
    let db: any;

    beforeEach(() => {
        db = getFirestore();
        jest.clearAllMocks();
    });

    afterAll(() => {
        testEnv.cleanup();
    });

    describe("onNewUserSignIn", () => {
        it("should create a user document with the correct info when a new user signs in", async () => {
            const wrapped = testEnv.wrap(onNewUserSignIn);
            const user = testEnv.auth.makeUserRecord({
                uid: "testUid123",
                email: "testuser@example.com",
                displayName: "Test User"
            });

            await wrapped(user);

            expect(db.collection).toHaveBeenCalledWith("users");
            expect(db.collection("users").doc).toHaveBeenCalledWith("testUid123");
            expect(db.collection("users").doc("testUid123").set).toHaveBeenCalledWith({
                uid: "testUid123",
                username: "testuser",
                email: "testuser@example.com",
                displayName: "Test User",
                youtubeUses: 0
            });
        });
        
        it("should handle missing email and displayName gracefully", async () => {
            const wrapped = testEnv.wrap(onNewUserSignIn);
            // makeUserRecord creates defaults for some fields, let's explicitly use an object
            const customUser = { uid: "testUid456" };
            
            await wrapped(customUser as any);

            expect(db.collection).toHaveBeenCalledWith("users");
            expect(db.collection("users").doc).toHaveBeenCalledWith("testUid456");
            expect(db.collection("users").doc("testUid456").set).toHaveBeenCalledWith({
                uid: "testUid456",
                username: "unknown",
                email: undefined,
                displayName: undefined,
                youtubeUses: 0
            });
        });
    });

    describe("generateAudioFingerprint", () => {
        it("should update the document if usingNoiseReduced changes", async () => {
            const beforeSnapshot = { data: () => ({
                usingNoiseReduced: false,
                otherField: "test"
            })};
            
            const afterSnapshot = { data: () => ({
                usingNoiseReduced: true,
                otherField: "test"
            })};
            
            const event = {
                data: {
                    before: beforeSnapshot,
                    after: afterSnapshot
                },
                params: {
                    audio_id: "testAudioId123"
                }
            };

            await generateAudioFingerprint.run(event as any);

            expect(mockCollection).toHaveBeenCalledWith("audio_files");
            expect(mockCollection("audio_files").doc).toHaveBeenCalledWith("testAudioId123");
            expect(mockDoc("testAudioId123").update).toHaveBeenCalledWith({
                usingNoiseReduced: "test trigger"
            });
        });

        it("should not update the document if usingNoiseReduced does not change", async () => {
            const beforeSnapshot = { data: () => ({
                usingNoiseReduced: true,
                otherField: "test"
            })};
            
            const afterSnapshot = { data: () => ({
                usingNoiseReduced: true,
                otherField: "test2"
            })};
            
            const event = {
                data: {
                    before: beforeSnapshot,
                    after: afterSnapshot
                },
                params: {
                    audio_id: "testAudioId123"
                }
            };

            await generateAudioFingerprint.run(event as any);

            expect(mockDoc("testAudioId123").update).not.toHaveBeenCalled();
        });

        it("should not update if usingNoiseReduced is not present in after data", async () => {
            const beforeSnapshot = { data: () => ({
                usingNoiseReduced: true,
                otherField: "test"
            })};
            
            const afterSnapshot = { data: () => ({
                otherField: "test2"
            })};
            
            const event = {
                data: {
                    before: beforeSnapshot,
                    after: afterSnapshot
                },
                params: {
                    audio_id: "testAudioId123"
                }
            };

            await generateAudioFingerprint.run(event as any);

            expect(mockDoc("testAudioId123").update).not.toHaveBeenCalled();
        });
    });
});
