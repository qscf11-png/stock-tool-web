import React, { useState, useEffect } from 'react';
import WatchlistManager from './WatchlistManager';
import StockChart from './StockChart';
import StrategyAdvisor from './StrategyAdvisor';
import { usePortfolio } from '../context/PortfolioContext';
import { fetchStockHistory } from '../services/twseService';

const AnalysisPage = () => {
    const { watchlistSettings, updateWatchlistSettings } = usePortfolio();
    const [selectedSymbol, setSelectedSymbol] = useState(null);
    const [history, setHistory] = useState([]);

    // Get current settings for selected symbol or defaults
    const currentSettings = watchlistSettings[selectedSymbol] || { maShort: 18, maLong: 52, analysisMode: 'short' };
    const maShort = currentSettings.maShort;
    const maLong = currentSettings.maLong;
    const analysisMode = currentSettings.analysisMode || 'short';

    const handleMaChange = (type, value) => {
        updateWatchlistSettings(selectedSymbol, { [type]: Number(value) });
    };

    const handleModeChange = (mode) => {
        updateWatchlistSettings(selectedSymbol, { analysisMode: mode });
    };

    useEffect(() => {
        if (!selectedSymbol) return;

        const loadHistory = async () => {
            try {
                const data = await fetchStockHistory(selectedSymbol, '2y');
                if (data && data.history) {
                    setHistory(data.history);
                }
            } catch (error) {
                console.error('Failed to load history in AnalysisPage:', error);
            }
        };
        loadHistory();
    }, [selectedSymbol]);

    return (
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 min-h-[800px]">
            {/* 左側：標的管理 */}
            <div className="xl:col-span-3">
                <WatchlistManager onSelectStock={setSelectedSymbol} />
            </div>

            <div className="xl:col-span-9 space-y-6">
                {selectedSymbol ? (
                    <>
                        <div className="bg-slate-800 rounded-xl border border-slate-700 p-4 shadow-lg flex flex-col md:flex-row items-center justify-between gap-4">
                            <div className="flex items-center gap-4">
                                <h2 className="text-2xl font-bold text-white flex items-center gap-3">
                                    <span className="bg-blue-600 px-3 py-1 rounded-lg text-sm">{selectedSymbol}</span>
                                    量化建議
                                </h2>

                                <div className="flex bg-slate-900 p-1 rounded-lg border border-slate-700">
                                    <button
                                        onClick={() => handleModeChange('short')}
                                        className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${analysisMode === 'short' ? 'bg-blue-600 text-white shadow-lg' : 'text-gray-400 hover:text-gray-300'}`}
                                    >
                                        短期波動
                                    </button>
                                    <button
                                        onClick={() => handleModeChange('long')}
                                        className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${analysisMode === 'long' ? 'bg-purple-600 text-white shadow-lg' : 'text-gray-400 hover:text-gray-300'}`}
                                    >
                                        長期波段
                                    </button>
                                </div>
                            </div>
                            <div className="flex gap-4">
                                <div className="flex items-center gap-2">
                                    <span className="text-xs text-gray-500 uppercase">短期 MA</span>
                                    <input
                                        type="number"
                                        className="w-16 bg-slate-900 border border-slate-700 rounded px-2 py-1 text-yellow-400 text-sm focus:outline-none focus:border-yellow-500"
                                        value={maShort}
                                        onChange={(e) => handleMaChange('maShort', e.target.value)}
                                    />
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="text-xs text-gray-500 uppercase">長期 MA</span>
                                    <input
                                        type="number"
                                        className="w-16 bg-slate-900 border border-slate-700 rounded px-2 py-1 text-blue-400 text-sm focus:outline-none focus:border-blue-500"
                                        value={maLong}
                                        onChange={(e) => handleMaChange('maLong', e.target.value)}
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            <StockChart
                                symbol={selectedSymbol}
                                maShortPeriod={maShort}
                                maLongPeriod={maLong}
                            />
                            <StrategyAdvisor
                                symbol={selectedSymbol}
                                history={history}
                                maShortPeriod={maShort}
                                maLongPeriod={maLong}
                                analysisMode={analysisMode}
                            />
                        </div>
                    </>
                ) : (
                    <div className="h-full bg-slate-800/50 rounded-2xl border-2 border-dashed border-slate-700 flex flex-col items-center justify-center text-gray-500 min-h-[600px] gap-4">
                        <div className="bg-slate-800 p-6 rounded-full">
                            <svg className="w-16 h-16 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                            </svg>
                        </div>
                        <div className="text-center">
                            <h3 className="text-xl font-bold text-slate-300 mb-2">準備好進行專業分析了嗎？</h3>
                            <p className="max-w-xs">從左側「感興趣標的」列表中選擇一檔股票，或點擊「新增」來開始您的行為學策略校準。</p>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default AnalysisPage;
