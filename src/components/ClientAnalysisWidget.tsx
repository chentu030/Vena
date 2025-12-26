'use client';

import dynamic from 'next/dynamic';

const BackgroundAnalysisWidget = dynamic(
    () => import('@/components/BackgroundAnalysisWidget'),
    { ssr: false }
);

export default function ClientAnalysisWidget() {
    return <BackgroundAnalysisWidget />;
}
