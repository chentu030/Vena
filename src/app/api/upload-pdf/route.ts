import { NextResponse } from 'next/server';

const GAS_URL = process.env.NEXT_PUBLIC_GAS_URL;

// 分塊大小：2MB（Base64 後約 2.67MB，安全在大多數限制內）
const CHUNK_SIZE = 2 * 1024 * 1024;

export async function POST(request: Request) {
    if (!GAS_URL) {
        return NextResponse.json({ error: 'GAS URL not configured' }, { status: 500 });
    }

    try {
        const body = await request.json();

        // 檢查是否為分塊上傳
        if (body.action === 'chunked-upload') {
            return handleChunkedUpload(body);
        }

        // 檢查是否為初始化分塊上傳
        if (body.action === 'init-chunked-upload') {
            return handleInitChunkedUpload(body);
        }

        // 檢查是否為完成分塊上傳
        if (body.action === 'complete-chunked-upload') {
            return handleCompleteChunkedUpload(body);
        }

        // 原有的單次上傳邏輯
        const response = await fetch(GAS_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(body),
        });

        const text = await response.text();

        try {
            const data = JSON.parse(text);
            return NextResponse.json(data);
        } catch {
            return NextResponse.json({
                status: 'success',
                url: `https://drive.google.com/drive/search?q=${encodeURIComponent(body.filename || 'uploaded')}`,
                raw: text
            });
        }
    } catch (error) {
        console.error('GAS Proxy Error:', error);
        return NextResponse.json({
            error: 'Upload failed',
            details: String(error)
        }, { status: 500 });
    }
}

// 初始化分塊上傳 - 在 GAS 上建立空檔案
async function handleInitChunkedUpload(body: any) {
    try {
        const response = await fetch(GAS_URL!, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                action: 'init-chunked-upload',
                filename: body.filename,
                mimeType: body.mimeType,
                parentId: body.parentId,
                totalChunks: body.totalChunks,
                totalSize: body.totalSize
            }),
        });

        const text = await response.text();
        try {
            return NextResponse.json(JSON.parse(text));
        } catch {
            // 如果 GAS 不支援分塊上傳，返回 sessionId 讓前端處理
            return NextResponse.json({
                status: 'initialized',
                sessionId: `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                message: 'Chunked upload initialized (client-side accumulation)'
            });
        }
    } catch (error) {
        return NextResponse.json({ error: 'Init failed', details: String(error) }, { status: 500 });
    }
}

// 處理分塊上傳 - 發送單個分塊
async function handleChunkedUpload(body: any) {
    try {
        const response = await fetch(GAS_URL!, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                action: 'chunked-upload',
                sessionId: body.sessionId,
                chunkIndex: body.chunkIndex,
                chunkData: body.chunkData,
                filename: body.filename,
                parentId: body.parentId
            }),
        });

        const text = await response.text();
        try {
            return NextResponse.json(JSON.parse(text));
        } catch {
            return NextResponse.json({
                status: 'chunk-received',
                chunkIndex: body.chunkIndex
            });
        }
    } catch (error) {
        return NextResponse.json({ error: 'Chunk upload failed', details: String(error) }, { status: 500 });
    }
}

// 完成分塊上傳 - 合併所有分塊或直接上傳累積的資料
async function handleCompleteChunkedUpload(body: any) {
    try {
        // 如果有完整的 fileContent（前端累積），直接上傳
        if (body.fileContent) {
            const response = await fetch(GAS_URL!, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'upload',
                    filename: body.filename,
                    mimeType: body.mimeType,
                    fileContent: body.fileContent,
                    parentId: body.parentId
                }),
            });

            const text = await response.text();
            try {
                const data = JSON.parse(text);
                return NextResponse.json(data);
            } catch {
                return NextResponse.json({
                    status: 'success',
                    url: `https://drive.google.com/drive/search?q=${encodeURIComponent(body.filename || 'uploaded')}`,
                    raw: text
                });
            }
        }

        // 通知 GAS 合併分塊
        const response = await fetch(GAS_URL!, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                action: 'complete-chunked-upload',
                sessionId: body.sessionId,
                filename: body.filename,
                mimeType: body.mimeType,
                parentId: body.parentId
            }),
        });

        const text = await response.text();
        try {
            return NextResponse.json(JSON.parse(text));
        } catch {
            return NextResponse.json({
                status: 'success',
                url: `https://drive.google.com/drive/search?q=${encodeURIComponent(body.filename || 'uploaded')}`,
                raw: text
            });
        }
    } catch (error) {
        return NextResponse.json({ error: 'Complete failed', details: String(error) }, { status: 500 });
    }
}
