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
 */
const fetchViaProxy = async (targetUrl, timeout = 6000) => {
    // 策略 1: corsproxy.io（最穩定）
    try {
        const resp = await fetchWithTimeout(
            `https://corsproxy.io/?${encodeURIComponent(targetUrl)}`, {}, timeout
        );
        if (resp?.ok) return await resp.json();
    } catch { /* next */ }

    // 策略 2: allorigins /get（回傳 wrapper JSON，穩定度次之）
    try {
        const resp = await fetchWithTimeout(
            `https://api.allorigins.win/get?url=${encodeURIComponent(targetUrl)}`, {}, timeout
        );
        if (resp?.ok) {
            const wrapper = await resp.json();
            if (wrapper?.contents) return JSON.parse(wrapper.contents);
        }
    } catch { /* next */ }

    // 策略 3: corsproxy.org
    try {
        const resp = await fetchWithTimeout(
            `https://corsproxy.org/?url=${encodeURIComponent(targetUrl)}`, {}, timeout
        );
        if (resp?.ok) return await resp.json();
    } catch { /* next */ }

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

    const realtimePrice = parseFloat(stock.z); // z = 最近成交價（盤中即時）
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

    // 2. 生產環境：JSONP 直連 TWSE MIS（最可靠，不受 CORS 限制）
    if (!isDev) {
        try {
            console.log(`🔗 [${symbol}] JSONP 直連 TWSE MIS...`);
            const data = await fetchViaJsonp(twseMisUrl, 8000);
            const result = parseTwseMisData(data, symbol);
            if (result) {
                console.log(`✅ [${symbol}] JSONP 成功: $${result.price}`);
                return result;
            }
        } catch { /* next */ }
    }

    // 3. 生產環境備援：CORS Proxy 連 TWSE MIS
    if (!isDev) {
        try {
            const data = await fetchViaProxy(twseMisUrl, 6000);
            const result = parseTwseMisData(data, symbol);
            if (result) return result;
        } catch { /* next */ }
    }

    // 4. 本地後端 (Yahoo Finance - 有延遲)
    try {
        const resp = await fetchWithTimeout(`${LOCAL_API}/stock/${symbol}`, {}, 2000);
        if (resp?.ok) {
            const d = await resp.json();
            if (d?.price > 0) return { ...d, name: getChineseName(symbol, d.name), market: 'tw', dataSource: 'LOCAL_BACKEND' };
        }
    } catch { /* next */ }

    // 5. Yahoo Finance（使用 interval=1m 取得盤中即時報價）
    for (const suffix of ['.TW', '.TWO']) {
        try {
            const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}${suffix}?interval=1m&range=1d`;
            let data;
            if (isDev) {
                const resp = await fetchWithTimeout(url, {}, 5000);
                if (resp?.ok) data = await resp.json();
            } else {
                data = await fetchViaProxy(url, 6000);
            }
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
    const exCh = symbols.map(s => `tse_${s}.tw|otc_${s}.tw`).join('|');
    const twseMisUrl = `https://mis.twse.com.tw/stock/api/getStockInfo.jsp?json=1&delay=0&ex_ch=${exCh}`;

    /**
     * 內部函式：解析 TWSE MIS 批次回傳資料
     */
    const parseBatchResults = (data) => {
        if (!data?.msgArray) return null;
        const results = {};
        // 先按股票代號分組，同股票優先取有即時成交價的
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
            const realtimePrice = parseFloat(stock.z);
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

    // 1. 開發環境：Vite Proxy 直連 TWSE MIS 批次
    if (isDev) {
        try {
            const resp = await fetchWithTimeout(`/api/twse/stock/api/getStockInfo.jsp?json=1&delay=0&ex_ch=${exCh}`, {}, 8000);
            if (resp?.ok) {
                const data = await resp.json();
                const results = parseBatchResults(data);
                if (results) return results;
            }
        } catch { /* next */ }
    }

    // 2. 生產環境：JSONP 直連 TWSE MIS（最可靠，不受 CORS 限制）
    if (!isDev) {
        try {
            console.log(`🔗 批次 JSONP 直連 TWSE MIS (${symbols.length} 檔)...`);
            const data = await fetchViaJsonp(twseMisUrl, 10000);
            const results = parseBatchResults(data);
            if (results) {
                console.log(`✅ JSONP 批次成功: ${Object.keys(results).length} 檔`);
                return results;
            }
        } catch { /* next */ }
    }

    // 3. 生產環境備援：CORS Proxy 連 TWSE MIS
    if (!isDev) {
        try {
            const data = await fetchViaProxy(twseMisUrl, 10000);
            const results = parseBatchResults(data);
            if (results) return results;
        } catch { /* next */ }
    }

    // 4. 本地後端 (Yahoo Finance)
    try {
        const resp = await fetchWithTimeout(`${LOCAL_API}/stocks`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ symbols })
        }, 3000);
        if (resp?.ok) return await resp.json();
    } catch { /* next */ }

    // 5. Fallback: 平行個別查詢（每檔會依序嘗試 JSONP → CORS Proxy → Yahoo）
    console.log(`⚠️ 批次查詢全部失敗，改用逐檔查詢 ${symbols.length} 檔...`);
    const all = await Promise.all(symbols.map(s => fetchStockRealTime(s).then(d => d ? { [s]: d } : {})));
    return Object.assign({}, ...all);
};

export const checkApiHealth = async () => {
    try { const r = await fetchWithTimeout(`${LOCAL_API}/health`, {}, 2000); return r?.ok || false; } catch { return false; }
};
export const fetchTwseRealTime = fetchStockRealTime;
export const fetchTwseFundamentals = async () => null;
