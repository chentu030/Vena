import { NextResponse } from 'next/server';

const GAS_URL = process.env.NEXT_PUBLIC_GAS_URL;

// Google Apps Script 的有效負載限制約為 50MB
// Base64 編碼會增加 33% 的大小
// 為了安全，我們設定單個檔案的最大上傳大小為 35MB（編碼後約 47MB）
const MAX_SINGLE_UPLOAD_SIZE = 35 * 1024 * 1024;

export async function POST(request: Request) {
    if (!GAS_URL) {
        return NextResponse.json({ error: 'GAS URL not configured' }, { status: 500 });
    }

    try {
        const body = await request.json();

        // 檢查 fileContent 的大小（Base64 編碼後的大小）
        const base64Size = body.fileContent ? body.fileContent.length : 0;
        const estimatedOriginalSize = Math.floor(base64Size * 0.75); // Base64 解碼後的估計大小

        console.log(`Upload request: filename=${body.filename}, base64Size=${base64Size}, estimatedSize=${estimatedOriginalSize}`);

        // 如果檔案太大，返回錯誤並建議使用替代方案
        if (base64Size > MAX_SINGLE_UPLOAD_SIZE * 1.35) { // 考慮 base64 膨脹
            console.warn(`File too large for GAS upload: ${base64Size} bytes (base64)`);
            return NextResponse.json({
                error: 'File too large',
                message: `PDF 檔案大小超過限制 (${Math.round(estimatedOriginalSize / 1024 / 1024)}MB)。Google Apps Script 最大支援約 35MB 的檔案。建議使用較小的 PDF 或直接上傳到 Google Drive。`,
                maxSize: MAX_SINGLE_UPLOAD_SIZE,
                actualSize: estimatedOriginalSize
            }, { status: 413 });
        }

        // 設定較長的超時時間處理大檔案
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 120000); // 2 分鐘超時

        try {
            // 轉發請求到 GAS
            const response = await fetch(GAS_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(body),
                signal: controller.signal
            });

            clearTimeout(timeoutId);

            // 獲取回應文字
            const text = await response.text();

            console.log('GAS Response status:', response.status);
            console.log('GAS Response text (first 500 chars):', text.substring(0, 500));

            // 檢查是否是 HTML 回應（通常表示錯誤或重新導向）
            if (text.trim().startsWith('<!') || text.trim().startsWith('<html')) {
                console.error('GAS returned HTML instead of JSON - likely an auth/redirect issue');
                return NextResponse.json({
                    error: 'GAS authentication error',
                    message: 'Google Apps Script 返回了 HTML 頁面而非 JSON。這通常表示需要重新授權 GAS 或檔案太大。',
                    suggestion: '請確保 GAS Web App 設定為「任何人都可以存取」且已正確部署。',
                    raw: text.substring(0, 200)
                }, { status: 500 });
            }

            // 嘗試解析 JSON
            try {
                const result = JSON.parse(text);

                // 如果成功，確保返回正確的預覽 URL 格式
                if (result.status === 'success' && result.fileId) {
                    return NextResponse.json({
                        ...result,
                        // 確保提供可嵌入的預覽 URL
                        embedUrl: `https://drive.google.com/file/d/${result.fileId}/preview`,
                        previewUrl: `https://drive.google.com/file/d/${result.fileId}/preview`
                    });
                }

                return NextResponse.json(result);
            } catch (parseError) {
                console.error('Failed to parse GAS response as JSON:', text);
                return NextResponse.json({
                    error: 'Invalid GAS response',
                    raw: text
                }, { status: 500 });
            }
        } catch (fetchError: any) {
            clearTimeout(timeoutId);

            if (fetchError.name === 'AbortError') {
                return NextResponse.json({
                    error: 'Upload timeout',
                    message: '上傳超時。檔案可能太大或網路連線不穩定。'
                }, { status: 504 });
            }
            throw fetchError;
        }
    } catch (error) {
        console.error('GAS Proxy Error:', error);
        return NextResponse.json({
            error: 'Upload failed',
            details: String(error)
        }, { status: 500 });
    }
}
