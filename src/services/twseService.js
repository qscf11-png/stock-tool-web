// 台股即時報價服務
// 多層 API 來源策略（含 JSONP 直連 TWSE，無需 CORS proxy）

import { getChineseName } from '../utils/stockNames';

// === 環境偵測 ===
const isDev = import.meta.env.DEV;
const LOCAL_API = '/api/localBackend';

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
        return null;
    }
};

/**
 * 透過 CORS proxy 取得 JSON 資料
 * 多重備援策略確保即時報價可用性
 * 依可靠度由高到低嘗試
 */
const fetchViaProxy = async (targetUrl, timeout = 8000) => {
    const proxies = [
        // 策略 1: corsproxy.io
        { url: `https://corsproxy.io/?${encodeURIComponent(targetUrl)}`, wrapper: false },
        // 策略 2: Corsfix (2025 新服務，較穩定)
        { url: `https://proxy.corsfix.com/?${encodeURIComponent(targetUrl)}`, wrapper: false },
        // 策略 3: allorigins（wrapper JSON 格式）
        { url: `https://api.allorigins.win/get?url=${encodeURIComponent(targetUrl)}`, wrapper: true },
        // 策略 4: allorigins raw（直接取得內容）
        { url: `https://api.allorigins.win/raw?url=${encodeURIComponent(targetUrl)}`, wrapper: false },
        // 策略 5: ThingProxy
        { url: `https://thingproxy.freeboard.io/fetch/${targetUrl}`, wrapper: false },
        // 策略 6: cloudflare cors anywhere
        { url: `https://test.cors.workers.dev/?${targetUrl}`, wrapper: false },
    ];

    for (const proxy of proxies) {
        try {
            const resp = await fetchWithTimeout(proxy.url, {}, timeout);
            if (resp?.ok) {
                if (proxy.wrapper) {
                    const wrapper = await resp.json();
                    if (wrapper?.contents) return JSON.parse(wrapper.contents);
                } else {
                    return await resp.json();
                }
            }
        } catch { /* 嘗試下一個 proxy */ }
    }

    return null;
};

// =====================================================
// JSONP 方式直連 TWSE MIS（不受 CORS 限制，生產環境最可靠）
// =====================================================
let jsonpCounter = 0;

/**
 * 透過 JSONP 直接取得 TWSE MIS 即時報價
 * TWSE MIS 支援 callback 參數，可繞過 CORS 限制
 */
const fetchViaJsonp = (url, timeout = 8000) => {
    return new Promise((resolve) => {
        const callbackName = `twse_jsonp_cb_${Date.now()}_${jsonpCounter++}`;
        const script = document.createElement('script');
        let resolved = false;

        const cleanup = () => {
            if (script.parentNode) script.parentNode.removeChild(script);
            delete window[callbackName];
        };

        const timer = setTimeout(() => {
            if (!resolved) {
                resolved = true;
                cleanup();
                resolve(null);
            }
        }, timeout);

        window[callbackName] = (data) => {
            if (!resolved) {
                resolved = true;
                clearTimeout(timer);
                cleanup();
                resolve(data);
            }
        };

        // TWSE MIS 支援 callback 參數
        const separator = url.includes('?') ? '&' : '?';
        script.src = `${url}${separator}_=${Date.now()}&callback=${callbackName}`;
        script.onerror = () => {
            if (!resolved) {
                resolved = true;
                clearTimeout(timer);
                cleanup();
                resolve(null);
            }
        };
        document.head.appendChild(script);
    });
};

// Helper: 解析 TWSE 買賣價格式 (例如 "1915.00_1910.00_")
const parseBestPrice = (valStr) => {
    if (!valStr || valStr === '-') return NaN;
    return parseFloat(valStr.split('_')[0]);
};

