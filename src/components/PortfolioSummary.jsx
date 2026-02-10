import React, { useState, useEffect } from 'react';
import { usePortfolio } from '../context/PortfolioContext';
import { calculatePortfolioMetrics, formatCurrency, formatPercentage, getPLColorClass } from '../utils/calculations';
import { TrendingUp, TrendingDown, DollarSign, Wallet, Clock, Calendar } from 'lucide-react';

// 即時時鐘元件
const LiveClock = () => {
    const [currentTime, setCurrentTime] = useState(new Date());

    useEffect(() => {
        const timer = setInterval(() => {
            setCurrentTime(new Date());
        }, 1000);

        return () => clearInterval(timer);
    }, []);

    const formatDate = (date) => {
        const days = ['週日', '週一', '週二', '週三', '週四', '週五', '週六'];
        const year = date.getFullYear();
        const month = date.getMonth() + 1;
        const day = date.getDate();
        const dayOfWeek = days[date.getDay()];
        return `${year}/${month.toString().padStart(2, '0')}/${day.toString().padStart(2, '0')} (${dayOfWeek})`;
    };

    const formatTime = (date) => {
        return date.toLocaleTimeString('zh-TW', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: false
        });
    };

    // 判斷是否為交易時間 (週一至週五 9:00-13:30)
    const isMarketOpen = () => {
        const day = currentTime.getDay();
        const hour = currentTime.getHours();
        const minute = currentTime.getMinutes();
        const timeValue = hour * 60 + minute;

        // 週一至週五
        if (day === 0 || day === 6) return false;

        // 9:00 - 13:30
        return timeValue >= 9 * 60 && timeValue <= 13 * 60 + 30;
    };

    const marketOpen = isMarketOpen();

    return (
        <div className="flex items-center gap-4 text-sm">
            <div className="flex items-center gap-2 text-gray-400">
                <Calendar className="w-4 h-4" />
                <span>{formatDate(currentTime)}</span>
            </div>
            <div className="flex items-center gap-2 text-gray-400">
                <Clock className="w-4 h-4" />
                <span className="font-mono">{formatTime(currentTime)}</span>
            </div>
            <div className={`px-2 py-0.5 rounded-full text-xs ${marketOpen
                ? 'bg-green-900/50 text-green-400 border border-green-800'
                : 'bg-gray-700/50 text-gray-400 border border-gray-600'}`}>
                {marketOpen ? '🟢 開盤中' : '⚫ 休市'}
            </div>
        </div>
    );
};

const PortfolioSummary = () => {
    const { holdings, stockDataMap } = usePortfolio();

    // Update holdings with current prices from stockDataMap
    const enrichedHoldings = holdings.map(h => ({
        ...h,
        currentPrice: stockDataMap[h.symbol]?.price || h.currentPrice
    }));

    const metrics = calculatePortfolioMetrics(enrichedHoldings);

    // 判斷資料來源：檢查是否有真實 API 資料
    const getDataSourceInfo = () => {
        if (!stockDataMap || Object.keys(stockDataMap).length === 0) {
            return { isReal: false, label: '無資料', color: 'gray' };
        }

        const sources = Object.values(stockDataMap)
            .map(d => d?.dataSource)
            .filter(Boolean);

        // 檢查是否有真實 API 資料（非 MOCK 開頭）
        const realSources = sources.filter(s => !s.startsWith('MOCK'));

        if (realSources.length > 0) {
            // 判斷資料來源類型
            if (realSources.some(s => s.includes('YAHOO'))) {
                return { isReal: true, label: 'Yahoo Finance', color: 'green' };
            }
            if (realSources.some(s => s.includes('REAL'))) {
                return { isReal: true, label: 'TWSE API', color: 'green' };
            }
            return { isReal: true, label: 'API 連線', color: 'green' };
        }

        return { isReal: false, label: '模擬數據', color: 'yellow' };
    };

    const dataSource = getDataSourceInfo();

    return (
        <div className="card">
            {/* 標題列：包含日期時間 */}
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-6">
                <h2 className="text-2xl font-bold flex items-center gap-3">
                    投資組合總覽
                    <span className={`text-xs px-2 py-0.5 rounded-full border ${dataSource.color === 'green'
                            ? 'bg-green-900/50 text-green-400 border-green-800'
                            : dataSource.color === 'yellow'
                                ? 'bg-yellow-900/50 text-yellow-400 border-yellow-800'
                                : 'bg-gray-700/50 text-gray-400 border-gray-600'
                        }`}>
                        {dataSource.label}
                    </span>
                </h2>
                <LiveClock />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Total Cost */}
                <div className="bg-slate-700/30 rounded-lg p-4">
                    <div className="flex items-center gap-2 text-gray-400 mb-2">
                        <Wallet className="w-4 h-4" />
                        <span className="text-sm">總投入成本</span>
                    </div>
                    <div className="text-2xl font-bold">
                        {formatCurrency(metrics.totalCost)}
                    </div>
                </div>

                {/* Market Value */}
                <div className="bg-slate-700/30 rounded-lg p-4">
                    <div className="flex items-center gap-2 text-gray-400 mb-2">
                        <DollarSign className="w-4 h-4" />
                        <span className="text-sm">總資產市值</span>
                    </div>
                    <div className="text-2xl font-bold">
                        {formatCurrency(metrics.totalMarketValue)}
                    </div>
                </div>

                {/* Unrealized P/L */}
                <div className="bg-slate-700/30 rounded-lg p-4">
                    <div className="flex items-center gap-2 text-gray-400 mb-2">
                        {metrics.unrealizedPL >= 0 ? (
                            <TrendingUp className="w-4 h-4" />
                        ) : (
                            <TrendingDown className="w-4 h-4" />
                        )}
                        <span className="text-sm">未實現損益</span>
                    </div>
                    <div className={`text-2xl font-bold ${getPLColorClass(metrics.unrealizedPL)}`}>
                        {formatCurrency(metrics.unrealizedPL)}
                    </div>
                </div>

                {/* ROI */}
                <div className="bg-slate-700/30 rounded-lg p-4">
                    <div className="flex items-center gap-2 text-gray-400 mb-2">
                        <TrendingUp className="w-4 h-4" />
                        <span className="text-sm">總報酬率</span>
                    </div>
                    <div className={`text-2xl font-bold ${getPLColorClass(metrics.roi)}`}>
                        {formatPercentage(metrics.roi)}
                    </div>
                </div>
            </div>

            {holdings.length === 0 && (
                <div className="mt-6 text-center text-gray-400">
                    <p>尚未新增任何持股</p>
                    <p className="text-sm mt-2">點擊下方「新增持股」按鈕開始</p>
                </div>
            )}
        </div>
    );
};

export default PortfolioSummary;
