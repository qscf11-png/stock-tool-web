// 台股即時報價服務
// 多層 API 來源策略，確保在各種環境（本機開發 / GitHub Pages）都能取得數據
//
// API 優先順序：
// 1. 本地後端 (localhost:3001) - 開發環境最快
// 2. TWSE 即時報價 (mis.twse.com.tw) - 透過 Vite proxy 或直接呼叫
// 3. Yahoo Finance (query1.finance.yahoo.com) - 透過 CORS proxy

// === 環境偵測 ===
const isDev = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
const LOCAL_API = 'http://localhost:3001/api';

// === CORS Proxy（僅 production 使用）===
const CORS_PROXY = 'https://api.allorigins.win/raw?url=';

/**
 * 帶超時的 fetch
 */
const fetchWithTimeout = async (url, options = {}, timeout = 5000) => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    try {
        const response = await fetch(url, { ...options, signal: controller.signal });
        clearTimeout(timeoutId);
        return response;
    } catch (e) {
        clearTimeout(timeoutId);
        throw e;
    }
};

// =====================================================
// 方法 1: 本地後端（開發環境）
// =====================================================
const fetchFromLocalBackend = async (symbol) => {
    try {
        const response = await fetchWithTimeout(`${LOCAL_API}/stock/${symbol}`, {}, 2000);
        if (!response.ok) return null;
        const data = await response.json();
        if (data && data.price > 0) {
            return {
                symbol: data.symbol, name: data.name, price: data.price,
                change: data.change, changePercent: data.changePercent,
                open: data.open, high: data.high, low: data.low, volume: data.volume,
                market: 'tw', dataSource: 'LOCAL_BACKEND'
            };
        }
    } catch (e) { /* 本地後端不可用 */ }
    return null;
};

// =====================================================
// 方法 2: TWSE MIS 即時報價 (via Vite Proxy / CORS Proxy)
// =====================================================
const fetchFromTwseMis = async (symbol) => {
    try {
        // 上市: tse_{symbol}.tw  上櫃: otc_{symbol}.tw
        const exCh = `tse_${symbol}.tw|otc_${symbol}.tw`;

        let url;
        if (isDev) {
            // 開發環境：使用 Vite proxy
            url = `/api/twse/stock/api/getStockInfo.jsp?json=1&delay=0&ex_ch=${exCh}`;
        } else {
            // Production：透過 CORS proxy
            const twseUrl = `https://mis.twse.com.tw/stock/api/getStockInfo.jsp?json=1&delay=0&ex_ch=${exCh}`;
            url = CORS_PROXY + encodeURIComponent(twseUrl);
        }

        const response = await fetchWithTimeout(url, {}, 6000);
        if (!response.ok) return null;

        const data = await response.json();
        if (!data?.msgArray?.length) return null;

        // 找到有效的資料（價格 > 0）
        const stock = data.msgArray.find(s => parseFloat(s.z) > 0) || data.msgArray[0];
        if (!stock) return null;

        const price = parseFloat(stock.z) || parseFloat(stock.y) || 0; // z=最新成交價, y=昨收
        const prevClose = parseFloat(stock.y) || 0;
        const change = price - prevClose;
        const changePercent = prevClose > 0 ? (change / prevClose * 100) : 0;

        if (price <= 0) return null;

        return {
            symbol: symbol,
            name: stock.n || symbol, // n=股票名稱
            price: price,
            change: parseFloat(change.toFixed(2)),
            changePercent: parseFloat(changePercent.toFixed(2)),
            open: parseFloat(stock.o) || 0,    // o=開盤
            high: parseFloat(stock.h) || 0,    // h=最高
            low: parseFloat(stock.l) || 0,     // l=最低
            volume: parseInt(stock.v) || 0,    // v=累積成交量
            market: 'tw',
            dataSource: 'TWSE_MIS'
        };
    } catch (e) {
        console.warn(`[${symbol}] TWSE MIS 查詢失敗:`, e.message);
    }
    return null;
};