// =====================================================
// TWSE MIS 即時報價解析（最快、最權威）
// =====================================================
const parseTwseMisData = (data, symbol) => {
    if (!data?.msgArray?.length) return null;
    // 同一股票可能有 tse_ 與 otc_ 兩筆，優先取有即時成交價 (z) 的
    const stock = data.msgArray.find(s => s.c === symbol && parseFloat(s.z) > 0)
        || data.msgArray.find(s => parseFloat(s.z) > 0)
        || data.msgArray.find(s => s.c === symbol)
        || data.msgArray[0];
    if (!stock) return null;

    let realtimePrice = parseFloat(stock.z); // z = 最近成交價（盤中即時）
    // 若無最新成交價，優先取最佳賣價或買價作為現價參考
    if (isNaN(realtimePrice) || realtimePrice <= 0) {
        const askPrice = parseBestPrice(stock.a);
        const bidPrice = parseBestPrice(stock.b);
        if (!isNaN(askPrice) && askPrice > 0) realtimePrice = askPrice;
        else if (!isNaN(bidPrice) && bidPrice > 0) realtimePrice = bidPrice;
    }

    const prevClose = parseFloat(stock.y) || 0; // y = 昨日收盤價
    const isRealtime = !isNaN(realtimePrice) && realtimePrice > 0;
    const price = isRealtime ? realtimePrice : prevClose;
    if (price <= 0) return null;

    const change = price - prevClose;
    return {
        symbol, name: getChineseName(symbol, stock.n || symbol), price,
        change: parseFloat(change.toFixed(2)),
        changePercent: parseFloat((prevClose > 0 ? change / prevClose * 100 : 0).toFixed(2)),
        open: parseFloat(stock.o) || 0, high: parseFloat(stock.h) || 0,
        low: parseFloat(stock.l) || 0, volume: parseInt(stock.v) || 0,
        market: 'tw',
        dataSource: isRealtime ? 'TWSE_MIS' : 'TWSE_MIS_PREV_CLOSE'
    };
};

// =====================================================
// Yahoo Finance 解析
// =====================================================
const parseYahooQuote = (data, symbol) => {
    if (!data?.chart?.result?.[0]) return null;
    const meta = data.chart.result[0].meta;
    const price = meta.regularMarketPrice || 0;
    if (price <= 0) return null;

    const prevClose = meta.chartPreviousClose || meta.previousClose || price;
    const change = price - prevClose;
    const quote = data.chart.result[0].indicators?.quote?.[0];
    return {
        symbol, name: getChineseName(symbol, meta.shortName || symbol), price,
        change: parseFloat(change.toFixed(2)),
        changePercent: parseFloat((prevClose > 0 ? change / prevClose * 100 : 0).toFixed(2)),
        open: quote?.open?.slice(-1)[0] || 0, high: quote?.high?.slice(-1)[0] || 0,
        low: quote?.low?.slice(-1)[0] || 0, volume: quote?.volume?.slice(-1)[0] || 0,
        market: 'tw', dataSource: 'YAHOO_FINANCE'
    };
};

// =====================================================
// 主函式：取得單檔即時報價
// =====================================================
export const fetchStockRealTime = async (symbol) => {
    const twseMisUrl = `https://mis.twse.com.tw/stock/api/getStockInfo.jsp?json=1&delay=0&ex_ch=tse_${symbol}.tw|otc_${symbol}.tw`;

    // 1. 開發環境：使用 Vite Proxy 直連 TWSE MIS
    if (isDev) {
        try {
            const exCh = `tse_${symbol}.tw|otc_${symbol}.tw`;
            const resp = await fetchWithTimeout(`/api/twse/stock/api/getStockInfo.jsp?json=1&delay=0&ex_ch=${exCh}`, {}, 5000);
            if (resp?.ok) {
                const data = await resp.json();
                const result = parseTwseMisData(data, symbol);
                if (result) return result;
            }
        } catch { /* next */ }
    }

    // 2. 生產環境：專屬 Vercel Proxy 直連 TWSE MIS（最可靠）
    if (!isDev) {
        try {
            const vercelUrl = `https://twse-proxy-api.vercel.app/api/stock?ex_ch=${encodeURIComponent('tse_' + symbol + '.tw|otc_' + symbol + '.tw')}`;
            const resp = await fetchWithTimeout(vercelUrl, {}, 6000);
            if (resp?.ok) {
                const data = await resp.json();
                const result = parseTwseMisData(data, symbol);
                if (result) return result;
            }
        } catch { /* next */ }
    }

    // 3. 生產環境備援：CORS Proxy 連 TWSE MIS
    if (!isDev) {
        try {
            const data = await fetchViaProxy(twseMisUrl, 8000);
            const result = parseTwseMisData(data, symbol);
            if (result) return result;
        } catch { /* next */ }
    }

    // 4. 本地後端 (Yahoo Finance)
    try {
        const resp = await fetchWithTimeout(`${LOCAL_API}/stock/${symbol}`, {}, 2000);
        if (resp?.ok) {
            const d = await resp.json();
            if (d?.price > 0) return { ...d, name: getChineseName(symbol, d.name), market: 'tw', dataSource: 'LOCAL_BACKEND' };
        }
    } catch { /* next */ }

    // 5. Yahoo Finance（使用 interval=1d 取得日線，再用 1m 取盤中）
    for (const suffix of ['.TW', '.TWO']) {
        // 嘗試 1d interval（更容易成功）
        try {
            const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}${suffix}?interval=1d&range=5d`;
            const data = isDev
                ? await fetchWithTimeout(url, {}, 5000).then(r => r?.ok ? r.json() : null)
                : await fetchViaProxy(url, 8000);
            const result = parseYahooQuote(data, symbol);
            if (result) return result;
        } catch { /* next */ }
        // 嘗試 1m interval（盤中即時）
        try {
            const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}${suffix}?interval=1m&range=1d`;
            const data = isDev
                ? await fetchWithTimeout(url, {}, 5000).then(r => r?.ok ? r.json() : null)
                : await fetchViaProxy(url, 8000);
            const result = parseYahooQuote(data, symbol);
            if (result) return result;
        } catch { continue; }
    }

    return null;
};

