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
import { onDocumentUpdated } from "firebase-functions/v2/firestore"
import { initializeApp } from "firebase-admin/app"
import { getFirestore } from "firebase-admin/firestore"
import { PubSub } from "@google-cloud/pubsub"
import { defineString } from "firebase-functions/params" // <-- Add this import

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