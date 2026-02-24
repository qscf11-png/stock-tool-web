import React, { useState, useMemo } from 'react';
import { calculateMA, getStrategyAdvice, calculatePositionSize } from '../utils/strategyUtils';
import { ShieldAlert, Zap, Target, MousePointer2, AlertCircle } from 'lucide-react';

const StrategyAdvisor = ({ history, maShortPeriod, maLongPeriod, analysisMode = 'short' }) => {
    const [totalAssets, setTotalAssets] = useState(1000000);
    const [stopLossPercent, setStopLossPercent] = useState(7);

    // Get advise from strategy utility
    const advice = useMemo(() => {
        if (!history || history.length < 2) return null;
        return getStrategyAdvice(history, maShortPeriod, maLongPeriod, analysisMode);
    }, [history, maShortPeriod, maLongPeriod, analysisMode]);

    const positionSize = useMemo(() => {
        if (!history || history.length === 0) return 0;
        const lastPrice = history[history.length - 1].close;
        const stopLossPrice = lastPrice * (1 - stopLossPercent / 100);
        return calculatePositionSize(totalAssets, lastPrice, stopLossPrice);
    }, [history, totalAssets, stopLossPercent]);

    if (!advice) {
        return (
            <div className="bg-slate-800 rounded-2xl border border-slate-700 p-8 flex flex-col items-center justify-center text-center">
                <AlertCircle className="w-12 h-12 text-slate-600 mb-4" />
                <p className="text-slate-400">數據加載中或數據量不足以生成策略建議...</p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* 策略診斷卡片 */}
            <div className="bg-slate-800 rounded-2xl border border-slate-700 p-6 shadow-xl overflow-hidden relative">
                <div className={`absolute top-0 right-0 px-4 py-1 rounded-bl-xl text-xs font-bold uppercase tracking-wider ${advice.color.replace('text-', 'bg-')}/20 ${advice.color}`}>
                    {analysisMode === 'short' ? '短期波動模式' : '長期波段模式'}
                </div>

                <div className="flex items-start gap-4 mb-6">
                    <div className={`p-3 rounded-xl ${advice.color.replace('text-', 'bg-')}/10`}>
                        <ShieldAlert className={`w-8 h-8 ${advice.color}`} />
                    </div>
                    <div>
                        <h3 className="text-gray-400 text-sm font-medium mb-1">策略診斷</h3>
                        <div className={`text-2xl font-black ${advice.color} flex items-center gap-2`}>
                            {advice.status}
                        </div>
                    </div>
                </div>

                <div className="bg-slate-900/50 rounded-xl p-4 border border-slate-700/50 mb-6">
                    <p className="text-slate-200 leading-relaxed italic">
                        「{advice.advice}」
                    </p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div className="bg-slate-900/30 p-3 rounded-lg flex items-center gap-3">
                        <Zap className="w-4 h-4 text-yellow-500" />
                        <div>
                            <div className="text-[10px] text-gray-500 uppercase">核心邏輯</div>
                            <div className="text-sm font-semibold text-slate-300">{advice.reason}</div>
                        </div>
                    </div>
                    <div className="bg-slate-900/30 p-3 rounded-lg flex items-center gap-3">
                        <Target className="w-4 h-4 text-blue-500" />
                        <div>
                            <div className="text-[10px] text-gray-500 uppercase">執行動作</div>
                            <div className="text-sm font-semibold text-slate-300">
                                {advice.status.includes('BULL') || advice.status.includes('BUY') ? '考慮進場/持股' : '減碼/觀望'}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* 1% 損傷部位計算器 */}
            <div className="bg-slate-800 rounded-2xl border border-slate-700 p-6 shadow-xl">
                <div className="flex items-center gap-3 mb-6">
                    <div className="p-2 bg-blue-500/10 rounded-lg">
                        <MousePointer2 className="w-5 h-5 text-blue-400" />
                    </div>
                    <h3 className="text-lg font-bold text-white">部位規模精算 (1% 法則)</h3>
                </div>

                <div className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                            <label className="text-sm text-gray-400">當前可用資產 (NT$)</label>
                            <input
                                type="number"
                                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition-all font-mono"
                                value={totalAssets}
                                onChange={(e) => setTotalAssets(Number(e.target.value))}
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm text-gray-400">停損百分比 (%)</label>
                            <div className="flex items-center gap-3">
                                <input
                                    type="range"
                                    min="1"
                                    max="15"
                                    step="0.5"
                                    className="flex-1 accent-blue-500"
                                    value={stopLossPercent}
                                    onChange={(e) => setStopLossPercent(Number(e.target.value))}
                                />
                                <span className="text-blue-400 font-bold w-12 text-center">{stopLossPercent}%</span>
                            </div>
                        </div>
                    </div>

                    <div className="bg-blue-500/10 border border-blue-500/20 rounded-2xl p-6 text-center">
                        <div className="text-sm text-blue-300/60 uppercase tracking-widest mb-1">第一筆測試單建議規模</div>
                        <div className="text-4xl font-black text-blue-400 mb-2">
                            {positionSize.toLocaleString()} <span className="text-xl font-normal opacity-60">股</span>
                        </div>
                        <p className="text-xs text-blue-300/40">
                            基於 1% 最大資產損傷計算。若觸發 {stopLossPercent}% 停損，資產縮水將控制在 NT$ {(totalAssets * 0.01).toLocaleString()}。
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default StrategyAdvisor;
