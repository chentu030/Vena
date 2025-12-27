
import { NextRequest, NextResponse } from 'next/server';

// GET 方法：用於 PDF.js 直接載入（通過 URL 參數）
export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const fileId = searchParams.get('fileId');
    const url = searchParams.get('url');

    if (!fileId && !url) {
        return NextResponse.json({ error: 'Missing fileId or url parameter' }, { status: 400 });
    }

    try {
        let downloadUrl: string;

        if (fileId) {
            // Google Drive 直接下載連結
            downloadUrl = `https://drive.google.com/uc?export=download&id=${fileId}&confirm=t`;
        } else {
            downloadUrl = url!;
        }

        console.log('[PDF Proxy GET] Downloading from:', downloadUrl);

        // 發送請求到 Google Drive
        const response = await fetch(downloadUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            },
            redirect: 'follow',
        });

        if (!response.ok) {
            console.error('[PDF Proxy GET] Download failed:', response.status);
            return NextResponse.json({ error: `Failed to download: ${response.status}` }, { status: response.status });
        }

        const contentType = response.headers.get('content-type') || '';

        // 檢查是否收到 HTML（可能是登入頁面或病毒掃描警告）
        if (contentType.includes('text/html')) {
            const html = await response.text();

            // 嘗試從 HTML 中提取確認下載連結（處理大檔案警告）
            const confirmMatch = html.match(/href="(\/uc\?export=download[^"]+)"/) ||
                html.match(/action="([^"]*)".*id="download-form/);

            if (confirmMatch && fileId) {
                const confirmPath = confirmMatch[1].replace(/&amp;/g, '&');
                const confirmUrl = confirmPath.startsWith('http')
                    ? confirmPath
                    : `https://drive.google.com${confirmPath}`;

                console.log('[PDF Proxy GET] Retrying with confirm URL');

                const retryResponse = await fetch(confirmUrl, {
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                        'Cookie': response.headers.get('set-cookie') || '',
                    },
                    redirect: 'follow',
                });

                if (retryResponse.ok) {
                    const retryContentType = retryResponse.headers.get('content-type') || '';
                    if (!retryContentType.includes('text/html')) {
                        const pdfData = await retryResponse.arrayBuffer();
                        const buffer = Buffer.from(pdfData);

                        // 驗證 PDF 魔術數字
                        const head = buffer.subarray(0, 5).toString('utf-8');
                        if (head.startsWith('%PDF-')) {
                            return new NextResponse(buffer, {
                                headers: {
                                    'Content-Type': 'application/pdf',
                                    'Content-Disposition': 'inline',
                                    'Cache-Control': 'public, max-age=3600',
                                    'Access-Control-Allow-Origin': '*',
                                },
                            });
                        }
                    }
                }
            }

            console.error('[PDF Proxy GET] Received HTML instead of PDF');
            return NextResponse.json(
                { error: 'File requires Google authentication. Please try opening in Google Drive.' },
                { status: 403 }
            );
        }

        // 獲取 PDF 數據
        const pdfData = await response.arrayBuffer();
        const buffer = Buffer.from(pdfData);

        // 驗證 PDF 魔術數字
        const head = buffer.subarray(0, 5).toString('utf-8');
        if (!head.startsWith('%PDF-')) {
            console.error('[PDF Proxy GET] Invalid PDF magic bytes:', head);
            return NextResponse.json({ error: 'Downloaded file is not a valid PDF' }, { status: 400 });
        }

        return new NextResponse(buffer, {
            headers: {
                'Content-Type': 'application/pdf',
                'Content-Disposition': 'inline',
                'Cache-Control': 'public, max-age=3600',
                'Access-Control-Allow-Origin': '*',
            },
        });

    } catch (error: any) {
        console.error('[PDF Proxy GET] Error:', error);
        return NextResponse.json({ error: `Download failed: ${error.message}` }, { status: 500 });
    }
}


