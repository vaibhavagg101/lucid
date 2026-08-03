/**
 * Import function triggers from their respective submodules:
 *
 * import {onCall} from "firebase-functions/v2/https";
 * import {onDocumentWritten} from "firebase-functions/v2/firestore";
 *
 * See a full list of supported triggers at https://firebase.google.com/docs/functions
 */

import { setGlobalOptions } from "firebase-functions"
import * as logger from "firebase-functions/logger"
import * as functionsV1 from "firebase-functions/v1"
import { onDocumentCreated, onDocumentUpdated } from "firebase-functions/v2/firestore"
import { initializeApp } from "firebase-admin/app"
import { getFirestore } from "firebase-admin/firestore"
import { PubSub } from "@google-cloud/pubsub"
import { defineString } from "firebase-functions/params" // <-- Add this import
import { getStorage } from "firebase-admin/storage"
import * as mm from "music-metadata"

// Start writing functions
// https://firebase.google.com/docs/functions/typescript

// For cost control, you can set the maximum number of containers that can be
// running at the same time. This helps mitigate the impact of unexpected
// traffic spikes by instead downgrading performance. This limit is a
// per-function limit. You can override the limit for each function using the
// `maxInstances` option in the function's options, e.g.
// `onRequest({ maxInstances: 5 }, (req, res) => { ... })`.
// NOTE: setGlobalOptions does not apply to functions using the v1 API. V1
// functions should each use functions.runWith({ maxInstances: 10 }) instead.
// In the v1 API, each function can only serve one request per container, so
// this will be the maximum concurrent request count.
setGlobalOptions({ maxInstances: 10 })

initializeApp()

const db = getFirestore()

const pubsub = new PubSub();
const bg_processing_pubsub_topic = defineString('BG_PROCESSING_PUBSUB_TOPIC');
const stem_pubsub_topic = defineString('STEM_PUBSUB_TOPIC');
const bucket_name = defineString('GSBUCKET');

export const onNewUserSignIn = functionsV1.auth.user().onCreate(async (user) => {
    const userInfo = {
        uid: user.uid,
        username: user.email?.split("@")[0] || "unknown",
        email: user.email,
        displayName: user.displayName,
        youtubeUses: 0
    }

    await db.collection("users").doc(user.uid).set(userInfo)
    logger.info("User created", { uid: user.uid })
    return
})

export const backgroundAudioProcessing = onDocumentUpdated("audio_files/{audio_id}", (event) => {
    const beforeValue = event.data?.before.data()
    const updatedValue = event.data?.after.data()
    if (updatedValue &&
        beforeValue &&
        updatedValue.usingNoiseReduced != null &&
        updatedValue.usingNoiseReduced !== beforeValue.usingNoiseReduced) {
        const payload = {
            audio_id: updatedValue.id,
            usingNoiseReduced: updatedValue.usingNoiseReduced,
            filepath: updatedValue.filepath,
            filetype: updatedValue.filetype,
            gsBucket: bucket_name.value()
        }

        const dataBuffer = Buffer.from(JSON.stringify(payload));
        pubsub.topic(bg_processing_pubsub_topic.value()).publishMessage({ data: dataBuffer });
    }
    return null
})

export const triggerStemsCreation = onDocumentUpdated("audio_files/{audio_id}", (event) => {
    const beforeValue = event.data?.before.data()
    const updatedValue = event.data?.after.data()
    if (updatedValue &&
        beforeValue &&
        updatedValue.separationOption != null &&
        updatedValue.separationOption !== beforeValue.separationOption) {
        const payload = {
            separationOption: updatedValue.separationOption,
            filepath: updatedValue.filepath,
            filetype: updatedValue.filetype,
            gsBucket: bucket_name.value()
        }

        const dataBuffer = Buffer.from(JSON.stringify(payload));
        pubsub.topic(stem_pubsub_topic.value()).publishMessage({ data: dataBuffer });
    }
    return null
})

export const validateAudioFile = onDocumentCreated("audio_files/{audio_id}", async (event) => {
    if (!event.data) {
        logger.error("No event data found in the event", { event })
        return
    }

    const object = event.data.data()
    if (!object) {
        logger.error("No object data found in the event", { event })
        return
    }

    const filePath = object.filepath || ""
    const gsBucket = bucket_name.value()
    const docRef = event.data.ref

    try {
        const bucket = getStorage().bucket(gsBucket)
        const file = bucket.file(filePath)

        const [exists] = await file.exists()
        if (!exists) {
            logger.error("File does not exist in bucket", { filePath })
            await docRef.update({ validated: false })
            return
        }

        const [metadata] = await file.getMetadata()
        const sizeBytes = Number(metadata.size) || 0
        const FIFTY_MB = 50 * 1024 * 1024

        if (sizeBytes > FIFTY_MB) {
            logger.warn("File size exceeds 50MB", { sizeBytes })
            await file.delete().catch(err => logger.error("File deletion failed", { err }))
            await docRef.update({ validated: false })
            return
        }

        const readStream = file.createReadStream()
        let durationSeconds = 0
        try {
            const audioMetadata = await mm.parseStream(readStream, metadata.contentType, { duration: true, skipCovers: true })
            durationSeconds = audioMetadata.format.duration || 0
        } finally {
            readStream.destroy()
        }

        const SIX_AND_HALF_MINUTES = 6.5 * 60

        if (durationSeconds > SIX_AND_HALF_MINUTES) {
            logger.warn("File duration exceeds 6.5 minutes", { durationSeconds })
            await file.delete().catch(err => logger.error("File deletion failed", { err }))
            await docRef.update({ validated: false })
            return
        }

        await docRef.update({ validated: true })
    } catch (error) {
        logger.error("Error validating audio", { error, object })
        try {
            const bucket = getStorage().bucket(gsBucket)
            await bucket.file(filePath).delete().catch(() => { })
        } catch (e) {
            logger.error("Error falling back to file deletion", { e })
        }
        await docRef.update({ validated: false })
    }
})