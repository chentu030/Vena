import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

// Try server-side env first, then fallback to NEXT_PUBLIC_ variant
const API_KEY = process.env.GEMINI_API_KEY || process.env.NEXT_PUBLIC_GEMINI_API_KEY || '';

export async function POST(request: Request) {
    // Validate API key is present
    if (!API_KEY) {
        console.error("Gemini API Error: API key is not configured.");
        return NextResponse.json({
            error: 'API key not configured',
            details: 'GEMINI_API_KEY or NEXT_PUBLIC_GEMINI_API_KEY environment variable is missing.'
        }, { status: 500 });
    }

    const genAI = new GoogleGenerativeAI(API_KEY);

    try {
        const body = await request.json();
        const { model = 'gemini-2.5-flash', prompt, history, task } = body;

        if (!prompt) {
            return NextResponse.json({ error: 'Prompt is required' }, { status: 400 });
        }

        const generativeModel = genAI.getGenerativeModel({ model });

        if (task === 'chat') {
            const chat = generativeModel.startChat({
                history: history || [],
            });
            const result = await chat.sendMessage(prompt);
            const response = await result.response;
            return NextResponse.json({ text: response.text() });
        } else {
            // Default single prompt mode (summary, mindmap, etc.)
            const result = await generativeModel.generateContent(prompt);
            const response = await result.response;
            return NextResponse.json({ text: response.text() });
        }

    } catch (error) {
        console.error("Gemini API Error:", error);
        const errorMessage = error instanceof Error ? error.message : String(error);
        return NextResponse.json({
            error: 'Gemini API Error',
            details: errorMessage
        }, { status: 500 });
    }
}
