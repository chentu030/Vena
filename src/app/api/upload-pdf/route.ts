import { NextResponse } from 'next/server';

const GAS_URL = process.env.NEXT_PUBLIC_GAS_URL;

export async function POST(request: Request) {
    if (!GAS_URL) {
        return NextResponse.json({ error: 'GAS URL not configured' }, { status: 500 });
    }

    try {
        const body = await request.json();

        // Forward the request to GAS
        const response = await fetch(GAS_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(body),
        });

        // Get the response text first
        const text = await response.text();

        // Try to parse as JSON
        try {
            const data = JSON.parse(text);
            return NextResponse.json(data);
        } catch {
            // If not JSON, return as-is with context
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
