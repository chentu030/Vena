import { initializeApp, getApps, getApp, FirebaseApp } from "firebase/app";
import { getStorage, FirebaseStorage } from "firebase/storage";

// 儲存專用的 Firebase 設定（從環境變數讀取，方便未來更換）
const storageFirebaseConfig = {
    apiKey: process.env.NEXT_PUBLIC_STORAGE_FIREBASE_API_KEY || "AIzaSyCElSZaGp-Afiir1GRTI6hVh-RooZwksxc",
    authDomain: process.env.NEXT_PUBLIC_STORAGE_FIREBASE_AUTH_DOMAIN || "vena-storage.firebaseapp.com",
    projectId: process.env.NEXT_PUBLIC_STORAGE_FIREBASE_PROJECT_ID || "vena-storage",
    storageBucket: process.env.NEXT_PUBLIC_STORAGE_FIREBASE_STORAGE_BUCKET || "vena-storage.firebasestorage.app",
    messagingSenderId: process.env.NEXT_PUBLIC_STORAGE_FIREBASE_MESSAGING_SENDER_ID || "563996054146",
    appId: process.env.NEXT_PUBLIC_STORAGE_FIREBASE_APP_ID || "1:563996054146:web:c56b0f75762ad4f85c5a9b",
};

// 使用 Singleton 模式初始化儲存專用的 Firebase App
let storageApp: FirebaseApp | null = null;
let pdfStorage: FirebaseStorage | null = null;

function getStorageApp(): FirebaseApp {
    if (!storageApp) {
        // 檢查是否已經有同名的 app
        const existingApps = getApps();
        const existingStorageApp = existingApps.find(app => app.name === 'storage');

        if (existingStorageApp) {
            storageApp = existingStorageApp;
        } else {
            // 初始化一個新的 Firebase App，專門用於儲存
            storageApp = initializeApp(storageFirebaseConfig, 'storage');
        }
    }
    return storageApp;
}

/**
 * 獲取 PDF 儲存用的 Firebase Storage 實例
 */
export function getPdfStorage(): FirebaseStorage {
    if (!pdfStorage) {
        const app = getStorageApp();
        pdfStorage = getStorage(app);
    }
    return pdfStorage;
}

/**
 * 獲取儲存 Firebase 的設定資訊（用於顯示或調試）
 */
export function getStorageConfig() {
    return {
        projectId: storageFirebaseConfig.projectId,
        storageBucket: storageFirebaseConfig.storageBucket,
    };
}
