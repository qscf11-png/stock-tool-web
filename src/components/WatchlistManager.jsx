import React, { useState, useMemo } from 'react';
import { usePortfolio } from '../context/PortfolioContext';
import { Search, Plus, Trash2, Download, Upload, LineChart as ChartIcon, FileSpreadsheet, Pin, PinOff, Zap, ShieldAlert, Target, Clock, TrendingUp } from 'lucide-react';

// 分類配置定義 (全面覆蓋所有策略狀態) - 移至外部以確保穩定性
const CATEGORY_CONFIG = {
    GIFT_BUY: { label: '上帝的禮物 (Washout)', color: 'text-orange-500', icon: Zap },
    BULLISH_CONFIRMED: { label: '二日驗證成功 (多頭)', color: 'text-red-500', icon: Target },
    BEARISH_CONFIRMED: { label: '勢頭反轉確認 (空頭)', color: 'text-green-500', icon: ShieldAlert },
    WATCH_BREAKOUT: { label: '突破觀察中', color: 'text-yellow-500', icon: Clock },
    WATCH_BREAKDOWN: { label: '跌破觀察中', color: 'text-yellow-600', icon: Clock },
    BULLISH_TREND: { label: '穩健多頭軌道', color: 'text-blue-400', icon: TrendingUp },
    BEARISH_TREND: { label: '弱勢空頭軌道', color: 'text-gray-500', icon: TrendingUp },
    OTHERS: { label: '其餘觀察標的', color: 'text-gray-400', icon: Search }
};

