"use client";

import React, { createContext, useContext, useState, useRef, useEffect, ReactNode } from 'react';
import { db } from '@/lib/firebase';
import { doc, getDoc, setDoc, Timestamp } from 'firebase/firestore';

interface ResearchArticle {
    id: string;
    sourceModel?: string;
    title: string;
    authors: string;
    source: string;
    year: string;
    doi: string;
    link: string;
    abstract: string;
    keywords: string;
    pages?: string;
    methodology?: string;
    pdfUrl?: string | null;
    pdfStatus?: 'searching' | 'failed' | 'success' | null;
}

interface AnalysisState {
    isAnalyzing: boolean;
    progress: {
        current: number;
        total: number;
        message: string;
    };
    currentArticleTitle?: string;
}

interface AnalysisContextType {
    state: AnalysisState;
    startAnalysis: (articles: ResearchArticle[], projectId: string, groupId: string, userId: string) => void;
    startCheckPdf: (articles: ResearchArticle[], projectId: string, groupId: string, userId: string, projectName: string, groupName: string, onArticleUpdate?: (article: ResearchArticle) => void) => void;
    cancelAnalysis: () => void;
    toggleWidget: () => void;
    closeWidget: () => void;
    isWidgetValues: { isOpen: boolean; };
}

const AnalysisContext = createContext<AnalysisContextType | undefined>(undefined);

