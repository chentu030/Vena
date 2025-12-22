import { NextResponse } from 'next/server';

const SCOPUS_API_URL = 'https://api.elsevier.com/content/search/scopus';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q');
    const start = searchParams.get('start') || '0';
    const count = searchParams.get('count') || '10';

    if (!query) {
        return NextResponse.json({ error: 'Query parameter "q" is required' }, { status: 400 });
    }

    const apiKey = process.env.SCOPUS_API_KEY;
    const instToken = process.env.SCOPUS_INST_TOKEN;

    if (!apiKey) {
        return NextResponse.json({ error: 'Scopus API Key is missing' }, { status: 500 });
    }

    try {
        const headers: HeadersInit = {
            'X-ELS-APIKey': apiKey,
            'Accept': 'application/json'
        };

        if (instToken) {
            headers['X-ELS-Insttoken'] = instToken;
        }

        const response = await fetch(`${SCOPUS_API_URL}?query=${encodeURIComponent(query)}&count=${count}&start=${start}&httpAccept=application/json`, {
            headers: headers
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('Scopus API Error:', response.status, errorText);
            return NextResponse.json({ error: `Scopus API error: ${response.status}`, details: errorText }, { status: response.status });
        }

        const data = await response.json();
        return NextResponse.json(data);
    } catch (error) {
        console.error('Scopus Proxy Error:', error);
        return NextResponse.json({ error: 'Internal Server Error', details: String(error) }, { status: 500 });
    }
}
