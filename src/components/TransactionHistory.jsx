import React from 'react';
import { usePortfolio } from '../context/PortfolioContext';
import { formatCurrency } from '../utils/calculations';
import { History, ArrowUpRight, ArrowDownLeft, ChevronDown, ChevronUp } from 'lucide-react';

const TransactionHistory = () => {
    const { transactions } = usePortfolio();
    const [isExpanded, setIsExpanded] = React.useState(true);

    if (transactions.length === 0) {
        return null;
    }

    // Sort transactions by date descending
    const sortedTransactions = [...transactions].sort((a, b) =>
        new Date(b.date) - new Date(a.date)
    );

    return (
        <div className="card">
            <div
                className="flex items-center justify-between cursor-pointer mb-6"
                onClick={() => setIsExpanded(!isExpanded)}
            >
                <h2 className="text-2xl font-bold flex items-center gap-2">
                    <History className="w-6 h-6 text-gray-400" />
                    交易記錄
                </h2>
                <button className="text-gray-400 hover:text-white transition-colors p-1 rounded-full hover:bg-slate-700/50">
                    {isExpanded ? <ChevronUp className="w-6 h-6" /> : <ChevronDown className="w-6 h-6" />}
                </button>
            </div>

            {isExpanded && (
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead>
                            <tr className="border-b border-slate-700 text-gray-400 text-sm">
                                <th className="px-4 py-3 text-left">日期</th>
                                <th className="px-4 py-3 text-left">類別</th>
                                <th className="px-4 py-3 text-left">股票</th>
                                <th className="px-4 py-3 text-right">股數</th>
                                <th className="px-4 py-3 text-right">價格</th>
                                <th className="px-4 py-3 text-right">總金額</th>
                            </tr>
                        </thead>
                        <tbody>
                            {sortedTransactions.map((tx) => (
                                <tr key={tx.id} className="border-b border-slate-700/50 hover:bg-slate-700/30 transition-colors">
                                    <td className="px-4 py-3 text-gray-300">{tx.date}</td>
                                    <td className="px-4 py-3">
                                        <span className={`flex items-center gap-1 font-medium ${tx.type === 'BUY' ? 'text-red-400' : 'text-green-400'
                                            }`}>
                                            {tx.type === 'BUY' ? (
                                                <>
                                                    <ArrowDownLeft className="w-4 h-4" />
                                                    買入
                                                </>
                                            ) : (
                                                <>
                                                    <ArrowUpRight className="w-4 h-4" />
                                                    賣出
                                                </>
                                            )}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3 font-medium">{tx.symbol}</td>
                                    <td className="px-4 py-3 text-right">{tx.shares.toLocaleString()}</td>
                                    <td className="px-4 py-3 text-right">${tx.price.toFixed(2)}</td>
                                    <td className="px-4 py-3 text-right font-medium">
                                        {formatCurrency(tx.shares * tx.price)}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
};

export default TransactionHistory;
