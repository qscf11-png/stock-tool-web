import React from 'react';
import { analyzeMovingAverages, compareWithIndustry, generateHealthReport, calculateHealthScore, getHealthStatus } from '../utils/healthScore';
import { Activity, TrendingUp, DollarSign, Percent, AlertTriangle } from 'lucide-react';

const StockDiagnosis = ({ symbol, stockData }) => {
    const maAnalysis = analyzeMovingAverages(stockData);

    // Industry averages (mock - would come from API in production)
    const industryAverages = {
        roe: 15.0,
        pe: 15.0
    };

    const roeComparison = compareWithIndustry(stockData.roe, industryAverages.roe, true);
    const peComparison = compareWithIndustry(stockData.pe, industryAverages.pe, false);

    return (
        <div className="py-6 space-y-6">
            {/* Basic Info */}
            <div>
                <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                    <Activity className="w-5 h-5 text-blue-400" />
                    個股診斷 - {symbol} {stockData.name}
                </h3>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Fundamental Analysis */}
                <div className="bg-slate-700/30 rounded-lg p-4">
                    <h4 className="font-semibold mb-4 flex items-center gap-2">
                        <DollarSign className="w-4 h-4 text-green-400" />
                        基本面分析（體質）
                    </h4>

                    <div className="space-y-3">
                        {/* ROE */}
                        <div className="flex justify-between items-start">
                            <div>
                                <div className="text-sm text-gray-400">股東權益報酬率 (ROE)</div>
                                <div className="text-xl font-bold">{stockData.roe}%</div>
                            </div>
                            <div className={`text-sm ${roeComparison.color}`}>
                                {roeComparison.label}
                            </div>
                        </div>

                        {/* P/E */}
                        <div className="flex justify-between items-start">
                            <div>
                                <div className="text-sm text-gray-400">本益比 (P/E)</div>
                                <div className="text-xl font-bold">{stockData.pe}</div>
                            </div>
                            <div className={`text-sm ${peComparison.color}`}>
                                {peComparison.label}
                            </div>
                        </div>

                        {/* P/B */}
                        <div className="flex justify-between items-start">
                            <div>
                                <div className="text-sm text-gray-400">股價淨值比 (P/B)</div>
                                <div className="text-xl font-bold">{stockData.pb || '-'}</div>
                            </div>
                            <div className="text-sm text-gray-400">
                                {stockData.pb ? (stockData.pb < 1.5 ? '低估' : stockData.pb > 3 ? '高估' : '合理') : '-'}
                            </div>
                        </div>

                        {/* Dividend Yield */}
                        <div className="flex justify-between items-start">
                            <div>
                                <div className="text-sm text-gray-400">現金殖利率</div>
                                <div className="text-xl font-bold">{stockData.dividendYield}%</div>
                            </div>
                            <div className="text-sm text-gray-400">
                                {stockData.dividendYield > 4 ? '高配息' : stockData.dividendYield > 2 ? '中配息' : '低配息'}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Technical Analysis */}
                <div className="bg-slate-700/30 rounded-lg p-4">
                    <h4 className="font-semibold mb-4 flex items-center gap-2">
                        <TrendingUp className="w-4 h-4 text-blue-400" />
                        技術面與風險分析
                    </h4>

                    <div className="space-y-3">
                        {/* Moving Averages */}
                        <div>
                            <div className="text-sm text-gray-400 mb-2">均線排列</div>
                            <div className="space-y-1">
                                <div className="flex justify-between text-sm">
                                    <span>現價</span>
                                    <span className="font-medium">${stockData.price}</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                    <span>20日均線</span>
                                    <span className="font-medium">${stockData.ma20}</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                    <span>60日均線</span>
                                    <span className="font-medium">${stockData.ma60}</span>
                                </div>
                            </div>
                        </div>

                        {/* Risk Metrics */}
                        <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-600/50">
                            <div>
                                <div className="text-sm text-gray-400">Beta 值</div>
                                <div className="text-lg font-bold">{stockData.beta || '-'}</div>
                                <div className="text-xs text-gray-500">
                                    {stockData.beta ? (stockData.beta > 1.2 ? '高波動' : stockData.beta < 0.8 ? '低波動' : '中波動') : '-'}
                                </div>
                            </div>
                            <div>
                                <div className="text-sm text-gray-400">年化波動率</div>
                                <div className="text-lg font-bold">{stockData.volatility ? `${stockData.volatility}%` : '-'}</div>
                            </div>
                        </div>

                        {/* Trend Analysis */}
                        <div className={`p-3 rounded-lg mt-2 ${maAnalysis.trend === 'bullish' ? 'bg-red-500/10 border border-red-500/30' :
                            maAnalysis.trend === 'bearish' ? 'bg-green-500/10 border border-green-500/30' :
                                'bg-yellow-500/10 border border-yellow-500/30'
                            }`}>
                            <div className={`font-semibold mb-1 ${maAnalysis.trend === 'bullish' ? 'text-red-400' :
                                maAnalysis.trend === 'bearish' ? 'text-green-400' :
                                    'text-yellow-400'
                                }`}>
                                {maAnalysis.status}
                            </div>
                            <div className="text-sm text-gray-300">
                                {maAnalysis.message}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Health Analysis Report */}
            <div className="bg-slate-700/30 rounded-lg p-4">
                <h4 className="font-semibold mb-3 flex items-center gap-2">
                    <Activity className="w-4 h-4 text-purple-400" />
                    系統診斷報告
                </h4>
                <div className="space-y-2">
                    {generateHealthReport(stockData).map((reason, idx) => (
                        <div key={idx} className="flex items-start gap-2 text-sm">
                            <span className={`mt-1 w-2 h-2 rounded-full ${reason.type === 'good' ? 'bg-green-400' :
                                    reason.type === 'bad' ? 'bg-red-400' : 'bg-yellow-400'
                                }`} />
                            <span className="text-gray-300">{reason.text}</span>
                        </div>
                    ))}
                    {generateHealthReport(stockData).length === 0 && (
                        <div className="text-gray-400 text-sm">暫無特殊診斷建議，各項指標表現平穩。</div>
                    )}
                </div>
            </div>

            {/* Sector Info */}
            <div className="bg-slate-700/30 rounded-lg p-4">
                <div className="flex items-center gap-2 text-sm">
                    <Percent className="w-4 h-4 text-purple-400" />
                    <span className="text-gray-400">產業分類：</span>
                    <span className="font-medium">{stockData.sector}</span>
                </div>
            </div>
        </div>
    );
};

export default StockDiagnosis;