export async function POST(req: NextRequest) {
    try {
        const { url } = await req.json();

        if (!url) {
            return NextResponse.json({ error: 'Missing URL' }, { status: 400 });
        }

        // Helper to fetch with browser headers
        const fetchWithHeaders = async (targetUrl: string) => {
            const controller = new AbortController();
            const id = setTimeout(() => controller.abort(), 15000); // 15s timeout

            try {
                const response = await fetch(targetUrl, {
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                        'Accept-Language': 'en-US,en;q=0.5'
                    },
                    redirect: 'follow',
                    signal: controller.signal
                });
                return response;
            } finally {
                clearTimeout(id);
            }
        };

        // Recursive crawler function
        const crawlForPdf = async (targetUrl: string, depth: number): Promise<Response | null> => {
            if (depth > 2) return null; // Max 2 hops (Landing -> Intermediate -> PDF)

            console.log(`[PDF Proxy] Crawling (Depth ${depth}): ${targetUrl}`);

            try {
                const response = await fetchWithHeaders(targetUrl);
                if (!response.ok) return null;

                const contentType = response.headers.get('content-type') || '';

                // Case 1: Direct PDF
                if (contentType.includes('application/pdf')) {
                    return response;
                }

                // Case 2: HTML Page -> Search for Links
                if (contentType.includes('text/html')) {
                    const htmlText = await response.text();

                    // Strategy A: Meta Tag (Highest Priority)
                    const metaMatch = htmlText.match(/<meta\s+name="citation_pdf_url"\s+content="([^"]+)"/i);
                    if (metaMatch && metaMatch[1]) {
                        console.log(`[PDF Proxy] Found Meta Tag: ${metaMatch[1]}`);
                        return crawlForPdf(metaMatch[1], depth + 1);
                    }

                    // Strategy B: "Download PDF" Buttons/Links
                    // Look for standard buttons: class="...download..." or text contains "PDF"
                    // Simple Regex to extract hrefs from <a> tags that look promising
                    // 1. href ends with .pdf
                    // 2. text contains "Download" or "PDF"

                    // Regex is tricky for HTML, but we parse simplistic patterns
                    const linkRegex = /<a[^>]+href="([^"]+)"[^>]*>(.*?)<\/a>/gi;
                    let match;
                    let bestCandidate = null;

                    while ((match = linkRegex.exec(htmlText)) !== null) {
                        const href = match[1];
                        const text = match[2].replace(/<[^>]+>/g, '').trim().toLowerCase(); // Strip tags from text
                        const hrefLower = href.toLowerCase();

                        // Heuristics
                        const isPdfFile = hrefLower.endsWith('.pdf');
                        const hasPdfText = text.includes('pdf') || text.includes('view') || text.includes('download');
                        const isDownloadAction = hrefLower.includes('download') || hrefLower.includes('view') || hrefLower.includes('fulltext');

                        // Resolve relative URLs
                        let absoluteUrl = href;
                        if (!href.startsWith('http')) {
                            try {
                                const baseUrl = new URL(targetUrl);
                                // Handle root relative vs path relative
                                if (href.startsWith('/')) {
                                    absoluteUrl = `${baseUrl.origin}${href}`;
                                } else {
                                    // Remove filename if present in path, keeps directory
                                    const path = baseUrl.pathname.endsWith('/') ? baseUrl.pathname : baseUrl.pathname.substring(0, baseUrl.pathname.lastIndexOf('/') + 1);
                                    absoluteUrl = `${baseUrl.origin}${path}${href}`;
                                }
                            } catch (e) { continue; }
                        }

                        if (isPdfFile) {
                            return crawlForPdf(absoluteUrl, depth + 1); // Immediate winner
                        }

                        if (hasPdfText && isDownloadAction && !bestCandidate) {
                            bestCandidate = absoluteUrl;
                        }
                    }

                    if (bestCandidate) {
                        console.log(`[PDF Proxy] Following best candidate link: ${bestCandidate}`);
                        return crawlForPdf(bestCandidate, depth + 1);
                    }
                }

                return null;
            } catch (e) {
                console.error(`[PDF Proxy] Error at depth ${depth}:`, e);
                return null;
            }
        };

        // Start Crawl
        const pdfResponse = await crawlForPdf(url, 0);

        if (pdfResponse) {
            const arrayBuffer = await pdfResponse.arrayBuffer();
            const buffer = Buffer.from(arrayBuffer);
            const contentType = pdfResponse.headers.get('content-type') || 'application/pdf';

            // Validate Magic Bytes
            // A valid PDF file starts with "%PDF-"
            const head = buffer.subarray(0, 5).toString('utf-8');
            if (!head.startsWith('%PDF-')) {
                console.warn(`[PDF Proxy] Invalid Magic Bytes: ${head}. Content-Type was ${contentType}. Rejecting.`);
                return NextResponse.json({ error: 'URL did not return a valid PDF file (invalid magic bytes)' }, { status: 400 });
            }

            return new NextResponse(buffer, {
                headers: {
                    'Content-Type': contentType,
                    'Content-Disposition': 'attachment; filename="document.pdf"'
                }
            });
        }

        return NextResponse.json({ error: 'Could not find a valid PDF after crawling' }, { status: 400 });

    } catch (error: any) {
        console.error('PDF Download Proxy Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
