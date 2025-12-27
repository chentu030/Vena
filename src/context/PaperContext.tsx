'use client';

import React, { createContext, useContext } from 'react';

export interface SimplePaper {
    id?: string;
    title: string;
    doi?: string;
    authors?: string;
    year?: string;
    abstract?: string;
}

interface PaperContextType {
    papers: SimplePaper[];
}

const PaperContext = createContext<PaperContextType>({ papers: [] });

export const PaperProvider = PaperContext.Provider;

export function usePapers() {
    return useContext(PaperContext);
}