// =====================================================
// 方法 3: Yahoo Finance (via CORS Proxy)
// =====================================================
const fetchFromYahoo = async (symbol) => {
    try {
        // 嘗試 .TW (上市) 和 .TWO (上櫃)
        for (const suffix of ['.TW', '.TWO']) {
            const yahooUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}${suffix}?interval=1d&range=1d`;
            const url = isDev ? yahooUrl : CORS_PROXY + encodeURIComponent(yahooUrl);

            try {
                const response = await fetchWithTimeout(url, {}, 6000);
                if (!response.ok) continue;

                const data = await response.json();
                if (!data?.chart?.result?.[0]) continue;

                const result = data.chart.result[0];
                const meta = result.meta;
                const price = meta.regularMarketPrice || 0;
                if (price <= 0) continue;

                const prevClose = meta.chartPreviousClose || meta.previousClose || price;
                const change = price - prevClose;
                const changePercent = prevClose > 0 ? (change / prevClose * 100) : 0;
                const quote = result.indicators?.quote?.[0];

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
            } catch (e) { continue; }
        }
    } catch (e) {
        console.warn(`[${symbol}] Yahoo Finance 查詢失敗:`, e.message);
    }
    return null;
};

// =====================================================
// 主函式：依序嘗試各 API 來源
// =====================================================
export const fetchStockRealTime = async (symbol) => {
    console.log(`🔍 [${symbol}] 查詢股票報價...`);

    // 1. 本地後端（最快，僅開發環境有效）
    const localData = await fetchFromLocalBackend(symbol);
    if (localData) {
        console.log(`✅ [${symbol}] ${localData.name} @ $${localData.price} (本地後端)`);
        return localData;
    }

    // 2. TWSE 即時報價（最權威，且可同時查上市+上櫃）
    const twseData = await fetchFromTwseMis(symbol);
    if (twseData) {
        console.log(`✅ [${symbol}] ${twseData.name} @ $${twseData.price} (TWSE MIS)`);
        return twseData;
    }

    // 3. Yahoo Finance（備援）
    const yahooData = await fetchFromYahoo(symbol);
    if (yahooData) {
        console.log(`✅ [${symbol}] ${yahooData.name} @ $${yahooData.price} (Yahoo Finance)`);
        return yahooData;
    }

    console.warn(`⚠️ [${symbol}] 所有 API 來源均無法取得報價`);
    return null;
};

/**
 * 歷史 K 線資料
 */
export const fetchStockHistory = async (symbol, range = '2y', interval = '1d') => {
    try {
        console.log(`🔍 [${symbol}] 查詢歷史資料 (${range})...`);

        // 嘗試本地後端
        try {
            const response = await fetchWithTimeout(`${LOCAL_API}/history/${symbol}?range=${range}&interval=${interval}`, {}, 2000);
            if (response.ok) {
                const data = await response.json();
                if (data) return data;
            }
        } catch (e) { /* 靜默跳過 */ }

        // Yahoo Finance 歷史數據
        for (const suffix of ['.TW', '.TWO']) {
            try {
                const yahooUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}${suffix}?interval=${interval}&range=${range}`;
                const url = isDev ? yahooUrl : CORS_PROXY + encodeURIComponent(yahooUrl);
                const response = await fetchWithTimeout(url, {}, 8000);
                if (!response.ok) continue;

                const data = await response.json();
                if (data?.chart?.result?.[0]) {
                    const result = data.chart.result[0];
                    const timestamps = result.timestamp || [];
                    const quote = result.indicators?.quote?.[0] || {};

                    const history = timestamps.map((ts, i) => ({
                        date: new Date(ts * 1000).toISOString().split('T')[0],
                        open: quote.open?.[i] || 0,
                        high: quote.high?.[i] || 0,
                        low: quote.low?.[i] || 0,
                        close: quote.close?.[i] || 0,
                        volume: quote.volume?.[i] || 0
                    })).filter(d => d.close > 0);

                    if (history.length > 0) {
                        return { history };
                    }
                }
            } catch (e) { continue; }
        }

        return null;
    } catch (error) {
        console.error(`❌ [${symbol}] 歷史資料 API 錯誤:`, error.message);
        return null;
    }
};

/**
 * 批次查詢多檔股票（使用 TWSE MIS 一次查多檔）
 */
export const fetchMultipleStocks = async (symbols) => {
    const results = {};

    // 嘗試本地後端批次查詢
    try {
        const response = await fetchWithTimeout(`${LOCAL_API}/stocks`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ symbols })
        }, 3000);
        if (response.ok) return await response.json();
    } catch (e) { /* 靜默跳過 */ }

    // TWSE MIS 一次最多支援多檔合併查詢
    try {
        const exCh = symbols.map(s => `tse_${s}.tw|otc_${s}.tw`).join('|');
        let url;
        if (isDev) {
            url = `/api/twse/stock/api/getStockInfo.jsp?json=1&delay=0&ex_ch=${exCh}`;
        } else {
            const twseUrl = `https://mis.twse.com.tw/stock/api/getStockInfo.jsp?json=1&delay=0&ex_ch=${exCh}`;
            url = CORS_PROXY + encodeURIComponent(twseUrl);
        }

        const response = await fetchWithTimeout(url, {}, 8000);
        if (response.ok) {
            const data = await response.json();
            if (data?.msgArray) {
                data.msgArray.forEach(stock => {
                    const sym = stock.c; // c=股票代號
                    const price = parseFloat(stock.z) || parseFloat(stock.y) || 0;
                    if (price > 0 && sym) {
                        const prevClose = parseFloat(stock.y) || 0;
                        results[sym] = {
                            symbol: sym, name: stock.n || sym, price,
                            change: parseFloat((price - prevClose).toFixed(2)),
                            changePercent: parseFloat((prevClose > 0 ? (price - prevClose) / prevClose * 100 : 0).toFixed(2)),
                            open: parseFloat(stock.o) || 0, high: parseFloat(stock.h) || 0,
                            low: parseFloat(stock.l) || 0, volume: parseInt(stock.v) || 0,
                            market: 'tw', dataSource: 'TWSE_MIS'
                        };
                    }
                });
            }
        }
        if (Object.keys(results).length > 0) return results;
    } catch (e) { /* 靜默跳過 */ }

    // Fallback: 平行查詢每一檔
    const promises = symbols.map(s => fetchStockRealTime(s).then(data => data ? { [s]: data } : {}));
    const allResults = await Promise.all(promises);
    return Object.assign({}, ...allResults);
};

// 檢查後端是否可用
export const checkApiHealth = async () => {
    try {
        const response = await fetchWithTimeout(`${LOCAL_API}/health`, {}, 2000);
        return response.ok;
    } catch {
        return false;
    }
};

// 舊 API 相容
export const fetchTwseRealTime = fetchStockRealTime;
export const fetchTwseFundamentals = async () => null;
