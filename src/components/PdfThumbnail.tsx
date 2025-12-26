'use client';

import React, { useState } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import { FileText, Loader2 } from 'lucide-react';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';

// Configure worker locally
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

interface PdfThumbnailProps {
    url: string;
    width?: number;
}

export default function PdfThumbnail({ url, width = 200 }: PdfThumbnailProps) {
    const [numPages, setNumPages] = useState<number | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);

    // Check if it's a Google Drive URL
    const getDriveId = (link: string) => {
        const patterns = [
            /id=([^&]+)/,
            /\/d\/([^/]+)/,
            /\/file\/d\/([^/]+)/
        ];
        for (const pattern of patterns) {
            const match = link.match(pattern);
            if (match) return match[1];
        }
        return null;
    };

    const driveId = getDriveId(url);

    // If it's a drive file, try using Google's thumbnail service first
    if (driveId) {
        const thumbnailUrl = `https://drive.google.com/thumbnail?id=${driveId}&sz=w${width * 2}`; // Double width for retina

        return (
            <div className="w-full h-full relative overflow-hidden bg-white flex items-center justify-center">
                <img
                    src={thumbnailUrl}
                    alt="Preview"
                    className="w-full h-full object-cover"
                    onError={(e) => {
                        // If thumbnail fails, maybe try fallback or just show icon
                        e.currentTarget.style.display = 'none';
                        setError(true);
                    }}
                />
                {error && (
                    <div className="flex flex-col items-center justify-center text-red-300">
                        <FileText size={32} />
                    </div>
                )}
            </div>
        );
    }

    function onDocumentLoadSuccess({ numPages }: { numPages: number }) {
        setNumPages(numPages);
        setLoading(false);
    }

    function onDocumentLoadError() {
        setError(true);
        setLoading(false);
    }

    if (error) {
        return (
            <div className="w-full h-full flex flex-col items-center justify-center bg-red-50 dark:bg-red-900/10 text-red-400">
                <FileText size={32} className="mb-2 opacity-50" />
                <span className="text-[10px]">Preview Failed</span>
            </div>
        );
    }

    return (
        <div className="w-full h-full relative overflow-hidden bg-white">
            {loading && (
                <div className="absolute inset-0 flex items-center justify-center bg-gray-100 z-10">
                    <Loader2 className="animate-spin text-gray-400" size={20} />
                </div>
            )}

            <Document
                file={url}
                onLoadSuccess={onDocumentLoadSuccess}
                onLoadError={onDocumentLoadError}
                className="w-full h-full flex items-center justify-center"
                loading={
                    <div className="w-full h-full flex items-center justify-center bg-gray-50">
                        <Loader2 className="animate-spin text-gray-400" size={20} />
                    </div>
                }
            >
                <Page
                    pageNumber={1}
                    width={width}
                    renderTextLayer={false}
                    renderAnnotationLayer={false}
                    className="shadow-sm"
                />
            </Document>
        </div>
    );
}
