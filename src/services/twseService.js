// 台股即時報價服務
// 多層 API 來源策略，確保在各種環境（本機開發 / GitHub Pages）都能取得數據

// === 環境偵測 ===
const isDev = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
const LOCAL_API = 'http://localhost:3001/api';

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
    } catch {
        clearTimeout(timeoutId);
        throw new Error('Request timeout or network error');
    }
};

/**
 * 透過多個 CORS proxy 嘗試取得 JSON 資料
 * 使用不同策略的 proxy 確保穩定性
 */
const fetchViaProxy = async (targetUrl, timeout = 6000) => {
    // 策略 1: corsproxy.io（直接返回原始回應）
    try {
        const resp = await fetchWithTimeout(
            `https://corsproxy.io/?${encodeURIComponent(targetUrl)}`,
            {}, timeout
        );
        if (resp.ok) return await resp.json();
    } catch { /* 嘗試下一個 */ }

    // 策略 2: allorigins /get 端點（回傳 JSON 包裝的 contents 欄位）
    try {
        const resp = await fetchWithTimeout(
            `https://api.allorigins.win/get?url=${encodeURIComponent(targetUrl)}`,
            {}, timeout
        );
        if (resp.ok) {
            const wrapper = await resp.json();
            if (wrapper?.contents) {
                return JSON.parse(wrapper.contents);
            }
        }
    } catch { /* 嘗試下一個 */ }

    // 策略 3: thingproxy
    try {
        const resp = await fetchWithTimeout(
            `https://thingproxy.freeboard.io/fetch/${targetUrl}`,
            {}, timeout
        );
        if (resp.ok) return await resp.json();
    } catch { /* 全部失敗 */ }

    return null;
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
    } catch { /* 本地後端不可用 */ }
    return null;
};

// =====================================================
// 方法 2: TWSE MIS 即時報價
// =====================================================
const fetchFromTwseMis = async (symbol) => {
    try {
        const exCh = `tse_${symbol}.tw|otc_${symbol}.tw`;
        let data;

        if (isDev) {
            // 開發環境：使用 Vite proxy
            const response = await fetchWithTimeout(
                `/api/twse/stock/api/getStockInfo.jsp?json=1&delay=0&ex_ch=${exCh}`,
                {}, 5000
            );
            if (!response.ok) return null;
            data = await response.json();
        } else {
            // Production：透過 CORS proxy
            const twseUrl = `https://mis.twse.com.tw/stock/api/getStockInfo.jsp?json=1&delay=0&ex_ch=${exCh}`;
            data = await fetchViaProxy(twseUrl, 6000);
        }

        if (!data?.msgArray?.length) return null;

        const stock = data.msgArray.find(s => parseFloat(s.z) > 0) || data.msgArray[0];
        if (!stock) return null;

        const price = parseFloat(stock.z) || parseFloat(stock.y) || 0;
        const prevClose = parseFloat(stock.y) || 0;
        const change = price - prevClose;
        const changePercent = prevClose > 0 ? (change / prevClose * 100) : 0;

        if (price <= 0) return null;

        return {
            symbol, name: stock.n || symbol, price,
            change: parseFloat(change.toFixed(2)),
            changePercent: parseFloat(changePercent.toFixed(2)),
            open: parseFloat(stock.o) || 0, high: parseFloat(stock.h) || 0,
            low: parseFloat(stock.l) || 0, volume: parseInt(stock.v) || 0,
            market: 'tw', dataSource: 'TWSE_MIS'
        };
    } catch {
        console.warn(`[${symbol}] TWSE MIS 查詢失敗`);
    }
    return null;
};