export function AnalysisProvider({ children }: { children: ReactNode }) {
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [progress, setProgress] = useState({ current: 0, total: 0, message: '' });
    const [currentArticleTitle, setCurrentArticleTitle] = useState<string>('');
    const [isWidgetOpen, setIsWidgetOpen] = useState(true);

    const abortControllerRef = useRef<AbortController | null>(null);

    const startAnalysis = async (articles: ResearchArticle[], projectId: string, groupId: string, userId: string) => {
        if (isAnalyzing) return;

        setIsAnalyzing(true);
        setIsWidgetOpen(true);
        abortControllerRef.current = new AbortController();
        const signal = abortControllerRef.current.signal;

        // Filter unanalyzed or incomplete items
        // Condition: Abstract is valid description (not just "No abstract") OR missing methodology/pages
        // We only re-analyze explicitly if we want filling.
        // Logic from ResearchPanel:
        const toAnalyze = articles.map((a, i) => ({ a, i })).filter(({ a }) => {
            // Same logic: Check for "No abstract" or missing fields
            const isAbstractMissing = !a.abstract || a.abstract === 'No abstract available.' || a.abstract.length < 50;
            const isMethodologyMissing = !a.methodology;
            const isPagesMissing = !a.pages;
            // Also check if already analyzed by gemini-3-flash
            // But users might re-run. We assume if they click "Deep Analysis", they want to fill holes.
            return isAbstractMissing || isMethodologyMissing || isPagesMissing;
        });

        setProgress({ current: 0, total: toAnalyze.length, message: `Starting analysis for ${toAnalyze.length} papers...` });

        // Working copy
        const workingResults = [...articles];

        try {
            for (let idx = 0; idx < toAnalyze.length; idx++) {
                if (signal.aborted) throw new Error("Cancelled");

                const { a: article, i: originalIndex } = toAnalyze[idx];
                setCurrentArticleTitle(article.title);
                setProgress({
                    current: idx + 1,
                    total: toAnalyze.length,
                    message: `Analyzing ${idx + 1}/${toAnalyze.length}`
                });

                try {
                    // Prepare Prompt
                    const prompt = `You are an expert academic researcher.
                Please find the official publication page or PDF of this article to VERIFY all details.
                
                Article: "${article.title}" by ${article.authors} (${article.year})
                Source: ${article.source}
                DOI: ${article.doi}
                
                Task:
                1. Standardize "authors" (Last, F. M.).
                1. Standardize "authors" (Last, F. M.).
                2. Extract/Verify "year".
                3. Estimate "page count" if missing.
                4. Extract "keywords" (if missing, generate 5 relevant ones in English, comma separated).
                5. Summarize "abstract" in Traditional Chinese (繁體中文). Do NOT truncate field content.
                6. Identify "methodology" (e.g., Survey, Experiment) in Traditional Chinese if possible or English.
                7. Ensure NO fields use "..." ellipsis. Provide full text.
                
                Return JSON ONLY:
                {
                    "authors": "...",
                    "year": "...",
                    "pages": "...",
                    "keywords": "...",
                    "abstract": "...",
                    "methodology": "..."
                }`;



                    const res = await fetch('/api/gemini', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            model: 'gemini-3-flash-preview',
                            task: 'summary',
                            prompt: prompt,
                            history: [],
                            useGrounding: true
                        }),
                        signal
                    });

                    const data = await res.json();
                    if (data.text) {
                        const jsonStr = data.text.replace(/```json/g, '').replace(/```/g, '').trim();
                        const parsed = JSON.parse(jsonStr);

                        // Update Article
                        workingResults[originalIndex] = {
                            ...article,
                            authors: parsed.authors || article.authors,
                            year: parsed.year || article.year,
                            pages: (parsed.pages && parsed.pages !== 'N/A') ? parsed.pages : article.pages,
                            keywords: parsed.keywords || article.keywords,
                            abstract: parsed.abstract || article.abstract,
                            methodology: parsed.methodology || ''
                        };

                        // IMMEDIATE SAVE TO FIRESTORE
                        // Path: users/{userId}/projects/{projectId}/researchGroups/{groupId}
                        const groupRef = doc(db, `users/${userId}/projects/${projectId}/researchGroups`, groupId);

                        // We need to fetch the LATEST data to ensure we don't overwrite concurrent changes?
                        // Ideally, yes. But here we assume we own the array.
                        // For safety, let's just write the papers array.
                        // Actually, the array is inside the document.
                        // But we can't update just one index of an array in Firestore easily without reading whole array or using obscure features.
                        // We will save the WHOLE array.
                        await setDoc(groupRef, { papers: workingResults, updatedAt: Timestamp.now() }, { merge: true });
                    }

                } catch (innerError: any) {
                    if (innerError.name === 'AbortError') throw innerError;
                    console.error(`Error analyzing paper ${originalIndex}:`, innerError);
                    // Continue to next even if one fails
                }
            }

            setProgress({ current: toAnalyze.length, total: toAnalyze.length, message: 'Analysis Complete!' });
        } catch (e: any) {
            if (e.message === 'Cancelled' || e.name === 'AbortError') {
                setProgress(prev => ({ ...prev, message: 'Analysis Cancelled' }));
            } else {
                console.error("Background Analysis Error", e);
                setProgress(prev => ({ ...prev, message: 'Error occurred' }));
            }
        } finally {
            setIsAnalyzing(false);
            setTimeout(() => {
                // Optional: Hide widget after delay?
                // setIsWidgetOpen(false);
            }, 5000);
        }
    };


    // Helper to interact with GAS API
    const callGasApi = async (data: any) => {
        const GAS_API_URL = "https://script.google.com/macros/s/AKfycbyeGIh0Dg7CKujV3HPDkx__DnyHrVrkiuqGnnow4YXhIQjA10aDifnDU9DntUFgwRTO/exec";

        // Use standard CORS request. GAS Web App must be set to "Anyone" access to handle CORS.
        const res = await fetch(GAS_API_URL, {
            method: 'POST',
            // mode: 'cors', // Default is cors
            headers: {
                'Content-Type': 'text/plain;charset=utf-8', // GAS sometimes prefers text/plain to avoid preflight issues
            },
            body: JSON.stringify(data)
        });

        const text = await res.text();
        try {
            return JSON.parse(text);
        } catch (e) {
            console.error("Failed to parse GAS response", text);
            throw new Error("Invalid GAS response");
        }
    };

    // We can't actually use `no-cors` if we want the ID back.
    // If the GAS script doesn't send CORS headers, we are stuck.
    // Assuming the user's script is set up correctly (since they provided it for this purpose).

    // BUT: The provided GAS code doesn't explicitly set CORS headers like "Access-Control-Allow-Origin". 
    // GAS ContentService usually handles it if "Execute as Me" and "Access: Anyone". 

    const startCheckPdf = async (articles: ResearchArticle[], projectId: string, groupId: string, userId: string, projectName: string, groupName: string, onArticleUpdate?: (article: ResearchArticle) => void) => {
        if (isAnalyzing) return;

        setIsAnalyzing(true);
        setIsWidgetOpen(true);
        abortControllerRef.current = new AbortController();
        const signal = abortControllerRef.current.signal;

        const toCheck = articles.filter(a => !a.pdfUrl && !a.link?.endsWith('.pdf'));

        // Initial Progress
        setProgress({ current: 0, total: toCheck.length, message: `Initializing Backup Folders...` });

        let projectFolderId = "";
        let groupFolderId = "";

        // 1. Check/Create Project Folder
        try {
            const projectRef = doc(db, `users/${userId}/projects`, projectId);
            const projectSnap = await getDoc(projectRef);
            if (projectSnap.exists()) {
                const pData = projectSnap.data();
                if (pData.driveFolderId) projectFolderId = pData.driveFolderId;
            }

            if (!projectFolderId) {
                // Create Project Folder under GAS ROOT
                const folderRes = await callGasApi({
                    action: "create_folder",
                    name: `Project: ${projectName || projectId}`
                });
                if (folderRes.status === "success" && folderRes.folderId) {
                    projectFolderId = folderRes.folderId;
                    // Save to Firestore
                    await setDoc(projectRef, { driveFolderId: projectFolderId }, { merge: true });
                }
            }
        } catch (e) {
            console.error("Error fetching/creating project folder", e);
        }

        // 2. Check/Create Group Folder (inside Project Folder)
        try {
            const groupRef = doc(db, `users/${userId}/projects/${projectId}/researchGroups`, groupId);
            const groupSnap = await getDoc(groupRef);
            if (groupSnap.exists()) {
                const gData = groupSnap.data();
                if (gData.driveFolderId) groupFolderId = gData.driveFolderId;
            }

            if (!groupFolderId) {
                // Create Group Folder INSIDE Project Folder
                const folderRes = await callGasApi({
                    action: "create_folder",
                    name: groupName || groupId,
                    parentId: projectFolderId || undefined // Use project folder as parent, or GAS root if none
                });
                if (folderRes.status === "success" && folderRes.folderId) {
                    groupFolderId = folderRes.folderId;
                    // Save to Firestore
                    await setDoc(groupRef, { driveFolderId: groupFolderId }, { merge: true });
                }
            }
        } catch (e) {
            console.error("Error fetching/creating group folder", e);
        }

        // Update Progress
        setProgress({ current: 0, total: toCheck.length, message: `Searching & Backing up ${toCheck.length} papers...` });

        const workingResults = [...articles];

        try {
            for (let idx = 0; idx < toCheck.length; idx++) {
                if (signal.aborted) throw new Error("Cancelled");

                const article = toCheck[idx];
                const originalIndex = workingResults.findIndex(r => r.id === article.id);

                setCurrentArticleTitle(article.title);
                setProgress({
                    current: idx + 1,
                    total: toCheck.length,
                    message: `Processing ${idx + 1}/${toCheck.length}: Finding PDF...`
                });

                try {
                    // 1. Find and Verify PDF (Try models sequentially)
                    let finalSuccess = false;
                    let searchModels = ['gemini-3-flash-preview'];

                    for (const model of searchModels) {
                        if (signal.aborted) break;
                        if (finalSuccess) break; // Already succeeded with a previous model

                        let directPdfUrl = null;

                        setProgress({
                            current: idx + 1,
                            total: toCheck.length,
                            message: `Processing ${idx + 1}/${toCheck.length}: Finding PDF (${model === 'gemini-2.5-flash' ? 'Fast' : 'Deep'})...`
                        });

                        const prompt = `Task: Find a direct PDF download link for this academic paper.
                        Paper: "${article.title}" by ${article.authors} (${article.year})
                        Instructions:
                        1. Use Google Search to find a PDF version.
                        2. Look for links ending in .pdf or from reputable repositories (ResearchGate, arXiv, University servers).
                        3. Return JSON ONLY: { "pdfUrl": "https://..." } or { "pdfUrl": null }`;

                        try {
                            const res = await fetch('/api/gemini', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                    model: model,
                                    task: 'summary',
                                    prompt: prompt,
                                    useGrounding: true
                                }),
                                signal
                            });

                            const data = await res.json();
                            if (data.text) {
                                const jsonStr = data.text.replace(/```json/g, '').replace(/```/g, '').trim();
                                const parsed = JSON.parse(jsonStr);
                                if (parsed.pdfUrl && parsed.pdfUrl.startsWith('http')) {
                                    directPdfUrl = parsed.pdfUrl;
                                }
                            }
                        } catch (e) {
                            console.log(`PDF Search failed with ${model}`, e);
                        }

                        if (directPdfUrl) {
                            // 2. Try to Download PDF Blob via Proxy to VERIFY it works
                            setProgress(prev => ({ ...prev, message: `Processing ${idx + 1}/${toCheck.length}: Verifying Download...` }));

                            try {
                                const blobRes = await fetch('/api/download-pdf', {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({ url: directPdfUrl }),
                                    signal
                                });

                                if (blobRes.ok) {
                                    const blob = await blobRes.blob();

                                    // 3. Upload to Drive via GAS
                                    setProgress(prev => ({ ...prev, message: `Processing ${idx + 1}/${toCheck.length}: Uploading to Drive...` }));

                                    // Convert blob to base64
                                    const reader = new FileReader();
                                    reader.readAsDataURL(blob);

                                    await new Promise((resolve, reject) => {
                                        reader.onloadend = async () => {
                                            try {
                                                const base64Content = (reader.result as string).split(',')[1];
                                                const uploadRes = await callGasApi({
                                                    action: "upload",
                                                    filename: `${article.title.substring(0, 50)}.pdf`,
                                                    mimeType: "application/pdf",
                                                    fileContent: base64Content,
                                                    parentId: groupFolderId
                                                });

                                                if (uploadRes.status === "success" && uploadRes.url) {
                                                    const driveUrl = uploadRes.url;
                                                    // Success: Update Article
                                                    const updatedArticle = { ...article, pdfUrl: driveUrl, pdfStatus: 'success' as const };
                                                    workingResults[originalIndex] = updatedArticle;
                                                    onArticleUpdate?.(updatedArticle);

                                                    const groupRef = doc(db, `users/${userId}/projects/${projectId}/researchGroups`, groupId);
                                                    await setDoc(groupRef, { papers: workingResults, updatedAt: Timestamp.now() }, { merge: true });
                                                    finalSuccess = true;
                                                    resolve(true);
                                                } else {
                                                    // Upload failed, but download worked. Keep direct link at least.
                                                    const updatedArticle = { ...article, pdfUrl: directPdfUrl, pdfStatus: 'success' as const };
                                                    workingResults[originalIndex] = updatedArticle;
                                                    onArticleUpdate?.(updatedArticle);

                                                    const groupRef = doc(db, `users/${userId}/projects/${projectId}/researchGroups`, groupId);
                                                    await setDoc(groupRef, { papers: workingResults, updatedAt: Timestamp.now() }, { merge: true });
                                                    finalSuccess = true;
                                                    resolve(true);
                                                }
                                            } catch (err) { reject(err); }
                                        };
                                        reader.onerror = reject;
                                    });
                                } else {
                                    // Download failed (404/403 etc)
                                    console.warn(`Proxy download failed (${blobRes.status}) for ${directPdfUrl}. Retrying next model...`);
                                    // Do NOT set finalSuccess = true.
                                    // Loop continues to next model.
                                }
                            } catch (downloadErr) {
                                console.warn(`Download error for ${directPdfUrl}`, downloadErr);
                                // Loop continues
                            }
                        }
                    }

                    if (!finalSuccess) {
                        // FAILED to find valid PDF after all models
                        const updatedArticle = { ...article, pdfStatus: 'failed' as const };
                        workingResults[originalIndex] = updatedArticle;
                        onArticleUpdate?.(updatedArticle);

                        const groupRef = doc(db, `users/${userId}/projects/${projectId}/researchGroups`, groupId);
                        await setDoc(groupRef, { papers: workingResults, updatedAt: Timestamp.now() }, { merge: true });
                    }

                } catch (innerError: any) {
                    if (innerError.name === 'AbortError') throw innerError;
                    console.error(`Error processing PDF for ${originalIndex}:`, innerError);
                }
            }
            setProgress({ current: toCheck.length, total: toCheck.length, message: 'PDF Backup Complete!' });
        } catch (e: any) {
            if (e.message === 'Cancelled' || e.name === 'AbortError') {
                setProgress(prev => ({ ...prev, message: 'Backup Cancelled' }));
            } else {
                console.error("PDF Backup Error", e);
                setProgress(prev => ({ ...prev, message: 'Error occurred' }));
            }
        } finally {
            setIsAnalyzing(false);
        }
    };

    const cancelAnalysis = () => {
        if (abortControllerRef.current) {
            abortControllerRef.current.abort('Operation cancelled by user');
        }
        setIsAnalyzing(false);
    };

    const toggleWidget = () => setIsWidgetOpen(!isWidgetOpen);

    const closeWidget = () => {
        setIsWidgetOpen(false);
        // Clearing the message will cause the widget to return null (hide)
        setProgress({ current: 0, total: 0, message: '' });
    };

    return (
        <AnalysisContext.Provider value={{
            state: { isAnalyzing, progress, currentArticleTitle },
            startAnalysis,
            startCheckPdf,
            cancelAnalysis,
            toggleWidget,
            closeWidget,
            isWidgetValues: { isOpen: isWidgetOpen }
        }}>
            {children}
        </AnalysisContext.Provider>
    );
}

export function useAnalysis() {
    const context = useContext(AnalysisContext);
    if (context === undefined) {
        throw new Error('useAnalysis must be used within an AnalysisProvider');
    }
    return context;
}
