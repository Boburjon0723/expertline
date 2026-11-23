import * as admin from 'firebase-admin';
import path from 'path';

let serviceAccount: any;

if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    try {
        serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    } catch (err) {
        console.error('Failed to parse FIREBASE_SERVICE_ACCOUNT environment variable:', err);
    }
}

if (!serviceAccount) {
    try {
        serviceAccount = require(path.join(__dirname, '../../serviceAccountKey.json'));
    } catch (err) {
        console.warn('Firebase service account key file not found. Falling back to environment variables.');
    }
}

if (!admin.apps.length && serviceAccount) {
    const bucketName = process.env.FIREBASE_STORAGE_BUCKET || `${serviceAccount.project_id}.firebasestorage.app`;
    
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        storageBucket: bucketName
    });
    console.log(`[Firebase] Initialized with bucket: ${bucketName}`);
}

const firebaseConfigured = admin.apps.length > 0;

if (!firebaseConfigured) {
    console.warn('[Firebase] Not configured (no FIREBASE_SERVICE_ACCOUNT / serviceAccountKey.json). File uploads to Firebase Storage are disabled.');
}

function notConfigured(name: string): never {
    throw new Error(`[Firebase] ${name} is unavailable: Firebase is not configured.`);
}

/** Lazy proxies so the server can boot locally without Firebase credentials. */
export const bucket: ReturnType<ReturnType<typeof admin.storage>['bucket']> = firebaseConfigured
    ? admin.storage().bucket()
    : (new Proxy({}, { get: () => notConfigured('Storage bucket') }) as any);
export const db: ReturnType<typeof admin.firestore> = firebaseConfigured
    ? admin.firestore()
    : (new Proxy({}, { get: () => notConfigured('Firestore') }) as any);
export default admin;
