import React, { useEffect, useState } from 'react';
import { usePortfolio } from '../context/PortfolioContext';
import { fetchRelatedNews } from '../services/mockDataService';
import { Bell, TrendingUp } from 'lucide-react';

const ContextualAlerts = () => {
    const { holdings } = usePortfolio();
    const [news, setNews] = useState([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (holdings.length === 0) {
            setNews([]);
            return;
        }

        const loadNews = async () => {
            setLoading(true);
            try {
                const relatedNews = await fetchRelatedNews(holdings);
                setNews(relatedNews);
            } catch (error) {
                console.error('Failed to load news:', error);
            } finally {
                setLoading(false);
            }
        };

        loadNews();
    }, [holdings]);

    if (holdings.length === 0 || news.length === 0) {
        return null;
    }

    return (
        <div className="card">
            <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
                <Bell className="w-6 h-6 text-yellow-400" />
                持股相關情報
            </h2>

            <div className="space-y-3">
                {news.map((item) => (
                    <div
                        key={item.id}
                        className="bg-slate-700/30 rounded-lg p-4 hover:bg-slate-700/50 transition-colors"
                    >
                        <div className="flex items-start gap-3">
                            <TrendingUp className="w-5 h-5 text-blue-400 mt-1 flex-shrink-0" />
                            <div className="flex-1">
                                <div className="font-medium mb-1">{item.title}</div>
                                <div className="flex items-center gap-3 text-sm text-gray-400">
                                    <span>產業：{item.sector}</span>
                                    <span>•</span>
                                    <span>相關股票：{item.stocks.join(', ')}</span>
                                    <span>•</span>
                                    <span>{item.date}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {loading && (
                <div className="text-center text-gray-400 py-4">
                    載入中...
                </div>
            )}
        </div>
    );
};

export default ContextualAlerts;
