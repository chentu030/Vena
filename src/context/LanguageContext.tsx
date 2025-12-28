'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { translations, Language } from '@/locales';
import { useAuth } from '@/lib/auth';
import { getUserProfile } from '@/lib/firestore';

type LanguageContextType = {
    language: Language;
    setLanguage: (lang: Language) => void;
    t: (key: string, params?: Record<string, string | number>) => string;
};

const LanguageContext = createContext<LanguageContextType>({
    language: 'en',
    setLanguage: () => { },
    t: (key) => key,
});

export const useLanguage = () => useContext(LanguageContext);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
    const { user } = useAuth();
    const [language, setLanguageState] = useState<Language>('en'); // Default to English

    // Sync from User Profile on Load
    useEffect(() => {
        // 1. Always check local storage first for immediate UI consistency
        const stored = localStorage.getItem('venalium_language') as Language;
        if (stored) setLanguageState(stored);

        // 2. Then sync with user profile if logged in
        if (user) {
            getUserProfile(user.uid).then(profile => {
                if (profile && profile.language) {
                    // Start: Fix for overwrite issue
                    // Only use cloud profile if local storage is EMPTY.
                    // This prevents stale cloud data (e.g. user didn't click Save) from reverting local changes.
                    if (!stored) {
                        setLanguageState(profile.language);
                        localStorage.setItem('venalium_language', profile.language);
                    }
                    // End: Fix for overwrite issue
                }
            });
        }
    }, [user]);

    const setLanguage = (lang: Language) => {
        setLanguageState(lang);
        localStorage.setItem('venalium_language', lang);
        // Note: Firestore update happens in SettingsPage, but we could do it here too if we wanted global immediate save
    };

    // Translation function
    // Supports nested keys e.g. t('settings.profile.title')
    // Supports variable interpolation e.g. t('welcome', { name: 'John' }) -> "Welcome, John"
    const t = (key: string, params?: Record<string, string | number>): string => {
        const keys = key.split('.');
        let current: any = translations[language];
        let fallback: any = translations['en']; // Fallback to EN if missing

        for (const k of keys) {
            if (current && current[k] !== undefined) {
                current = current[k];
            } else {
                current = undefined;
            }

            if (fallback && fallback[k] !== undefined) {
                fallback = fallback[k];
            } else {
                fallback = undefined;
            }
        }

        let result = current || fallback || key;

        // Perform interpolation if params provided
        if (params && typeof result === 'string') {
            Object.entries(params).forEach(([paramKey, paramValue]) => {
                result = result.replace(new RegExp(`{${paramKey}}`, 'g'), String(paramValue));
            });
        }

        return result;
    };

    return (
        <LanguageContext.Provider value={{ language, setLanguage, t }}>
            {children}
        </LanguageContext.Provider>
    );
}
