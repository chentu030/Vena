
import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
    try {
        const { url } = await req.json();

        if (!url) {
            return NextResponse.json({ error: 'Missing URL' }, { status: 400 });
        }

        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            }
        });

        if (!response.ok) {
            return NextResponse.json({ error: `Failed to fetch PDF: ${response.statusText}` }, { status: response.status });
        }

        const contentType = response.headers.get('content-type') || 'application/pdf';

        // Smart Handling: If it's HTML, try to find a PDF link inside (e.g. citation_pdf_url)
        if (contentType.includes('text/html')) {
            const htmlText = await response.text();

            // Look for standard academic meta tag
            const match = htmlText.match(/<meta\s+name="citation_pdf_url"\s+content="([^"]+)"/i);
            if (match && match[1]) {
                const pdfUrl = match[1];
                console.log(`Found PDF in meta tag: ${pdfUrl} (from ${url})`);

                // Recursive fetch (one level deep)
                const pdfResponse = await fetch(pdfUrl, {
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
                    }
                });

                if (pdfResponse.ok) {
                    const pdfContentType = pdfResponse.headers.get('content-type') || '';
                    if (pdfContentType.includes('application/pdf')) {
                        const arrayBuffer = await pdfResponse.arrayBuffer();
                        const buffer = Buffer.from(arrayBuffer);
                        return new NextResponse(buffer, {
                            headers: {
                                'Content-Type': 'application/pdf',
                                'Content-Disposition': 'attachment; filename="document.pdf"'
                            }
                        });
                    }
                }
            }

            return NextResponse.json({ error: 'URL returned HTML and no direct PDF meta link found' }, { status: 400 });
        }

        const arrayBuffer = await response.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        return new NextResponse(buffer, {
            headers: {
                'Content-Type': contentType,
                'Content-Disposition': 'attachment; filename="document.pdf"'
            }
        });

    } catch (error: any) {
        console.error('PDF Download Proxy Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
