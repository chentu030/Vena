import { ref, uploadBytesResumable, getDownloadURL, UploadTask } from "firebase/storage";
import { getPdfStorage } from "./firebase-storage";

export interface UploadProgress {
    progress: number; // 0-100
    bytesTransferred: number;
    totalBytes: number;
    state: 'running' | 'paused' | 'success' | 'error' | 'canceled';
    downloadUrl?: string;
    error?: string;
}

export interface UploadResult {
    success: boolean;
    downloadUrl?: string;
    previewUrl?: string;
    embedUrl?: string;
    storagePath?: string;
    error?: string;
}

/**
 * 上傳 PDF 到 Firebase Storage
 * 支援大檔案、斷點續傳、進度回報
 */
export async function uploadPdfToFirebase(
    file: File | Blob,
    filename: string,
    projectId: string,
    groupId: string,
    onProgress?: (progress: UploadProgress) => void
): Promise<UploadResult> {
    try {
        const storage = getPdfStorage();

        // 建立存儲路徑：projects/{projectId}/groups/{groupId}/pdfs/{filename}
        const storagePath = `projects/${projectId}/groups/${groupId}/pdfs/${filename}`;
        const storageRef = ref(storage, storagePath);

        console.log(`Starting Firebase Storage upload: ${storagePath}`);
        console.log(`File size: ${Math.round((file.size || 0) / 1024 / 1024)}MB`);

        // 使用 resumable upload（支援大檔案和斷點續傳）
        const uploadTask = uploadBytesResumable(storageRef, file, {
            contentType: 'application/pdf',
            customMetadata: {
                projectId: projectId,
                groupId: groupId,
                uploadedAt: new Date().toISOString(),
            }
        });

        return new Promise((resolve, reject) => {
            uploadTask.on(
                'state_changed',
                (snapshot) => {
                    // 進度更新
                    const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;

                    if (onProgress) {
                        onProgress({
                            progress: Math.round(progress),
                            bytesTransferred: snapshot.bytesTransferred,
                            totalBytes: snapshot.totalBytes,
                            state: snapshot.state as any,
                        });
                    }

                    console.log(`Upload progress: ${Math.round(progress)}%`);
                },
                (error) => {
                    // 上傳失敗
                    console.error('Firebase Storage upload error:', error);

                    if (onProgress) {
                        onProgress({
                            progress: 0,
                            bytesTransferred: 0,
                            totalBytes: 0,
                            state: 'error',
                            error: error.message,
                        });
                    }

                    resolve({
                        success: false,
                        error: error.message,
                    });
                },
                async () => {
                    // 上傳成功
                    try {
                        const downloadUrl = await getDownloadURL(uploadTask.snapshot.ref);

                        console.log('Upload complete:', downloadUrl);

                        if (onProgress) {
                            onProgress({
                                progress: 100,
                                bytesTransferred: uploadTask.snapshot.totalBytes,
                                totalBytes: uploadTask.snapshot.totalBytes,
                                state: 'success',
                                downloadUrl: downloadUrl,
                            });
                        }

                        resolve({
                            success: true,
                            downloadUrl: downloadUrl,
                            previewUrl: downloadUrl, // Firebase Storage URL 可直接預覽
                            embedUrl: downloadUrl,
                            storagePath: storagePath,
                        });
                    } catch (urlError: any) {
                        console.error('Failed to get download URL:', urlError);
                        resolve({
                            success: false,
                            error: 'Failed to get download URL: ' + urlError.message,
                        });
                    }
                }
            );
        });
    } catch (error: any) {
        console.error('Upload initialization error:', error);
        return {
            success: false,
            error: error.message,
        };
    }
}

/**
 * 從 Base64 字串上傳 PDF
 */
export async function uploadBase64PdfToFirebase(
    base64Content: string,
    filename: string,
    projectId: string,
    groupId: string,
    onProgress?: (progress: UploadProgress) => void
): Promise<UploadResult> {
    try {
        // 將 Base64 轉換為 Blob
        const byteCharacters = atob(base64Content);
        const byteNumbers = new Array(byteCharacters.length);

        for (let i = 0; i < byteCharacters.length; i++) {
            byteNumbers[i] = byteCharacters.charCodeAt(i);
        }

        const byteArray = new Uint8Array(byteNumbers);
        const blob = new Blob([byteArray], { type: 'application/pdf' });

        return uploadPdfToFirebase(blob, filename, projectId, groupId, onProgress);
    } catch (error: any) {
        console.error('Base64 conversion error:', error);
        return {
            success: false,
            error: 'Failed to convert Base64: ' + error.message,
        };
    }
}
