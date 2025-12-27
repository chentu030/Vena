
import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
    try {
        const { url } = await req.json();

        if (!url) {
            return NextResponse.json({ error: 'Missing URL' }, { status: 400 });
        }

        // Helper to fetch with browser headers
        const fetchWithHeaders = async (targetUrl: string) => {
            return fetch(targetUrl, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                    'Accept-Language': 'en-US,en;q=0.5'
                },
                redirect: 'follow',
                signal: AbortSignal.timeout(15000) // 15s timeout
            });
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
