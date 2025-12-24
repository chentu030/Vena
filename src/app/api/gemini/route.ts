import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

const API_KEY = process.env.NEXT_PUBLIC_GEMINI_API_KEY || '';
const genAI = new GoogleGenerativeAI(API_KEY);

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { model = 'gemini-3-flash-preview', prompt, history, task } = body;

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
        return NextResponse.json({ error: 'Internal Server Error', details: String(error) }, { status: 500 });
    }
}
