// 台股即時報價服務
// 使用多個 API 來源，優先使用可直接在瀏覽器端呼叫的方案
// 1. Yahoo Finance (透過 CORS proxy)
// 2. 本地後端 (開發環境)
// 3. Fallback 到 null

// CORS Proxy 列表（依序嘗試）
const CORS_PROXIES = [
    'https://api.allorigins.win/raw?url=',
    'https://corsproxy.io/?',
];

// 本地後端（開發環境用）
const LOCAL_API = 'http://localhost:3001/api';

/**
 * 嘗試透過 CORS proxy 呼叫 URL
 */
const fetchWithProxy = async (url, timeout = 8000) => {
    for (const proxy of CORS_PROXIES) {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), timeout);

            const response = await fetch(proxy + encodeURIComponent(url), {
                signal: controller.signal
            });
            clearTimeout(timeoutId);

            if (response.ok) {
                return await response.json();
            }
        } catch (e) {
            console.warn(`Proxy ${proxy} 失敗:`, e.message);
        }
    }
    return null;
};

/**
 * 從 Yahoo Finance 取得個股報價
 */
const fetchFromYahoo = async (symbol) => {
    // 台股在 Yahoo Finance 的代號格式: 2330.TW (上市) 或 6547.TWO (上櫃)
    const twSymbol = `${symbol}.TW`;
    const twoSymbol = `${symbol}.TWO`;

    // 先嘗試上市 (.TW)
    const yahooUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${twSymbol}?interval=1d&range=1d`;
    let data = await fetchWithProxy(yahooUrl);

    // 如果上市沒資料，嘗試上櫃 (.TWO)
    if (!data || data?.chart?.error) {
        const yahooUrlTwo = `https://query1.finance.yahoo.com/v8/finance/chart/${twoSymbol}?interval=1d&range=1d`;
        data = await fetchWithProxy(yahooUrlTwo);
    }

    if (data?.chart?.result?.[0]) {
        const result = data.chart.result[0];
        const meta = result.meta;
        const quote = result.indicators?.quote?.[0];

        const price = meta.regularMarketPrice || 0;
        const prevClose = meta.chartPreviousClose || meta.previousClose || price;
        const change = price - prevClose;
        const changePercent = prevClose > 0 ? ((change / prevClose) * 100) : 0;

        return {
            symbol: symbol,
            name: meta.shortName || meta.symbol || symbol,
            price: price,
            change: parseFloat(change.toFixed(2)),
            changePercent: parseFloat(changePercent.toFixed(2)),
            open: quote?.open?.[quote.open.length - 1] || 0,
            high: quote?.high?.[quote.high.length - 1] || 0,
            low: quote?.low?.[quote.low.length - 1] || 0,
            volume: quote?.volume?.[quote.volume.length - 1] || 0,
            market: 'tw',
            dataSource: 'YAHOO_FINANCE'
        };
    }

    return null;
};

/**
 * 從本地後端取得報價（開發環境用）
 */
const fetchFromLocalBackend = async (symbol) => {
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3000);

        const response = await fetch(`${LOCAL_API}/stock/${symbol}`, {
            signal: controller.signal
        });
        clearTimeout(timeoutId);

        if (!response.ok) return null;

        const data = await response.json();
        if (data && data.price > 0) {
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
                dataSource: data.dataSource || 'LOCAL_BACKEND'
            };
        }
    } catch (e) {
        // 本地後端不可用，靜默跳過
    }
    return null;
};

/**
 * 從本地後端取得股票報價（主函式）
 * 依序嘗試：本地後端 → Yahoo Finance (CORS proxy)
 */
export const fetchStockRealTime = async (symbol) => {
    try {
        console.log(`🔍 [${symbol}] 查詢股票報價...`);

        // 1. 嘗試本地後端（開發環境快速回應）
        const localData = await fetchFromLocalBackend(symbol);
        if (localData) {
            console.log(`✅ [${symbol}] ${localData.name} @ $${localData.price} (本地後端)`);
            return localData;
        }

        // 2. 嘗試 Yahoo Finance (CORS proxy)
        console.log(`🌐 [${symbol}] 嘗試 Yahoo Finance...`);
        const yahooData = await fetchFromYahoo(symbol);
        if (yahooData && yahooData.price > 0) {
            console.log(`✅ [${symbol}] ${yahooData.name} @ $${yahooData.price} (Yahoo Finance)`);
            return yahooData;
        }

        console.warn(`⚠️ [${symbol}] 所有 API 來源都無法取得報價`);
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

        // 嘗試本地後端
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 3000);
            const response = await fetch(`${LOCAL_API}/history/${symbol}?range=${range}&interval=${interval}`, {
                signal: controller.signal
            });
            clearTimeout(timeoutId);
            if (response.ok) return await response.json();
        } catch (e) { /* 靜默跳過 */ }

        // 嘗試 Yahoo Finance (CORS proxy)
        const twSymbol = `${symbol}.TW`;
        const yahooUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${twSymbol}?interval=${interval}&range=${range}`;
        const data = await fetchWithProxy(yahooUrl);
        if (data?.chart?.result?.[0]) {
            return data.chart.result[0];
        }

        return null;
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
        // 嘗試本地後端批次查詢
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 3000);
            const response = await fetch(`${LOCAL_API}/stocks`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ symbols }),
                signal: controller.signal
            });
            clearTimeout(timeoutId);
            if (response.ok) return await response.json();
        } catch (e) { /* 靜默跳過 */ }

        // Fallback: 逐一查詢
        const results = {};
        for (const symbol of symbols) {
            const data = await fetchStockRealTime(symbol);
            if (data) results[symbol] = data;
        }
        return results;
    } catch (error) {
        console.error('批次查詢失敗:', error.message);
        return {};
    }
};

// 檢查後端是否可用
export const checkApiHealth = async () => {
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 2000);
        const response = await fetch(`${LOCAL_API}/health`, { signal: controller.signal });
        clearTimeout(timeoutId);
        return response.ok;
    } catch {
        return false;
    }
};

// 舊 API 相容
export const fetchTwseRealTime = fetchStockRealTime;
export const fetchTwseFundamentals = async () => null;
