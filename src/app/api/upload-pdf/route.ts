import { NextResponse } from 'next/server';

const GAS_URL = process.env.NEXT_PUBLIC_GAS_URL;

// 分塊大小：30MB（Base64 後約 40MB，在 GAS 50MB 限制內）
const CHUNK_SIZE = 30 * 1024 * 1024;
// 單次上傳的最大檔案大小（不分塊）：30MB
const MAX_SINGLE_UPLOAD_SIZE = 30 * 1024 * 1024;

/**
 * 生成唯一上傳 ID
 */
function generateUploadId(): string {
    return `upload_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
}

/**
 * 發送請求到 GAS
 */
async function sendToGAS(body: any, timeout = 120000): Promise<any> {
    if (!GAS_URL) {
        throw new Error('GAS URL not configured');
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
        const response = await fetch(GAS_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
            signal: controller.signal,
        });

        clearTimeout(timeoutId);
        const text = await response.text();

        // 檢查是否返回 HTML（錯誤）
        if (text.trim().startsWith('<!') || text.trim().startsWith('<html')) {
            console.error('GAS returned HTML:', text.substring(0, 200));
            throw new Error('GAS returned HTML instead of JSON - check permissions and deployment');
        }

        return JSON.parse(text);
    } finally {
        clearTimeout(timeoutId);
    }
}

/**
 * 分塊上傳大檔案
 */
async function uploadInChunks(
    filename: string,
    mimeType: string,
    base64Content: string,
    parentId?: string
): Promise<any> {
    const uploadId = generateUploadId();
    const totalBytes = base64Content.length;

    // 計算分塊數量（基於 base64 內容）
    // 每個分塊的 base64 大小約為 CHUNK_SIZE * 1.33
    const base64ChunkSize = Math.floor(CHUNK_SIZE * 1.33);
    const totalChunks = Math.ceil(totalBytes / base64ChunkSize);

    console.log(`Starting chunked upload: ${filename}`);
    console.log(`Total size: ${Math.round(totalBytes / 1024 / 1024)}MB, Chunks: ${totalChunks}`);

    // 上傳每個分塊
    for (let i = 0; i < totalChunks; i++) {
        const start = i * base64ChunkSize;
        const end = Math.min(start + base64ChunkSize, totalBytes);
        const chunkData = base64Content.substring(start, end);

        console.log(`Uploading chunk ${i + 1}/${totalChunks}...`);

        const chunkResult = await sendToGAS({
            action: 'upload_chunk',
            uploadId: uploadId,
            chunkIndex: i,
            totalChunks: totalChunks,
            chunkData: chunkData,
            filename: filename,
            mimeType: mimeType,
            parentId: parentId,
        });

        if (chunkResult.status !== 'success') {
            throw new Error(`Chunk ${i} upload failed: ${chunkResult.message}`);
        }
    }

    // 通知 GAS 合併所有分塊
    console.log('Finalizing upload...');
    const finalResult = await sendToGAS({
        action: 'finalize_upload',
        uploadId: uploadId,
    }, 300000); // 5 分鐘超時用於合併

    return finalResult;
}

export async function POST(request: Request) {
    if (!GAS_URL) {
        return NextResponse.json({ error: 'GAS URL not configured' }, { status: 500 });
    }

    try {
        const body = await request.json();
        const { filename, mimeType, fileContent, parentId, action } = body;

        // 計算檔案大小
        const base64Size = fileContent?.length || 0;
        const estimatedSize = Math.floor(base64Size * 0.75);

        console.log(`Upload request: filename=${filename}, size=${Math.round(estimatedSize / 1024 / 1024)}MB`);

        // 決定使用單次上傳還是分塊上傳
        if (estimatedSize <= MAX_SINGLE_UPLOAD_SIZE) {
            // 小檔案：直接上傳
            console.log('Using single upload...');
            const result = await sendToGAS(body);

            if (result.status === 'success' && result.fileId) {
                return NextResponse.json({
                    ...result,
                    embedUrl: result.embedUrl || `https://drive.google.com/file/d/${result.fileId}/preview`,
                    previewUrl: result.previewUrl || `https://drive.google.com/file/d/${result.fileId}/preview`,
                    method: 'gas-single',
                });
            }

            return NextResponse.json(result);
        } else {
            // 大檔案：分塊上傳
            console.log('Using chunked upload...');
            const result = await uploadInChunks(filename, mimeType, fileContent, parentId);

            if (result.status === 'success') {
                return NextResponse.json({
                    ...result,
                    method: 'gas-chunked',
                });
            }

            return NextResponse.json(result, { status: 500 });
        }

    } catch (error: any) {
        console.error('Upload error:', error);
        return NextResponse.json({
            error: 'Upload failed',
            message: error.message || String(error),
        }, { status: 500 });
    }
}
