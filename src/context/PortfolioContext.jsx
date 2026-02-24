import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
import { fetchStockData } from '../services/mockDataService';
import { getStrategyAdvice } from '../utils/strategyUtils';
import * as XLSX from 'xlsx';

const PortfolioContext = createContext();

export const usePortfolio = () => {
    const context = useContext(PortfolioContext);
    if (!context) {
        throw new Error('usePortfolio must be used within PortfolioProvider');
    }
    return context;
};

export const PortfolioProvider = ({ children }) => {
    // transactions: { id, symbol, type: 'BUY'|'SELL', shares, price, date }
    const [transactions, setTransactions] = useState([]);
    const [stockDataMap, setStockDataMap] = useState({});
    const [watchlist, setWatchlist] = useState([]);
    const [watchlistSettings, setWatchlistSettings] = useState({});
    const [pinnedSymbols, setPinnedSymbols] = useState([]); // 被釘選的標的
    const [watchlistCategoryCache, setWatchlistCategoryCache] = useState({}); // 緩存分類建議
    const [loading, setLoading] = useState(false);
    const [isLoaded, setIsLoaded] = useState(false); // 新增：確保讀取完成後才允許寫入

    // Load data from localStorage on mount
    useEffect(() => {
        const savedTx = localStorage.getItem('tw-stock-transactions');
        if (savedTx) {
            try {
                const parsed = JSON.parse(savedTx);
                setTransactions(parsed);
                const symbols = [...new Set(parsed.map(t => t.symbol))];
                symbols.forEach(symbol => loadStockData(symbol));
            } catch (e) {
                console.error('Failed to load transactions:', e);
            }
        }

        const savedWatchlist = localStorage.getItem('tw-stock-watchlist');
        if (savedWatchlist) {
            try {
                const parsed = JSON.parse(savedWatchlist);
                setWatchlist(parsed);
                parsed.forEach(symbol => loadStockData(symbol));
            } catch (e) {
                console.error('Failed to load watchlist:', e);
            }
        }

        const savedWatchlistSettings = localStorage.getItem('tw-stock-watchlist-settings');
        if (savedWatchlistSettings) {
            try {
                setWatchlistSettings(JSON.parse(savedWatchlistSettings));
            } catch (e) {
                console.error('Failed to load watchlist settings:', e);
            }
        }
        const savedPinned = localStorage.getItem('tw-stock-pinned-symbols');
        if (savedPinned) setPinnedSymbols(JSON.parse(savedPinned));

        // 標記讀取完成
        setIsLoaded(true);
    }, []);

    useEffect(() => {
        if (!isLoaded) return;
        localStorage.setItem('tw-stock-pinned-symbols', JSON.stringify(pinnedSymbols));
    }, [pinnedSymbols, isLoaded]);

    // 定期或在變動時更新分類緩存
    useEffect(() => {
        const newCache = {};
        watchlist.forEach(symbol => {
            const history = stockDataMap[symbol]?.history;
            const settings = watchlistSettings[symbol] || { maShort: 18, maLong: 52, analysisMode: 'short' };
            if (history && history.length > 5) {
                const advice = getStrategyAdvice(history, settings.maShort, settings.maLong, settings.analysisMode);
                newCache[symbol] = advice;
            }
        });
        setWatchlistCategoryCache(newCache);
    }, [watchlist, watchlistSettings, stockDataMap]);

    // Save data to localStorage
    useEffect(() => {
        if (!isLoaded) return;
        localStorage.setItem('tw-stock-transactions', JSON.stringify(transactions));
    }, [transactions, isLoaded]);

    useEffect(() => {
        if (!isLoaded) return;
        localStorage.setItem('tw-stock-watchlist', JSON.stringify(watchlist));
    }, [watchlist, isLoaded]);

    useEffect(() => {
        if (!isLoaded) return;
        localStorage.setItem('tw-stock-watchlist-settings', JSON.stringify(watchlistSettings));
    }, [watchlistSettings, isLoaded]);

    // Derive holdings from transactions
    const holdings = useMemo(() => {
        const map = {};

        transactions.forEach(t => {
            if (!map[t.symbol]) {
                map[t.symbol] = {
                    symbol: t.symbol,
                    shares: 0,
                    totalCost: 0,
                    realizedPL: 0
                };
            }

            const h = map[t.symbol];

            if (t.type === 'BUY') {
                h.shares += t.shares;
                h.totalCost += t.shares * t.price;
            } else if (t.type === 'SELL') {
                // Calculate realized P/L for this transaction
                // FIFO or Average Cost? Using Average Cost for simplicity
                const avgCost = h.shares > 0 ? h.totalCost / h.shares : 0;
                const costBasis = t.shares * avgCost;
                const proceed = t.shares * t.price;

                h.realizedPL += (proceed - costBasis);
                h.shares -= t.shares;
                h.totalCost -= costBasis;
            }
        });

        // Convert map to array and filter out zero shares (optional, or keep for history)
        // Keeping them if they have realized P/L might be useful, but for "Holdings" list we usually show active ones.
        // Let's return active holdings for the main list, but we might need another list for "Closed Positions"
        return Object.values(map)
            .filter(h => h.shares > 0) // Only active holdings
            .map(h => ({
                symbol: h.symbol,
                shares: h.shares,
                avgCost: h.shares > 0 ? h.totalCost / h.shares : 0,
                currentPrice: stockDataMap[h.symbol]?.price || 0,
                history: stockDataMap[h.symbol]?.history || []
            }));
    }, [transactions, stockDataMap]);

    const loadStockData = async (symbol) => {
        // 如果已經有歷史數據，且不是正在加載，則跳過
        if (stockDataMap[symbol]?.history && !loading) return;

        setLoading(true);
        try {
            const { fetchStockHistory } = await import('../services/twseService');
            const [realTimeData, historyData] = await Promise.all([
                fetchStockData(symbol),
                fetchStockHistory(symbol)
            ]);

            if (realTimeData) {
                setStockDataMap(prev => ({
                    ...prev,
                    [symbol]: {
                        ...realTimeData,
                        history: historyData?.history || []
                    }
                }));
            }
        } catch (error) {
            console.error(`Failed to load data for ${symbol}:`, error);
        } finally {
            setLoading(false);
        }
    };

    const addTransaction = async (transaction) => {
        // transaction: { symbol, type, shares, price, date }
        const newTx = {
            ...transaction,
            id: Date.now().toString(),
            shares: parseFloat(transaction.shares),
            price: parseFloat(transaction.price)
        };

        // If it's a new symbol, fetch data
        if (!stockDataMap[newTx.symbol]) {
            const data = await fetchStockData(newTx.symbol);
            if (!data && newTx.type === 'BUY') {
                // Only strict check on BUY, SELL might be possible if we have history (but here we check map)
                // Actually we should check if symbol exists in API
                throw new Error('股票代號不存在');
            }
            if (data) {
                setStockDataMap(prev => ({ ...prev, [newTx.symbol]: data }));
            }
        }

        setTransactions(prev => [...prev, newTx]);
    };

    // Deprecated: Adapter for old addHolding calls
    const addHolding = async (symbol, shares, avgCost) => {
        await addTransaction({
            symbol,
            type: 'BUY',
            shares,
            price: avgCost,
            date: new Date().toISOString().split('T')[0]
        });
    };

    const deleteHolding = (symbol) => {
        setTransactions(prev => prev.filter(t => t.symbol !== symbol));
    };

    const togglePinSymbol = (symbol) => {
        setPinnedSymbols(prev =>
            prev.includes(symbol) ? prev.filter(s => s !== symbol) : [...prev, symbol]
        );
    };

    const updateWatchlistSettings = (symbol, settings) => {
        setWatchlistSettings(prev => ({
            ...prev,
            [symbol]: {
                ...(prev[symbol] || { maShort: 18, maLong: 52, analysisMode: 'short' }),
                ...settings
            }
        }));
    };

    const addWatchSymbol = async (symbol) => {
        if (watchlist.includes(symbol)) return;

        const data = await fetchStockData(symbol);
        if (!data) {
            throw new Error('股票代號不存在');
        }

        setStockDataMap(prev => ({ ...prev, [symbol]: data }));
        setWatchlist(prev => [...prev, symbol]);
    };

    const removeWatchSymbol = (symbol) => {
        setWatchlist(prev => prev.filter(s => s !== symbol));
    };

    const exportWatchlist = () => {
        const data = {
            version: '1.0',
            exportDate: new Date().toISOString(),
            watchlist,
            settings: watchlistSettings,
            pinnedSymbols: pinnedSymbols
        };
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `watchlist_dna_${new Date().toISOString().split('T')[0]}.json`;
        a.click();
    };

    const importWatchlist = async (file) => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const data = JSON.parse(e.target.result);
                    let importedWatchlist = [];
                    let importedSettings = {};

                    if (Array.isArray(data)) {
                        // Legacy format (just array)
                        importedWatchlist = data;
                    } else if (data && data.watchlist) {
                        // New format with settings
                        importedWatchlist = data.watchlist;
                        importedSettings = data.settings || {};
                    }

                    if (importedWatchlist.length > 0) {
                        setWatchlist(prev => [...new Set([...prev, ...importedWatchlist])]);
                        setWatchlistSettings(prev => ({ ...prev, ...importedSettings }));
                        importedWatchlist.forEach(s => loadStockData(s));
                        resolve(true);
                    } else {
                        reject(new Error('檔案中找不到有效的標的清單'));
                    }
                } catch (error) {
                    reject(error);
                }
            };
            reader.readAsText(file);
        });
    };

    const refreshPrices = async () => {
        setLoading(true);
        try {
            // Get all unique symbols from transactions
            const symbols = [...new Set(transactions.map(t => t.symbol))];

            for (const symbol of symbols) {
                const data = await fetchStockData(symbol);
                if (data) {
                    setStockDataMap(prev => ({
                        ...prev,
                        [symbol]: data
                    }));
                }
            }
        } finally {
            setLoading(false);
        }
    };

    const getRealizedPL = (startDate, endDate) => {
        let realized = 0;
        const holdingMap = {}; // Track cost basis for each symbol

        // Process all transactions chronologically to track cost basis
        const sortedTx = [...transactions].sort((a, b) => new Date(a.date) - new Date(b.date));

        sortedTx.forEach(t => {
            if (!holdingMap[t.symbol]) {
                holdingMap[t.symbol] = { shares: 0, totalCost: 0 };
            }
            const h = holdingMap[t.symbol];

            if (t.type === 'BUY') {
                h.shares += t.shares;
                h.totalCost += t.shares * t.price;
            } else if (t.type === 'SELL') {
                const avgCost = h.shares > 0 ? h.totalCost / h.shares : 0;
                const costBasis = t.shares * avgCost;
                const proceed = t.shares * t.price;

                // Only count if within date range
                if (t.date >= startDate && t.date <= endDate) {
                    realized += (proceed - costBasis);
                }

                h.shares -= t.shares;
                h.totalCost -= costBasis;
            }
        });

        return realized;
    };

    const exportData = () => {
        const data = {
            version: '1.0',
            exportDate: new Date().toISOString(),
            transactions,
            stockDataMap
        };
        const dataStr = JSON.stringify(data, null, 2);
        const dataBlob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(dataBlob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `portfolio_backup_${new Date().toISOString().slice(0, 10)}.json`;
        link.click();
        URL.revokeObjectURL(url);
    };

    const importData = async (file) => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const imported = JSON.parse(e.target.result);
                    if (imported.transactions) {
                        setTransactions(imported.transactions);
                        if (imported.stockDataMap) {
                            setStockDataMap(prev => ({ ...prev, ...imported.stockDataMap }));
                        }
                        resolve(true);
                    } else {
                        reject(new Error('Invalid data format: missing transactions'));
                    }
                } catch (error) {
                    reject(error);
                }
            };
            reader.onerror = (error) => reject(error);
            reader.readAsText(file);
        });
    };

    const exportToExcel = () => {
        const wb = XLSX.utils.book_new();

        // Sheet 1: Transactions
        const txData = transactions.map(t => ({
            Date: t.date,
            Type: t.type === 'BUY' ? '買入' : '賣出',
            Symbol: t.symbol,
            Name: stockDataMap[t.symbol]?.name || '',
            Shares: t.shares,
            Price: t.price,
            Total: t.shares * t.price,
            ID: t.id
        }));
        const wsTx = XLSX.utils.json_to_sheet(txData);
        XLSX.utils.book_append_sheet(wb, wsTx, "Transactions");

        // Sheet 2: Active Holdings
        const holdingsData = holdings.map(h => {
            const marketValue = h.shares * h.currentPrice;
            const pl = marketValue - (h.shares * h.avgCost);
            const ret = h.avgCost > 0 ? (pl / (h.shares * h.avgCost)) * 100 : 0;
            return {
                Symbol: h.symbol,
                Name: stockDataMap[h.symbol]?.name || '',
                Shares: h.shares,
                AvgCost: h.avgCost,
                CurrentPrice: h.currentPrice,
                MarketValue: marketValue,
                PL: pl,
                ReturnPercent: ret
            };
        });
        const wsHoldings = XLSX.utils.json_to_sheet(holdingsData);
        XLSX.utils.book_append_sheet(wb, wsHoldings, "Holdings");

        XLSX.writeFile(wb, `portfolio_export_${new Date().toISOString().slice(0, 10)}.xlsx`);
    };

    const importFromExcel = async (file) => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    // cellDates: true ensures dates are parsed as JS Date objects if formatted correctly in Excel
                    const workbook = XLSX.read(e.target.result, { type: 'array', cellDates: true });
                    const sheetName = workbook.SheetNames.find(n => n.toLowerCase().includes('transaction') || n.toLowerCase().includes('交易'));

                    if (!sheetName) {
                        reject(new Error('找不到 "Transactions" 或 "交易" 工作表'));
                        return;
                    }

                    const sheet = workbook.Sheets[sheetName];
                    const jsonData = XLSX.utils.sheet_to_json(sheet);

                    if (jsonData.length === 0) {
                        resolve(true); // Empty is fine, just nothing imported
                        return;
                    }

                    // Map Excel columns to transaction object
                    // Expected columns: Date, Type (買入/賣出 or BUY/SELL), Symbol, Shares, Price
                    const newTransactions = jsonData.map((row, index) => {
                        let type = 'BUY';
                        const rowType = row['Type'] || row['交易類別'] || '';
                        if (rowType === '賣出' || rowType.toUpperCase() === 'SELL') type = 'SELL';

                        // Handle Date parsing
                        let dateRaw = row['Date'] || row['日期'] || new Date();
                        let dateStr = '';

                        if (dateRaw instanceof Date) {
                            // If cellDates: true worked
                            dateStr = dateRaw.toISOString().split('T')[0];
                        } else if (typeof dateRaw === 'number') {
                            // Fallback for serial numbers (Excel days since 1900)
                            // 25569 is the offset for 1970-01-01
                            const dateObj = new Date(Math.round((dateRaw - 25569) * 86400 * 1000));
                            dateStr = dateObj.toISOString().split('T')[0];
                        } else {
                            // Assume string 'YYYY-MM-DD' or similar
                            dateStr = String(dateRaw).trim();
                        }

                        return {
                            id: row['ID'] || `excel-import-${Date.now()}-${index}`,
                            date: dateStr,
                            type: type,
                            symbol: String(row['Symbol'] || row['股票代號']),
                            shares: parseFloat(row['Shares'] || row['股數'] || 0),
                            price: parseFloat(row['Price'] || row['價格'] || 0)
                        };
                    }).filter(t => t.symbol && t.shares > 0 && t.price > 0);

                    // Merge strategy: Overwrite or Append? 
                    // Current behavior for JSON import was overwrite. Let's stick to overwrite transactions for consistency if user confirmed "Overwrite".
                    // But usually Excel import might be appending data. 
                    // Let's assume OVERWRITE for now to match JSON behavior, or we can make it an option.
                    // The App.jsx confirmation says "Import will overwrite".

                    setTransactions(newTransactions);

                    // Refresh stock data for imported symbols
                    const uniqueSymbols = [...new Set(newTransactions.map(t => t.symbol))];
                    uniqueSymbols.forEach(s => loadStockData(s));

                    resolve(true);
                } catch (error) {
                    reject(error);
                }
            };
            reader.onerror = (error) => reject(error);
            reader.readAsArrayBuffer(file);
        });
    };

    const importWatchlistFromExcel = async (file) => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const workbook = XLSX.read(e.target.result, { type: 'array' });
                    const sheetName = workbook.SheetNames[0];
                    const sheet = workbook.Sheets[sheetName];
                    const jsonData = XLSX.utils.sheet_to_json(sheet);

                    if (jsonData.length === 0) {
                        resolve(true);
                        return;
                    }

                    const newSettings = {};
                    const newWatchlist = jsonData
                        .map(row => {
                            const symbol = String(row['Symbol'] || row['股票代號'] || '').trim();
                            if (symbol) {
                                const maShort = Number(row['MA Short'] || row['短期均線'] || 20);
                                const maLong = Number(row['MA Long'] || row['長期均線'] || 60);
                                newSettings[symbol] = { maShort, maLong };
                            }
                            return symbol;
                        })
                        .filter(s => s.length > 0);

                    if (newWatchlist.length > 0) {
                        setWatchlist(prev => [...new Set([...prev, ...newWatchlist])]);
                        setWatchlistSettings(prev => ({ ...prev, ...newSettings }));
                        newWatchlist.forEach(s => loadStockData(s));
                        resolve(true);
                    } else {
                        reject(new Error('Excel 中找不到有效的股票代號 (請確保欄位名稱為 Symbol 或 股票代號)'));
                    }
                } catch (error) {
                    reject(error);
                }
            };
            reader.onerror = (error) => reject(error);
            reader.readAsArrayBuffer(file);
        });
    };


    const value = {
        holdings,
        transactions,
        watchlist,
        stockDataMap,
        loading,
        addTransaction,
        addHolding,
        deleteHolding,
        addWatchSymbol,
        removeWatchSymbol,
        refreshPrices,
        loadStockData,
        getRealizedPL,
        exportData,
        importData,
        exportToExcel,
        importFromExcel,
        exportWatchlist,
        importWatchlist,
        importWatchlistFromExcel,
        watchlistSettings,
        updateWatchlistSettings,
        pinnedSymbols,
        togglePinSymbol,
        watchlistCategoryCache
    };

    return (
        <PortfolioContext.Provider value={value}>
            {children}
        </PortfolioContext.Provider>
    );
};
