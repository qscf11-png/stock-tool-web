import { fetchStockRealTime } from './twseService';
import { getSectorBySymbol } from '../utils/stockSectors';
import { getChineseName } from '../utils/stockNames';

export const USE_REAL_API = true;

// Helper to generate random fundamentals for new stocks
export const generateMockFundamentals = (price, symbol, name = '') => {
    const sector = getSectorBySymbol(symbol, name);
    return {
        roe: (Math.random() * 20 + 5).toFixed(2),
        pe: (Math.random() * 30 + 10).toFixed(2),
        pb: (Math.random() * 5 + 0.8).toFixed(2),
        dividendYield: (Math.random() * 6).toFixed(2),
        beta: (Math.random() * 1.5 + 0.5).toFixed(2),
        volatility: (Math.random() * 30 + 10).toFixed(1),
        ma20: (price * (1 + (Math.random() * 0.1 - 0.05))).toFixed(2),
        ma60: (price * (1 + (Math.random() * 0.2 - 0.1))).toFixed(2),
        sector
    };
};

/**
 * 補全股票資料 (產業資訊 + 基本面)
 */
export const complementStockData = (symbol, rawData) => {
    if (!rawData || !rawData.price) return rawData;

    const fundamentals = generateMockFundamentals(rawData.price, symbol, rawData.name);
    return {
        ...fundamentals,
        ...rawData,
        sector: fundamentals.sector // 確保 sector 存在
    };
};

/**
 * Fetch stock data (Hybrid: Real API + Mock Fallback)
 * 優先使用 Yahoo Finance API，失敗時 fallback 到 Mock 資料
 */
export const fetchStockData = async (symbol) => {
    let stockData = null;
    let fetchError = null;

    // 1. Try Real API if enabled
    if (USE_REAL_API) {
        try {
            console.log(`🔍 [${symbol}] 嘗試取得即時報價...`);
            const realData = await fetchStockRealTime(symbol);

            if (realData && realData.price > 0) {
                // 優先使用中文名稱對照表
                const chineseName = getChineseName(symbol, realData.name);
                const sector = getSectorBySymbol(symbol, chineseName);
                const fundamentals = generateMockFundamentals(realData.price, symbol);

                stockData = {
                    ...fundamentals,
                    ...realData,
                    name: chineseName, // 使用中文名稱
                    sector,
                };

                console.log(`✅ [${symbol}] ${chineseName} @ $${realData.price} (${realData.dataSource})`);
                return stockData;
            } else {
                fetchError = `API 回傳無效資料`;
                console.warn(`⚠️ [${symbol}] ${fetchError}`);
            }
        } catch (e) {
            console.warn(`❌ [${symbol}] API 錯誤:`, e.message);
            fetchError = e.message;
        }
    }

    // 2. Fallback (移除寫死的 Mock 資料，改為拋出錯誤讓呼叫端處理 or 返回空)
    if (fetchError) {
        console.error(`❌ [${symbol}] 無法取得有效市場報價: ${fetchError}`);
        // 可以選擇拋出錯誤 或 返回帶有錯誤訊息的物件
        throw new Error(`無法取得 ${symbol} 之市場報價`);
    }

    return null;
};

// Mock news data
export const mockNews = [
    {
        id: 1,
        title: '台積電先進製程需求強勁，法人看好Q4營收',
        sector: '半導體',
        stocks: ['2330'],
        date: '2025-12-01'
    },
    {
        id: 2,
        title: '鴻海電動車業務加速，與特斯拉洽談合作',
        sector: '電子製造',
        stocks: ['2317'],
        date: '2025-11-30'
    }
];

// Fetch news related to stocks/sectors
export const fetchRelatedNews = async (holdings) => {
    await new Promise(resolve => setTimeout(resolve, 200));
    const holdingSymbols = holdings.map(h => h.symbol);
    return mockNews.filter(news => news.stocks.some(s => holdingSymbols.includes(s)));
};