const WatchlistManager = ({ onSelectStock }) => {
    const {
        watchlist,
        addWatchSymbol,
        removeWatchSymbol,
        exportWatchlist,
        importWatchlist,
        importWatchlistFromExcel,
        stockDataMap,
        pinnedSymbols,
        togglePinSymbol,
        watchlistCategoryCache
    } = usePortfolio();
    const [newSymbol, setNewSymbol] = useState('');
    const [loading, setLoading] = useState(false);

    const handleAdd = async (e) => {
        e.preventDefault();
        if (!newSymbol) return;
        setLoading(true);
        try {
            await addWatchSymbol(newSymbol);
            setNewSymbol('');
        } catch (error) {
            alert(error.message);
        } finally {
            setLoading(false);
        }
    };

    const handleImport = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        try {
            if (file.name.endsWith('.json')) {
                await importWatchlist(file);
            } else {
                await importWatchlistFromExcel(file);
            }
            alert('匯入成功！');
        } catch (error) {
            alert('匯入失敗：' + error.message);
        }
        e.target.value = '';
    };


    const groupedWatchlist = useMemo(() => {
        const groups = {};
        Object.keys(CATEGORY_CONFIG).forEach(cat => groups[cat] = []);

        watchlist.forEach(symbol => {
            const advice = watchlistCategoryCache[symbol];
            if (!advice) {
                groups.OTHERS.push(symbol);
                return;
            }

            const status = advice.status || '';
            // 優先匹配精確狀態
            if (groups[status]) {
                groups[status].push(symbol);
            } else {
                // 模糊匹配
                if (status.includes('GIFT')) groups.GIFT_BUY.push(symbol);
                else if (status.includes('BULLISH_CONFIRMED')) groups.BULLISH_CONFIRMED.push(symbol);
                else if (status.includes('BEARISH_CONFIRMED')) groups.BEARISH_CONFIRMED.push(symbol);
                else if (status.includes('WATCH_BREAKOUT')) groups.WATCH_BREAKOUT.push(symbol);
                else if (status.includes('WATCH_BREAKDOWN')) groups.WATCH_BREAKDOWN.push(symbol);
                else if (status.includes('BULLISH_TREND')) groups.BULLISH_TREND.push(symbol);
                else if (status.includes('BEARISH_TREND')) groups.BEARISH_TREND.push(symbol);
                else groups.OTHERS.push(symbol);
            }
        });

        // 在每個分組內，讓釘選的標的排在前面
        Object.keys(groups).forEach(cat => {
            groups[cat].sort((a, b) => {
                const aPinned = pinnedSymbols.includes(a);
                const bPinned = pinnedSymbols.includes(b);
                if (aPinned && !bPinned) return -1;
                if (!aPinned && bPinned) return 1;
                return 0;
            });
        });

        return groups;
    }, [watchlist, pinnedSymbols, watchlistCategoryCache]);

    const renderStockItem = (symbol) => {
        const data = stockDataMap[symbol];
        const advice = watchlistCategoryCache[symbol];
        const isPinned = pinnedSymbols.includes(symbol);

        return (
            <div
                key={symbol}
                className="group flex items-center justify-between p-3 bg-slate-900 border border-slate-700 rounded-lg hover:border-blue-500/50 cursor-pointer transition-all relative overflow-hidden"
                onClick={() => onSelectStock(symbol)}
            >
                {advice && (
                    <div className={`absolute left-0 top-0 bottom-0 w-1 ${advice.color.replace('text-', 'bg-')}`} />
                )}
                <div className="flex items-center gap-3">
                    <div className="bg-slate-800 p-2 rounded-lg text-blue-400 font-mono text-sm group-hover:bg-blue-900/30 transition-colors">
                        {symbol}
                    </div>
                    <div>
                        <div className="text-white font-medium flex items-center gap-2">
                            {data?.name || '載入中...'}
                            {advice && (
                                <span className={`text-[9px] px-1.5 py-0.5 rounded ${advice.color.replace('text-', 'bg-')}/10 ${advice.color} border border-current opacity-70`}>
                                    {advice.status}
                                </span>
                            )}
                        </div>
                        <div className={`text-xs ${data?.changePercent >= 0 ? 'text-red-400' : 'text-green-400'}`}>
                            ${data?.price || '--'} ({data?.changePercent > 0 ? '+' : ''}{data?.changePercent?.toFixed(2)}%)
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-1">
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            togglePinSymbol(symbol);
                        }}
                        className={`p-2 rounded-lg transition-all ${isPinned ? 'text-blue-400 opacity-100' : 'text-gray-600 opacity-0 group-hover:opacity-100 hover:bg-slate-700'}`}
                    >
                        {isPinned ? <PinOff className="w-4 h-4" /> : <Pin className="w-4 h-4" />}
                    </button>
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            removeWatchSymbol(symbol);
                        }}
                        className="p-2 opacity-0 group-hover:opacity-100 hover:bg-red-900/20 text-red-400 rounded-lg transition-all"
                    >
                        <Trash2 className="w-4 h-4" />
                    </button>
                </div>
            </div>
        );
    };

    return (
        <div className="bg-slate-800 rounded-xl border border-slate-700 p-6 shadow-xl">
            <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold flex items-center gap-2 text-blue-400">
                    <ChartIcon className="w-5 h-5" />
                    感興趣標的 (Watchlist)
                </h2>
                <div className="flex gap-2">
                    <button onClick={exportWatchlist} className="p-2 hover:bg-slate-700 rounded-lg text-gray-400" title="匯出 JSON">
                        <Download className="w-4 h-4" />
                    </button>
                    <label className="p-2 hover:bg-slate-700 rounded-lg text-gray-400 cursor-pointer" title="匯入 JSON/Excel">
                        <Upload className="w-4 h-4" />
                        <input type="file" accept=".json,.xlsx,.xls" className="hidden" onChange={handleImport} />
                    </label>
                </div>
            </div>

            <div className="mb-4 flex items-center justify-end">
                <a
                    href="/感興趣標的匯入範例.xlsx"
                    download
                    className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1 transition-colors"
                >
                    <FileSpreadsheet className="w-3 h-3" />
                    下載 Excel 匯入範例
                </a>
            </div>

            <form onSubmit={handleAdd} className="flex gap-2 mb-6">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                    <input
                        type="text"
                        placeholder="輸入股票代號 (如 2330)"
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg py-2 pl-10 pr-4 text-white focus:outline-none focus:border-blue-500 transition-colors"
                        value={newSymbol}
                        onChange={(e) => setNewSymbol(e.target.value)}
                    />
                </div>
                <button
                    disabled={loading}
                    className="bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800 text-white rounded-lg px-4 py-2 transition-colors flex items-center gap-2"
                >
                    <Plus className="w-4 h-4" />
                    新增
                </button>
            </form>

            <div className="space-y-6 max-h-[750px] overflow-y-auto pr-2 custom-scrollbar">
                {watchlist.length === 0 ? (
                    <div className="text-center py-8 text-gray-500 italic">尚未加入任何標的</div>
                ) : (
                    Object.entries(groupedWatchlist).map(([cat, symbols]) => {
                        if (symbols.length === 0) return null;
                        const config = CATEGORY_CONFIG[cat];
                        return (
                            <div key={cat} className="mb-4">
                                <div className="flex items-center justify-between border-b border-white/10 pb-1 mb-2">
                                    <div className={`flex items-center gap-2 ${config.color} text-[11px] font-bold uppercase tracking-wider`}>
                                        <config.icon className="w-3.5 h-3.5" /> {config.label}
                                    </div>
                                    <span className="text-[10px] text-gray-500 bg-white/5 px-2 py-0.5 rounded-full">
                                        {symbols.length}
                                    </span>
                                </div>
                                <div className="space-y-2">
                                    {symbols.map(symbol => renderStockItem(symbol))}
                                </div>
                            </div>
                        );
                    })
                )}
            </div>
        </div>
    );
};

export default WatchlistManager;
