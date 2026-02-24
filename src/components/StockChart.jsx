import React, { useState, useEffect, useMemo } from 'react';
import { ResponsiveContainer, ComposedChart, XAxis, YAxis, Tooltip, Line, Bar, ReferenceLine, CartesianGrid } from 'recharts';
import { fetchStockHistory } from '../services/twseService';
import { calculateMA } from '../utils/strategyUtils';
import { Settings, Calendar } from 'lucide-react';

const StockChart = ({ symbol, maShortPeriod = 20, maLongPeriod = 60 }) => {
    const [history, setHistory] = useState([]);
    const [loading, setLoading] = useState(false);
    const [range, setRange] = useState('1y');

    useEffect(() => {
        if (!symbol) return;
        const loadHistory = async () => {
            setLoading(true);
            try {
                const data = await fetchStockHistory(symbol, range);
                if (data && data.history) {
                    setHistory(data.history);
                }
            } catch (error) {
                console.error('History load error:', error);
            } finally {
                setLoading(false);
            }
        };
        loadHistory();
    }, [symbol, range]);

    const chartData = useMemo(() => {
        if (history.length === 0) return [];

        const shortMA = calculateMA(history, maShortPeriod);
        const longMA = calculateMA(history, maLongPeriod);

        return history.map((d, i) => ({
            ...d,
            shortMA: shortMA[i],
            longMA: longMA[i],
            color: d.close >= d.open ? '#f87171' : '#4ade80' // 台股紅漲綠跌
        }));
    }, [history, maShortPeriod, maLongPeriod]);

    if (loading) return <div className="h-96 flex items-center justify-center bg-slate-900 rounded-xl text-blue-400">載入歷史資料中...</div>;
    if (!symbol) return <div className="h-96 flex items-center justify-center bg-slate-900 rounded-xl text-gray-500 italic">請選擇標的查看 K 線圖</div>;

    return (
        <div className="bg-slate-800 rounded-xl border border-slate-700 p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <h3 className="text-lg font-bold text-white flex items-center gap-2">
                        {symbol} K 線與均線分析
                    </h3>
                    <div className="flex bg-slate-900 rounded-lg p-1 text-xs">
                        {['1mo', '3mo', '6mo', '1y', '2y'].map(r => (
                            <button
                                key={r}
                                onClick={() => setRange(r)}
                                className={`px-3 py-1 rounded-md transition-all ${range === r ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-gray-200'}`}
                            >
                                {r.toUpperCase()}
                            </button>
                        ))}
                    </div>
                </div>
                <div className="flex items-center gap-4 text-xs">
                    <div className="flex items-center gap-1">
                        <div className="w-3 h-0.5 bg-yellow-400"></div>
                        <span className="text-gray-400">短期 MA ({maShortPeriod})</span>
                    </div>
                    <div className="flex items-center gap-1">
                        <div className="w-3 h-0.5 bg-blue-400"></div>
                        <span className="text-gray-400">長期 MA ({maLongPeriod})</span>
                    </div>
                </div>
            </div>

            <div className="h-[400px] w-full mt-4">
                <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                        <XAxis
                            dataKey="date"
                            stroke="#64748b"
                            fontSize={10}
                            tickFormatter={(val) => val.slice(5)}
                            minTickGap={30}
                        />
                        <YAxis
                            domain={['auto', 'auto']}
                            stroke="#64748b"
                            fontSize={10}
                            orientation="right"
                            tickFormatter={(val) => `$${val}`}
                        />
                        <Tooltip
                            contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: '8px', fontSize: '12px' }}
                            itemStyle={{ padding: '2px 0' }}
                            labelStyle={{ color: '#94a3b8', marginBottom: '4px' }}
                        />

                        {/* K 線模擬：使用 Bar 或專門的 Candle 元件，這裡簡便處理使用 Line 顯示價格 */}
                        <Line
                            type="monotone"
                            dataKey="close"
                            stroke="#fff"
                            strokeWidth={1}
                            dot={false}
                            activeDot={{ r: 4 }}
                            name="收盤價"
                        />
                        <Line
                            type="monotone"
                            dataKey="shortMA"
                            stroke="#facc15"
                            strokeWidth={1.5}
                            dot={false}
                            name="短期均線"
                        />
                        <Line
                            type="monotone"
                            dataKey="longMA"
                            stroke="#3b82f6"
                            strokeWidth={1.5}
                            dot={false}
                            name="長期均線"
                        />

                        {/* 成交量 Bar */}
                        <Bar
                            dataKey="volume"
                            fill="#334155"
                            opacity={0.3}
                            yAxisId="volume"
                            name="成交量"
                        />
                        <YAxis yAxisId="volume" hide />
                    </ComposedChart>
                </ResponsiveContainer>
            </div>

            <div className="grid grid-cols-2 gap-4 pt-4 border-t border-slate-700/50">
                <div className="bg-slate-900/50 rounded-lg p-3 text-center">
                    <div className="text-xs text-gray-500 mb-1">今日收盤</div>
                    <div className="text-xl font-bold text-white">${history[history.length - 1]?.close || '--'}</div>
                </div>
                <div className="bg-slate-900/50 rounded-lg p-3 text-center">
                    <div className="text-xs text-gray-500 mb-1">短期 MA</div>
                    <div className="text-xl font-bold text-yellow-400">${chartData[chartData.length - 1]?.shortMA?.toFixed(2) || '--'}</div>
                </div>
            </div>
        </div>
    );
};

export default StockChart;
