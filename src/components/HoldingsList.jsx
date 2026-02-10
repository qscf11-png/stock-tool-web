import React, { useState } from 'react';
import { usePortfolio } from '../context/PortfolioContext';
import { formatCurrency, formatPercentage, getPLColorClass } from '../utils/calculations';
import { calculateHealthScore, getHealthStatus } from '../utils/healthScore';
import { Trash2, ChevronDown, ChevronUp } from 'lucide-react';
import StockDiagnosis from './StockDiagnosis';

const HoldingRow = ({ holding }) => {
    const { stockDataMap, deleteHolding } = usePortfolio();
    const [expanded, setExpanded] = useState(false);

    const stockData = stockDataMap[holding.symbol];
    const currentPrice = stockData?.price || holding.currentPrice;

    const cost = holding.shares * holding.avgCost;
    const marketValue = holding.shares * currentPrice;
    const unrealizedPL = marketValue - cost;
    const plPercentage = cost > 0 ? (unrealizedPL / cost * 100) : 0;

    const healthScore = stockData ? calculateHealthScore(stockData) : 0;
    const healthStatus = getHealthStatus(healthScore);

    return (
        <>
            <tr className="border-b border-slate-700/50 hover:bg-slate-700/30 transition-colors">
                <td className="px-4 py-4">
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setExpanded(!expanded)}
                            className="text-gray-400 hover:text-white"
                        >
                            {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </button>
                        <div>
                            <div className="font-medium">{holding.symbol}</div>
                            {stockData && (
                                <div className="text-sm text-gray-400">{stockData.name}</div>
                            )}
                        </div>
                    </div>
                </td>

                <td className="px-4 py-4 text-right">
                    {holding.shares.toLocaleString()}
                </td>

                <td className="px-4 py-4 text-right">
                    ${holding.avgCost.toFixed(2)}
                </td>

                <td className="px-4 py-4 text-right">
                    ${currentPrice.toFixed(2)}
                </td>

                <td className="px-4 py-4 text-right">
                    {formatCurrency(cost)}
                </td>

                <td className="px-4 py-4 text-right">
                    {formatCurrency(marketValue)}
                </td>

                <td className="px-4 py-4 text-right">
                    <div className={getPLColorClass(unrealizedPL)}>
                        <div className="font-medium">{formatCurrency(unrealizedPL)}</div>
                        <div className="text-sm">{formatPercentage(plPercentage)}</div>
                    </div>
                </td>

                <td className="px-4 py-4 text-center">
                    {stockData && (
                        <div>
                            <div className={`font-medium ${healthStatus.color}`}>
                                {healthScore}
                            </div>
                            <div className="text-xs text-gray-400">{healthStatus.label}</div>
                        </div>
                    )}
                </td>

                <td className="px-4 py-4 text-center">
                    <button
                        onClick={() => {
                            if (confirm(`確定要刪除 ${holding.symbol} 嗎？`)) {
                                deleteHolding(holding.symbol);
                            }
                        }}
                        className="text-red-400 hover:text-red-300 transition-colors"
                    >
                        <Trash2 className="w-4 h-4" />
                    </button>
                </td>
            </tr>

            {expanded && stockData && (
                <tr>
                    <td colSpan="9" className="px-4 py-0 bg-slate-800/30">
                        <StockDiagnosis symbol={holding.symbol} stockData={stockData} />
                    </td>
                </tr>
            )}
        </>
    );
};

const HoldingsList = () => {
    const { holdings } = usePortfolio();
    const [isExpanded, setIsExpanded] = useState(true);

    if (holdings.length === 0) {
        return null;
    }

    return (
        <div className="card overflow-hidden">
            <div
                className="flex items-center justify-between cursor-pointer mb-6"
                onClick={() => setIsExpanded(!isExpanded)}
            >
                <h2 className="text-2xl font-bold">持股明細</h2>
                <button className="text-gray-400 hover:text-white transition-colors p-1 rounded-full hover:bg-slate-700/50">
                    {isExpanded ? <ChevronUp className="w-6 h-6" /> : <ChevronDown className="w-6 h-6" />}
                </button>
            </div>

            {isExpanded && (
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead>
                            <tr className="border-b border-slate-700 text-gray-400 text-sm">
                                <th className="px-4 py-3 text-left">股票</th>
                                <th className="px-4 py-3 text-right">股數</th>
                                <th className="px-4 py-3 text-right">成本</th>
                                <th className="px-4 py-3 text-right">現價</th>
                                <th className="px-4 py-3 text-right">投入成本</th>
                                <th className="px-4 py-3 text-right">市值</th>
                                <th className="px-4 py-3 text-right">損益</th>
                                <th className="px-4 py-3 text-center">健康度</th>
                                <th className="px-4 py-3 text-center">操作</th>
                            </tr>
                        </thead>
                        <tbody>
                            {holdings.map(holding => (
                                <HoldingRow key={holding.symbol} holding={holding} />
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
};

export default HoldingsList;
