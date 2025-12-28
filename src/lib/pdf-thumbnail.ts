'use client';

import * as pdfjs from 'pdfjs-dist';

// Configure worker
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

export interface ThumbnailResult {
    success: boolean;
    blob?: Blob;
    dataUrl?: string;
    error?: string;
}

/**
 * Generate a thumbnail from the first page of a PDF file
 * @param file PDF file or Blob
 * @param width Target width of thumbnail (height will be calculated to maintain aspect ratio)
 * @returns ThumbnailResult with blob and data URL
 */
export async function generatePdfThumbnail(
    file: File | Blob,
    width: number = 300
): Promise<ThumbnailResult> {
    try {
        // Convert File/Blob to ArrayBuffer
        const arrayBuffer = await file.arrayBuffer();

        // Load the PDF document
        const loadingTask = pdfjs.getDocument({ data: arrayBuffer });
        const pdfDocument = await loadingTask.promise;

        // Get the first page
        const page = await pdfDocument.getPage(1);

        // Calculate scale to achieve target width
        const viewport = page.getViewport({ scale: 1 });
        const scale = width / viewport.width;
        const scaledViewport = page.getViewport({ scale });

        // Create canvas
        const canvas = document.createElement('canvas');
        canvas.width = scaledViewport.width;
        canvas.height = scaledViewport.height;

        const context = canvas.getContext('2d');
        if (!context) {
            throw new Error('Failed to get canvas context');
        }

        // Fill white background (PDFs may have transparent backgrounds)
        context.fillStyle = '#FFFFFF';
        context.fillRect(0, 0, canvas.width, canvas.height);

        // Render PDF page to canvas
        const renderContext = {
            canvasContext: context,
            viewport: scaledViewport,
            canvas: canvas,
        };

        await page.render(renderContext).promise;

        // Convert canvas to Blob
        return new Promise((resolve) => {
            canvas.toBlob(
                (blob) => {
                    if (blob) {
                        const dataUrl = canvas.toDataURL('image/png', 0.9);
                        resolve({
                            success: true,
                            blob,
                            dataUrl,
                        });
                    } else {
                        resolve({
                            success: false,
                            error: 'Failed to create blob from canvas',
                        });
                    }
                },
                'image/png',
                0.9
            );
        });
    } catch (error: any) {
        console.error('PDF thumbnail generation error:', error);
        return {
            success: false,
            error: error.message || 'Unknown error',
        };
    }
}

/**
 * Check if a file is a PDF
 */
export function isPdfFile(file: File): boolean {
    return file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
}
