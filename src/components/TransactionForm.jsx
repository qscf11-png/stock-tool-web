import React, { useState } from 'react';
import { usePortfolio } from '../context/PortfolioContext';
import { X, Calendar } from 'lucide-react';

const TransactionForm = ({ onClose }) => {
    const { addTransaction } = usePortfolio();
    const [symbol, setSymbol] = useState('');
    const [type, setType] = useState('BUY'); // BUY or SELL
    const [shares, setShares] = useState('');
    const [price, setPrice] = useState('');
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');

        if (!symbol || !shares || !price || !date) {
            setError('請填寫所有欄位');
            return;
        }

        if (parseFloat(shares) <= 0 || parseFloat(price) <= 0) {
            setError('股數和價格必須大於0');
            return;
        }

        setLoading(true);
        try {
            await addTransaction({
                symbol,
                type,
                shares: parseFloat(shares),
                price: parseFloat(price),
                date
            });
            onClose();
        } catch (err) {
            setError(err.message || '新增失敗');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
            <div className="card max-w-md w-full mx-4">
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-2xl font-bold">新增交易</h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-white">
                        <X className="w-6 h-6" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                    {/* Type Selection */}
                    <div className="flex gap-2 p-1 bg-slate-700 rounded-lg">
                        <button
                            type="button"
                            onClick={() => setType('BUY')}
                            className={`flex-1 py-2 rounded-md font-medium transition-colors ${type === 'BUY'
                                    ? 'bg-red-500 text-white'
                                    : 'text-gray-400 hover:text-white'
                                }`}
                        >
                            買入
                        </button>
                        <button
                            type="button"
                            onClick={() => setType('SELL')}
                            className={`flex-1 py-2 rounded-md font-medium transition-colors ${type === 'SELL'
                                    ? 'bg-green-500 text-white'
                                    : 'text-gray-400 hover:text-white'
                                }`}
                        >
                            賣出
                        </button>
                    </div>

                    <div>
                        <label className="block text-sm font-medium mb-2">股票代號</label>
                        <input
                            type="text"
                            value={symbol}
                            onChange={(e) => setSymbol(e.target.value)}
                            placeholder="例：2330"
                            className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium mb-2">交易股數</label>
                            <input
                                type="number"
                                value={shares}
                                onChange={(e) => setShares(e.target.value)}
                                placeholder="例：1000"
                                className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium mb-2">成交價格</label>
                            <input
                                type="number"
                                step="0.01"
                                value={price}
                                onChange={(e) => setPrice(e.target.value)}
                                placeholder="例：580"
                                className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium mb-2">交易日期</label>
                        <div className="relative">
                            <input
                                type="date"
                                value={date}
                                onChange={(e) => setDate(e.target.value)}
                                className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                            <Calendar className="absolute right-3 top-2.5 w-5 h-5 text-gray-400 pointer-events-none" />
                        </div>
                    </div>

                    {error && (
                        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-red-400 text-sm">
                            {error}
                        </div>
                    )}

                    <div className="flex gap-3 pt-2">
                        <button
                            type="button"
                            onClick={onClose}
                            className="btn-secondary flex-1"
                            disabled={loading}
                        >
                            取消
                        </button>
                        <button
                            type="submit"
                            className="btn-primary flex-1"
                            disabled={loading}
                        >
                            {loading ? '處理中...' : '確認交易'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default TransactionForm;
