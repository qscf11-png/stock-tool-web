// Service to fetch Taiwan stock data
// 使用本地後端 API (Yahoo Finance) 取得台股資料

const API_BASE_URL = 'http://localhost:3001/api';

/**
 * 從本地後端取得股票報價
 */
export const fetchStockRealTime = async (symbol) => {
    try {
        console.log(`🔍 [${symbol}] 查詢股票報價...`);

        const response = await fetch(`${API_BASE_URL}/stock/${symbol}`);

        if (!response.ok) {
            if (response.status === 404) {
                console.warn(`❌ [${symbol}] 查無資料`);
                return null;
            }
            throw new Error(`HTTP ${response.status}`);
        }

        const data = await response.json();

        if (data && data.price > 0) {
            console.log(`✅ [${symbol}] ${data.name} @ $${data.price}`);
            return {
                symbol: data.symbol,
                name: data.name,
                price: data.price,
                change: data.change,
                changePercent: data.changePercent,
                open: data.open,
                high: data.high,
                low: data.low,
                volume: data.volume,
                market: 'tw',
                dataSource: data.dataSource || 'YAHOO_FINANCE'
            };
        }

        return null;
    } catch (error) {
        console.error(`❌ [${symbol}] API 錯誤:`, error.message);
        return null;
    }
};

/**
 * 從本地後端取得股票歷史 K 線資料
 */
export const fetchStockHistory = async (symbol, range = '2y', interval = '1d') => {
    try {
        console.log(`🔍 [${symbol}] 查詢歷史資料 (${range})...`);
        const response = await fetch(`${API_BASE_URL}/history/${symbol}?range=${range}&interval=${interval}`);

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        return await response.json();
    } catch (error) {
        console.error(`❌ [${symbol}] 歷史資料 API 錯誤:`, error.message);
        return null;
    }
};

/**
 * 批次查詢多檔股票
 */
export const fetchMultipleStocks = async (symbols) => {
    try {
        const response = await fetch(`${API_BASE_URL}/stocks`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ symbols })
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        return await response.json();
    } catch (error) {
        console.error('批次查詢失敗:', error.message);
        return {};
    }
};

// 檢查後端是否可用
export const checkApiHealth = async () => {
    try {
        const response = await fetch(`${API_BASE_URL}/health`);
        return response.ok;
    } catch {
        return false;
    }
};

// 舊 API 相容
export const fetchTwseRealTime = fetchStockRealTime;
export const fetchTwseFundamentals = async () => null;
