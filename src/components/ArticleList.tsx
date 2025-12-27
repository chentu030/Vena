import React from 'react';
import { ExternalLink, Plus } from 'lucide-react';

export default function ArticleList({ articles, onAddToContext }: { articles: any[], onAddToContext: (a: any) => void }) {
    if (!articles || articles.length === 0) return null;

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {articles.map((article, index) => {
                // Normalize data access
                const title = article.title || article['dc:title'] || 'Untitled';
                const source = article.source || article['prism:publicationName'] || 'Unknown Source';
                const dateStr = article.year || article['prism:coverDate'];
                const year = dateStr ? (dateStr.length === 4 ? dateStr : new Date(dateStr).getFullYear()) : 'N/A';
                const doi = article.doi || article['prism:doi'];

                return (
                    <div key={index} className="group relative p-6 rounded-2xl border border-black/5 dark:border-white/5 bg-white/50 dark:bg-neutral-900/50 hover:bg-white dark:hover:bg-neutral-800 transition-all duration-300 hover:shadow-lg hover:shadow-black/5 hover:-translate-y-1">
                        <div className="mb-4">
                            <h4 className="font-serif font-medium text-lg leading-tight mb-2 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors line-clamp-2">
                                {title}
                            </h4>
                            <div className="text-xs text-muted-foreground font-medium uppercase tracking-wider">
                                {source} • {year}
                            </div>
                        </div>

                        <div className="flex items-center justify-between mt-auto pt-4 border-t border-black/5 dark:border-white/5 opacity-0 group-hover:opacity-100 transition-opacity">
                            {doi && (
                                <a href={`https://doi.org/${doi}`} target="_blank" className="text-xs font-semibold flex items-center hover:underline">
                                    VIEW DOI <ExternalLink size={10} className="ml-1" />
                                </a>
                            )}
                            <button
                                onClick={() => onAddToContext(article)}
                                className="p-1.5 rounded-full bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors"
                                title="Add to context"
                            >
                                <Plus size={14} />
                            </button>
                        </div>
                    </div>
                );
            })}
        </div>
    );
}
