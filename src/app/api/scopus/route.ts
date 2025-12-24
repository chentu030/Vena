import { NextResponse } from 'next/server';

const SCOPUS_API_URL = 'https://api.elsevier.com/content/search/scopus';

// API Key rotation index (in-memory, resets on server restart)
let currentKeyIndex = 0;

// Get all API keys from environment
function getApiKeys(): string[] {
    const keys: string[] = [];
    // Support both single key and multiple keys
    if (process.env.SCOPUS_API_KEY) {
        keys.push(process.env.SCOPUS_API_KEY);
    }
    // Support comma-separated keys in SCOPUS_API_KEYS
    if (process.env.SCOPUS_API_KEYS) {
        const multiKeys = process.env.SCOPUS_API_KEYS.split(',').map(k => k.trim()).filter(k => k);
        keys.push(...multiKeys);
    }
    return keys;
}

// Get next API key (round-robin)
function getNextApiKey(keys: string[]): string {
    if (keys.length === 0) return '';
    const key = keys[currentKeyIndex];
    currentKeyIndex = (currentKeyIndex + 1) % keys.length;
    return key;
}

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q');
    const start = searchParams.get('start') || '0';
    const count = searchParams.get('count') || '10';

    if (!query) {
        return NextResponse.json({ error: 'Query parameter "q" is required' }, { status: 400 });
    }

    const apiKeys = getApiKeys();
    const instToken = process.env.SCOPUS_INST_TOKEN;

    if (apiKeys.length === 0) {
        return NextResponse.json({ error: 'Scopus API Key is missing' }, { status: 500 });
    }

    // Try each key until one works (handles rate limits)
    let lastError: any = null;
    for (let attempt = 0; attempt < apiKeys.length; attempt++) {
        const apiKey = getNextApiKey(apiKeys);

        try {
            const headers: HeadersInit = {
                'X-ELS-APIKey': apiKey,
                'Accept': 'application/json'
            };

            if (instToken) {
                headers['X-ELS-Insttoken'] = instToken;
            }

            const response = await fetch(`${SCOPUS_API_URL}?query=${encodeURIComponent(query)}&count=${count}&start=${start}&sort=relevancy&httpAccept=application/json&view=STANDARD`, {
                headers: headers
            });

            // Check if rate limited (429) or quota exceeded (400 with specific error)
            if (response.status === 429 || response.status === 400) {
                const errorText = await response.text();
                console.warn(`Scopus API Key ${attempt + 1}/${apiKeys.length} failed (${response.status}), trying next...`);
                lastError = { status: response.status, text: errorText };
                continue; // Try next key
            }

            if (!response.ok) {
                const errorText = await response.text();
                console.error('Scopus API Error:', response.status, errorText);
                return NextResponse.json({ error: `Scopus API error: ${response.status}`, details: errorText }, { status: response.status });
            }

            const data = await response.json();
            console.log(`Scopus request succeeded with key ${currentKeyIndex === 0 ? apiKeys.length : currentKeyIndex}/${apiKeys.length}`);
            return NextResponse.json(data);
        } catch (error) {
            console.error('Scopus Proxy Error:', error);
            lastError = error;
            continue; // Try next key on network errors too
        }
    }

    // All keys exhausted
    console.error('All Scopus API keys exhausted. Last error:', lastError);
    return NextResponse.json({
        error: 'All API keys rate limited or failed',
        details: lastError?.text || String(lastError)
    }, { status: 429 });
}
