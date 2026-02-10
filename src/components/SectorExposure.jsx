import React from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';
import { usePortfolio } from '../context/PortfolioContext';
import { calculateSectorExposure, formatCurrency } from '../utils/calculations';
import { PieChartIcon } from 'lucide-react';

const COLORS = ['#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#06b6d4'];

const SectorExposure = () => {
    const { holdings, stockDataMap } = usePortfolio();

    // Update holdings with current prices
    const enrichedHoldings = holdings.map(h => ({
        ...h,
        currentPrice: stockDataMap[h.symbol]?.price || h.currentPrice
    }));

    const sectorData = calculateSectorExposure(enrichedHoldings, stockDataMap);

    if (sectorData.length === 0) {
        return null;
    }

    return (
        <div className="card">
            <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
                <PieChartIcon className="w-6 h-6 text-purple-400" />
                產業曝險分析
            </h2>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Pie Chart */}
                <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                            <Pie
                                data={sectorData}
                                cx="50%"
                                cy="50%"
                                labelLine={false}
                                label={({ name, percentage }) => `${name} ${percentage}%`}
                                outerRadius={80}
                                fill="#8884d8"
                                dataKey="value"
                            >
                                {sectorData.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                ))}
                            </Pie>
                            <Tooltip
                                formatter={(value) => formatCurrency(value)}
                                contentStyle={{
                                    backgroundColor: '#1e293b',
                                    border: '1px solid #475569',
                                    borderRadius: '8px'
                                }}
                            />
                        </PieChart>
                    </ResponsiveContainer>
                </div>

                {/* Sector List */}
                <div className="space-y-3">
                    {sectorData.map((sector, index) => (
                        <div key={sector.name} className="bg-slate-700/30 rounded-lg p-4">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div
                                        className="w-4 h-4 rounded"
                                        style={{ backgroundColor: COLORS[index % COLORS.length] }}
                                    />
                                    <span className="font-medium">{sector.name}</span>
                                </div>
                                <div className="text-right">
                                    <div className="font-bold">{sector.percentage}%</div>
                                    <div className="text-sm text-gray-400">
                                        {formatCurrency(sector.value)}
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Risk Warning */}
            {sectorData.some(s => parseFloat(s.percentage) > 50) && (
                <div className="mt-6 bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4">
                    <div className="flex items-start gap-2">
                        <span className="text-yellow-400 text-xl">⚠️</span>
                        <div>
                            <div className="font-semibold text-yellow-400">集中度風險警示</div>
                            <div className="text-sm text-gray-300 mt-1">
                                您的投資組合在單一產業的配置超過50%，建議適度分散風險。
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default SectorExposure;