// =====================================================
// 方法 3: Yahoo Finance
// =====================================================
const fetchFromYahoo = async (symbol) => {
    for (const suffix of ['.TW', '.TWO']) {
        try {
            const yahooUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}${suffix}?interval=1d&range=1d`;
            let data;

            if (isDev) {
                const resp = await fetchWithTimeout(yahooUrl, {}, 5000);
                if (!resp.ok) continue;
                data = await resp.json();
            } else {
                data = await fetchViaProxy(yahooUrl, 6000);
            }

            if (!data?.chart?.result?.[0]) continue;

            const meta = data.chart.result[0].meta;
            const price = meta.regularMarketPrice || 0;
            if (price <= 0) continue;

            const prevClose = meta.chartPreviousClose || meta.previousClose || price;
            const change = price - prevClose;
            const changePercent = prevClose > 0 ? (change / prevClose * 100) : 0;
            const quote = data.chart.result[0].indicators?.quote?.[0];

            return {
                symbol, name: meta.shortName || meta.symbol || symbol, price,
                change: parseFloat(change.toFixed(2)),
                changePercent: parseFloat(changePercent.toFixed(2)),
                open: quote?.open?.[quote.open.length - 1] || 0,
                high: quote?.high?.[quote.high.length - 1] || 0,
                low: quote?.low?.[quote.low.length - 1] || 0,
                volume: quote?.volume?.[quote.volume.length - 1] || 0,
                market: 'tw', dataSource: 'YAHOO_FINANCE'
            };
        } catch { continue; }
    }
    return null;
};

// =====================================================
// 主函式
// =====================================================
export const fetchStockRealTime = async (symbol) => {
    console.log(`🔍 [${symbol}] 查詢報價...`);

    // 1. 本地後端
    const localData = await fetchFromLocalBackend(symbol);
    if (localData) { console.log(`✅ [${symbol}] ${localData.name} @ $${localData.price} (本地)`); return localData; }

    // 2. TWSE MIS
    const twseData = await fetchFromTwseMis(symbol);
    if (twseData) { console.log(`✅ [${symbol}] ${twseData.name} @ $${twseData.price} (TWSE)`); return twseData; }

    // 3. Yahoo Finance
    const yahooData = await fetchFromYahoo(symbol);
    if (yahooData) { console.log(`✅ [${symbol}] ${yahooData.name} @ $${yahooData.price} (Yahoo)`); return yahooData; }

    console.warn(`⚠️ [${symbol}] 所有 API 均無法取得報價`);
    return null;
};

/**
 * 歷史 K 線資料（非阻塞：失敗回傳空陣列，不影響主畫面）
 */
export const fetchStockHistory = async (symbol, range = '2y', interval = '1d') => {
    console.log(`📈 [${symbol}] 查詢歷史 (${range})...`);

    // 嘗試本地後端
    try {
        const response = await fetchWithTimeout(
            `${LOCAL_API}/history/${symbol}?range=${range}&interval=${interval}`, {}, 2000
        );
        if (response.ok) {
            const data = await response.json();
            if (data) return data;
        }
    } catch { /* 靜默 */ }

    // Yahoo Finance 歷史數據
    for (const suffix of ['.TW', '.TWO']) {
        try {
            const yahooUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}${suffix}?interval=${interval}&range=${range}`;
            let data;

            if (isDev) {
                const resp = await fetchWithTimeout(yahooUrl, {}, 8000);
                if (!resp.ok) continue;
                data = await resp.json();
            } else {
                data = await fetchViaProxy(yahooUrl, 10000);
            }

            if (!data?.chart?.result?.[0]) continue;

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
                console.log(`✅ [${symbol}] 歷史數據 ${history.length} 筆`);
                return { history };
            }
        } catch { continue; }
    }

    console.warn(`⚠️ [${symbol}] 無法取得歷史數據，分析功能可能受限`);
    return { history: [] }; // 回傳空陣列而非 null，避免下游崩潰
};

/**
 * 批次查詢
 */
export const fetchMultipleStocks = async (symbols) => {
    // 嘗試本地後端
    try {
        const response = await fetchWithTimeout(`${LOCAL_API}/stocks`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ symbols })
        }, 3000);
        if (response.ok) return await response.json();
    } catch { /* 靜默 */ }

    // TWSE MIS 批次查詢
    try {
        const exCh = symbols.map(s => `tse_${s}.tw|otc_${s}.tw`).join('|');
        const twseUrl = `https://mis.twse.com.tw/stock/api/getStockInfo.jsp?json=1&delay=0&ex_ch=${exCh}`;
        let data;

        if (isDev) {
            const resp = await fetchWithTimeout(`/api/twse/stock/api/getStockInfo.jsp?json=1&delay=0&ex_ch=${exCh}`, {}, 5000);
            if (resp.ok) data = await resp.json();
        } else {
            data = await fetchViaProxy(twseUrl, 8000);
        }

        if (data?.msgArray) {
            const results = {};
            data.msgArray.forEach(stock => {
                const sym = stock.c;
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
            if (Object.keys(results).length > 0) return results;
        }
    } catch { /* 靜默 */ }

    // Fallback: 平行查詢
    const promises = symbols.map(s => fetchStockRealTime(s).then(data => data ? { [s]: data } : {}));
    const allResults = await Promise.all(promises);
    return Object.assign({}, ...allResults);
};

// 檢查後端是否可用
export const checkApiHealth = async () => {
    try {
        const response = await fetchWithTimeout(`${LOCAL_API}/health`, {}, 2000);
        return response.ok;
    } catch { return false; }
};

// 舊 API 相容
export const fetchTwseRealTime = fetchStockRealTime;
export const fetchTwseFundamentals = async () => null;
