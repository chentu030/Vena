'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { ChevronLeft, ChevronRight, ZoomIn, ZoomOut, Loader2, Download, ExternalLink, AlertCircle, RotateCw } from 'lucide-react';

interface PdfViewerProps {
    url: string;
    title?: string;
    onDownload?: () => void;
    fallbackUrl?: string;
}

const PdfViewer: React.FC<PdfViewerProps> = ({ url, title, onDownload, fallbackUrl }) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const renderTaskRef = useRef<any>(null);

    const [pdfDoc, setPdfDoc] = useState<any>(null);
    const [currentPage, setCurrentPage] = useState(1);
    const [totalPages, setTotalPages] = useState(0);
    const [scale, setScale] = useState(1.2);
    const [isLoading, setIsLoading] = useState(true);
    const [loadingProgress, setLoadingProgress] = useState(0);
    const [error, setError] = useState<string | null>(null);
    const [isRendering, setIsRendering] = useState(false);

    // 從 URL 提取 Google Drive fileId
    const getFileId = (driveUrl: string): string | null => {
        const fileMatch = driveUrl.match(/\/file\/d\/([^/]+)/) ||
            driveUrl.match(/[?&]id=([^&]+)/) ||
            driveUrl.match(/\/d\/([^/]+)/);
        return fileMatch ? fileMatch[1] : null;
    };

    // 獲取可下載的 URL
    const getDownloadUrl = (driveUrl: string): string => {
        const fileId = getFileId(driveUrl);
        if (fileId) {
            // 使用代理 API 來下載
            return `/api/download-pdf?fileId=${fileId}`;
        }
        return driveUrl;
    };

    // 載入 PDF
    const loadPdf = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        setLoadingProgress(0);

        try {
            // 動態導入 pdfjs-dist
            const pdfjsLib = await import('pdfjs-dist');

            // 設定 worker（使用 CDN）
            pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

            // 獲取下載 URL
            const downloadUrl = getDownloadUrl(url);

            console.log('Loading PDF from:', downloadUrl);

            // 載入 PDF 文件
            const loadingTask = pdfjsLib.getDocument({
                url: downloadUrl,
                // 允許跨域
                withCredentials: false,
            });

            // 監聽載入進度
            loadingTask.onProgress = (progress: { loaded: number; total: number }) => {
                if (progress.total > 0) {
                    const percent = Math.round((progress.loaded / progress.total) * 100);
                    setLoadingProgress(percent);
                }
            };

            const pdf = await loadingTask.promise;
            setPdfDoc(pdf);
            setTotalPages(pdf.numPages);
            setCurrentPage(1);
            console.log('PDF loaded successfully:', pdf.numPages, 'pages');

        } catch (err: any) {
            console.error('PDF load error:', err);

            // 根據錯誤類型顯示不同訊息
            if (err.message?.includes('Missing PDF') || err.message?.includes('Invalid PDF')) {
                setError('無法解析 PDF 檔案。檔案可能已損壞或不是有效的 PDF。');
            } else if (err.message?.includes('fetch') || err.message?.includes('network')) {
                setError('網路錯誤：無法下載 PDF。請檢查網路連接。');
            } else if (err.name === 'PasswordException') {
                setError('此 PDF 檔案受密碼保護。');
            } else {
                setError(`無法載入 PDF：${err.message || '未知錯誤'}`);
            }
        } finally {
            setIsLoading(false);
        }
    }, [url]);

    // 渲染頁面
    const renderPage = useCallback(async (pageNum: number) => {
        if (!pdfDoc || !canvasRef.current) return;

        // 取消之前的渲染任務
        if (renderTaskRef.current) {
            renderTaskRef.current.cancel();
        }

        setIsRendering(true);

        try {
            const page = await pdfDoc.getPage(pageNum);
            const canvas = canvasRef.current;
            const context = canvas.getContext('2d');

            if (!context) return;

            // 計算視口
            const viewport = page.getViewport({ scale });

            // 設定 canvas 尺寸（考慮設備像素比）
            const outputScale = window.devicePixelRatio || 1;
            canvas.width = Math.floor(viewport.width * outputScale);
            canvas.height = Math.floor(viewport.height * outputScale);
            canvas.style.width = `${viewport.width}px`;
            canvas.style.height = `${viewport.height}px`;

            context.scale(outputScale, outputScale);

            // 渲染頁面
            const renderContext = {
                canvasContext: context,
                viewport: viewport,
            };

            renderTaskRef.current = page.render(renderContext);
            await renderTaskRef.current.promise;

        } catch (err: any) {
            if (err.name !== 'RenderingCancelledException') {
                console.error('Render error:', err);
            }
        } finally {
            setIsRendering(false);
        }
    }, [pdfDoc, scale]);

    // 初始載入
    useEffect(() => {
        loadPdf();
    }, [loadPdf]);

    // 當 pdfDoc 或 currentPage 或 scale 改變時重新渲染
    useEffect(() => {
        if (pdfDoc) {
            renderPage(currentPage);
        }
    }, [pdfDoc, currentPage, scale, renderPage]);

    // 頁面導航
    const goToPrevPage = () => {
        if (currentPage > 1) setCurrentPage(currentPage - 1);
    };

    const goToNextPage = () => {
        if (currentPage < totalPages) setCurrentPage(currentPage + 1);
    };

    // 縮放控制
    const zoomIn = () => setScale(prev => Math.min(prev + 0.2, 3));
    const zoomOut = () => setScale(prev => Math.max(prev - 0.2, 0.5));

    // 重試載入
    const handleRetry = () => {
        loadPdf();
    };

    // 載入中狀態
    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center h-full bg-neutral-50 dark:bg-neutral-900 p-8">
                <Loader2 className="w-12 h-12 text-blue-600 animate-spin mb-4" />
                <p className="text-lg font-medium text-foreground mb-2">載入 PDF 中...</p>
                <p className="text-sm text-muted-foreground mb-4">
                    {loadingProgress > 0 ? `${loadingProgress}%` : '正在下載檔案...'}
                </p>
                {loadingProgress > 0 && (
                    <div className="w-64 h-2 bg-neutral-200 dark:bg-neutral-700 rounded-full overflow-hidden">
                        <div
                            className="h-full bg-blue-600 transition-all duration-300"
                            style={{ width: `${loadingProgress}%` }}
                        />
                    </div>
                )}
            </div>
        );
    }

    // 錯誤狀態
    if (error) {
        return (
            <div className="flex flex-col items-center justify-center h-full bg-neutral-50 dark:bg-neutral-900 p-8">
                <AlertCircle className="w-16 h-16 text-red-500 mb-4" />
                <p className="text-lg font-medium text-foreground mb-2">載入失敗</p>
                <p className="text-sm text-muted-foreground mb-6 text-center max-w-md">{error}</p>

                <div className="flex gap-3">
                    <button
                        onClick={handleRetry}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors flex items-center gap-2"
                    >
                        <RotateCw size={16} />
                        重試
                    </button>

                    {fallbackUrl && (
                        <a
                            href={fallbackUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-4 py-2 bg-white dark:bg-neutral-800 border border-border text-foreground rounded-lg text-sm font-medium hover:bg-neutral-50 dark:hover:bg-neutral-700 transition-colors flex items-center gap-2"
                        >
                            <ExternalLink size={16} />
                            在 Google Drive 開啟
                        </a>
                    )}
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full bg-neutral-100 dark:bg-neutral-900">
            {/* 工具列 */}
            <div className="flex items-center justify-between px-4 py-2 bg-white dark:bg-neutral-800 border-b border-border shrink-0">
                {/* 頁面導航 */}
                <div className="flex items-center gap-2">
                    <button
                        onClick={goToPrevPage}
                        disabled={currentPage <= 1}
                        className="p-1.5 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                        <ChevronLeft size={18} />
                    </button>
                    <span className="text-sm font-medium min-w-[80px] text-center">
                        {currentPage} / {totalPages}
                    </span>
                    <button
                        onClick={goToNextPage}
                        disabled={currentPage >= totalPages}
                        className="p-1.5 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                        <ChevronRight size={18} />
                    </button>
                </div>

                {/* 縮放控制 */}
                <div className="flex items-center gap-2">
                    <button
                        onClick={zoomOut}
                        disabled={scale <= 0.5}
                        className="p-1.5 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-700 disabled:opacity-50 transition-colors"
                    >
                        <ZoomOut size={18} />
                    </button>
                    <span className="text-sm font-medium min-w-[60px] text-center">
                        {Math.round(scale * 100)}%
                    </span>
                    <button
                        onClick={zoomIn}
                        disabled={scale >= 3}
                        className="p-1.5 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-700 disabled:opacity-50 transition-colors"
                    >
                        <ZoomIn size={18} />
                    </button>
                </div>

                {/* 下載按鈕 */}
                <div className="flex items-center gap-2">
                    {isRendering && (
                        <Loader2 className="w-4 h-4 text-blue-600 animate-spin" />
                    )}
                    {fallbackUrl && (
                        <a
                            href={fallbackUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1.5 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-colors"
                            title="在 Google Drive 開啟"
                        >
                            <ExternalLink size={18} />
                        </a>
                    )}
                </div>
            </div>

            {/* PDF 渲染區域 */}
            <div
                ref={containerRef}
                className="flex-1 overflow-auto flex items-start justify-center p-4"
            >
                <canvas
                    ref={canvasRef}
                    className="shadow-lg bg-white"
                />
            </div>
        </div>
    );
};

export default PdfViewer;