/**
 * 歷史 K 線（非關鍵，失敗回傳空）
 */
export const fetchStockHistory = async (symbol, range = '2y', interval = '1d') => {
    // 本地後端
    try {
        const resp = await fetchWithTimeout(`${LOCAL_API}/history/${symbol}?range=${range}&interval=${interval}`, {}, 2000);
        if (resp?.ok) { const d = await resp.json(); if (d) return d; }
    } catch { /* next */ }

    // Yahoo Finance
    for (const suffix of ['.TW', '.TWO']) {
        try {
            const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}${suffix}?interval=${interval}&range=${range}`;
            let data;
            if (isDev) {
                const resp = await fetchWithTimeout(url, {}, 8000);
                if (resp?.ok) data = await resp.json();
            } else {
                data = await fetchViaProxy(url, 10000);
            }
            if (data?.chart?.result?.[0]) {
                const result = data.chart.result[0];
                const ts = result.timestamp || [];
                const q = result.indicators?.quote?.[0] || {};
                const history = ts.map((t, i) => ({
                    date: new Date(t * 1000).toISOString().split('T')[0],
                    open: q.open?.[i] || 0, high: q.high?.[i] || 0,
                    low: q.low?.[i] || 0, close: q.close?.[i] || 0,
                    volume: q.volume?.[i] || 0
                })).filter(d => d.close > 0);
                if (history.length > 0) return { history };
            }
        } catch { continue; }
    }
    return { history: [] };
};

/**
 * 批次查詢多檔（TWSE MIS 一次查詢）
 */
export const fetchMultipleStocks = async (symbols) => {
    /**
     * 內部函式：解析 TWSE MIS 批次回傳資料
     */
    const parseBatchResults = (data) => {
        if (!data?.msgArray) return null;
        const results = {};
        const stockMap = new Map();
        data.msgArray.forEach(stock => {
            const sym = stock.c;
            if (!sym) return;
            const hasRealtime = !isNaN(parseFloat(stock.z)) && parseFloat(stock.z) > 0;
            if (!stockMap.has(sym) || hasRealtime) {
                stockMap.set(sym, stock);
            }
        });

        stockMap.forEach((stock, sym) => {
            let realtimePrice = parseFloat(stock.z);
            if (isNaN(realtimePrice) || realtimePrice <= 0) {
                const askPrice = parseBestPrice(stock.a);
                const bidPrice = parseBestPrice(stock.b);
                if (!isNaN(askPrice) && askPrice > 0) realtimePrice = askPrice;
                else if (!isNaN(bidPrice) && bidPrice > 0) realtimePrice = bidPrice;
            }

            const prevClose = parseFloat(stock.y) || 0;
            const isRealtime = !isNaN(realtimePrice) && realtimePrice > 0;
            const price = isRealtime ? realtimePrice : prevClose;
            if (price > 0) {
                const change = price - prevClose;
                results[sym] = {
                    symbol: sym, name: getChineseName(sym, stock.n || sym), price,
                    change: parseFloat(change.toFixed(2)),
                    changePercent: parseFloat((prevClose > 0 ? change / prevClose * 100 : 0).toFixed(2)),
                    open: parseFloat(stock.o) || 0, high: parseFloat(stock.h) || 0,
                    low: parseFloat(stock.l) || 0, volume: parseInt(stock.v) || 0,
                    market: 'tw',
                    dataSource: isRealtime ? 'TWSE_MIS' : 'TWSE_MIS_PREV_CLOSE'
                };
            }
        });
        return Object.keys(results).length > 0 ? results : null;
    };

    // === TWSE MIS 批次查詢（分批避免 API 限制）===
    const TWSE_BATCH_SIZE = 15; // 每批最多 15 檔，避免 API 回傳不完整
    const twseResults = {};

    // 1. 開發環境：Vite Proxy
    if (isDev) {
        for (let i = 0; i < symbols.length; i += TWSE_BATCH_SIZE) {
            const batch = symbols.slice(i, i + TWSE_BATCH_SIZE);
            const exCh = batch.map(s => `tse_${s}.tw|otc_${s}.tw`).join('|');
            try {
                const resp = await fetchWithTimeout(`/api/twse/stock/api/getStockInfo.jsp?json=1&delay=0&ex_ch=${exCh}`, {}, 8000);
                if (resp?.ok) {
                    const data = await resp.json();
                    const results = parseBatchResults(data);
                    if (results) Object.assign(twseResults, results);
                }
            } catch { /* next */ }
        }
        if (Object.keys(twseResults).length > 0) {
            console.log(`✅ Vite Proxy 批次成功: ${Object.keys(twseResults).length} 檔`);
        }
    }

    // 2. 生產環境：JSONP + CORS Proxy 分批查詢
    if (!isDev) {
        for (let i = 0; i < symbols.length; i += TWSE_BATCH_SIZE) {
            const batch = symbols.slice(i, i + TWSE_BATCH_SIZE);
            const exCh = batch.map(s => `tse_${s}.tw|otc_${s}.tw`).join('|');
            const twseMisUrl = `https://mis.twse.com.tw/stock/api/getStockInfo.jsp?json=1&delay=0&ex_ch=${exCh}`;

            // 優先嘗試專屬 Vercel Proxy
            try {
                const vercelUrl = `https://twse-proxy-api.vercel.app/api/stock?ex_ch=${encodeURIComponent(exCh)}`;
                const resp = await fetchWithTimeout(vercelUrl, {}, 8000);
                if (resp?.ok) {
                    const data = await resp.json();
                    const results = parseBatchResults(data);
                    if (results) {
                        Object.assign(twseResults, results);
                        continue; // 這批成功，跳到下一批
                    }
                }
            } catch { /* next */ }

            // 備援：JSONP
            try {
                const data = await fetchViaJsonp(twseMisUrl, 8000);
                const results = parseBatchResults(data);
                if (results) {
                    Object.assign(twseResults, results);
                    continue; // 這批成功，跳到下一批
                }
            } catch { /* next */ }

            // JSONP 失敗則嘗試 CORS Proxy
            try {
                const data = await fetchViaProxy(twseMisUrl, 10000);
                const results = parseBatchResults(data);
                if (results) Object.assign(twseResults, results);
            } catch { /* next */ }
        }
        if (Object.keys(twseResults).length > 0) {
            console.log(`✅ TWSE MIS 批次成功: ${Object.keys(twseResults).length} 檔`);
        }
    }

    // === 檢查缺漏的股票，用 Yahoo Finance 補齊 ===
    const missingSymbols = symbols.filter(s => !twseResults[s]);
    if (missingSymbols.length > 0) {
        console.log(`⚠️ TWSE MIS 缺少 ${missingSymbols.length} 檔，使用 Yahoo Finance 補齊: ${missingSymbols.join(', ')}`);

        // 本地後端嘗試
        try {
            const resp = await fetchWithTimeout(`${LOCAL_API}/stocks`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ symbols: missingSymbols })
            }, 3000);
            if (resp?.ok) {
                const localResults = await resp.json();
                Object.assign(twseResults, localResults);
            }
        } catch { /* next */ }

        // 仍缺漏的逐檔用 Yahoo Finance 查詢
        const stillMissing = missingSymbols.filter(s => !twseResults[s]);
        if (stillMissing.length > 0) {
            console.log(`🔄 逐檔 Yahoo 查詢 ${stillMissing.length} 檔...`);
            const yahooPromises = stillMissing.map(async (symbol) => {
                for (const suffix of ['.TW', '.TWO']) {
                    try {
                        const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}${suffix}?interval=1d&range=5d`;
                        const data = isDev
                            ? await fetchWithTimeout(url, {}, 5000).then(r => r?.ok ? r.json() : null)
                            : await fetchViaProxy(url, 8000);
                        const result = parseYahooQuote(data, symbol);
                        if (result) return { [symbol]: result };
                    } catch { /* next */ }
                }
                return {};
            });
            const yahooResults = await Promise.allSettled(yahooPromises);
            yahooResults.forEach(r => {
                if (r.status === 'fulfilled') Object.assign(twseResults, r.value);
            });
        }
    }

    console.log(`📊 最終報價結果: ${Object.keys(twseResults).length}/${symbols.length} 檔`);
    return twseResults;
};

export const checkApiHealth = async () => {
    try { const r = await fetchWithTimeout(`${LOCAL_API}/health`, {}, 2000); return r?.ok || false; } catch { return false; }
};
export const fetchTwseRealTime = fetchStockRealTime;
export const fetchTwseFundamentals = async () => null;
