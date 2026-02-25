// 台股即時報價服務
// 多層 API 來源策略

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
        return null;
    }
};

/**
 * 透過 CORS proxy 取得 JSON 資料
 * 使用 corsproxy.io（最穩定）+ allorigins /get 備援
 */
const fetchViaProxy = async (targetUrl, timeout = 6000) => {
    // 策略 1: corsproxy.io
    try {
        const resp = await fetchWithTimeout(
            `https://corsproxy.io/?${encodeURIComponent(targetUrl)}`, {}, timeout
        );
        if (resp?.ok) return await resp.json();
    } catch { /* next */ }

    // 策略 2: allorigins /get（回傳 wrapper JSON）
    try {
        const resp = await fetchWithTimeout(
            `https://api.allorigins.win/get?url=${encodeURIComponent(targetUrl)}`, {}, timeout
        );
        if (resp?.ok) {
            const wrapper = await resp.json();
            if (wrapper?.contents) return JSON.parse(wrapper.contents);
        }
    } catch { /* next */ }

    return null;
};

// =====================================================
// TWSE MIS 即時報價（最快、最權威）
// =====================================================
const parseTwseMisData = (data, symbol) => {
    if (!data?.msgArray?.length) return null;
    const stock = data.msgArray.find(s => parseFloat(s.z) > 0) || data.msgArray[0];
    if (!stock) return null;

    const price = parseFloat(stock.z) || parseFloat(stock.y) || 0;
    if (price <= 0) return null;

    const prevClose = parseFloat(stock.y) || 0;
    const change = price - prevClose;
    return {
        symbol, name: stock.n || symbol, price,
        change: parseFloat(change.toFixed(2)),
        changePercent: parseFloat((prevClose > 0 ? change / prevClose * 100 : 0).toFixed(2)),
        open: parseFloat(stock.o) || 0, high: parseFloat(stock.h) || 0,
        low: parseFloat(stock.l) || 0, volume: parseInt(stock.v) || 0,
        market: 'tw', dataSource: 'TWSE_MIS'
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
        symbol, name: meta.shortName || symbol, price,
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
    // 1. 本地後端
    try {
        const resp = await fetchWithTimeout(`${LOCAL_API}/stock/${symbol}`, {}, 2000);
        if (resp?.ok) {
            const d = await resp.json();
            if (d?.price > 0) return { ...d, market: 'tw', dataSource: 'LOCAL_BACKEND' };
        }
    } catch { /* next */ }

    // 2. TWSE MIS
    try {
        const exCh = `tse_${symbol}.tw|otc_${symbol}.tw`;
        let data;
        if (isDev) {
            const resp = await fetchWithTimeout(`/api/twse/stock/api/getStockInfo.jsp?json=1&delay=0&ex_ch=${exCh}`, {}, 5000);
            if (resp?.ok) data = await resp.json();
        } else {
            data = await fetchViaProxy(`https://mis.twse.com.tw/stock/api/getStockInfo.jsp?json=1&delay=0&ex_ch=${exCh}`, 6000);
        }
        const result = parseTwseMisData(data, symbol);
        if (result) return result;
    } catch { /* next */ }

    // 3. Yahoo Finance
    for (const suffix of ['.TW', '.TWO']) {
        try {
            const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}${suffix}?interval=1d&range=1d`;
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
    // 本地後端
    try {
        const resp = await fetchWithTimeout(`${LOCAL_API}/stocks`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ symbols })
        }, 3000);
        if (resp?.ok) return await resp.json();
    } catch { /* next */ }

    // TWSE MIS 批次
    try {
        const exCh = symbols.map(s => `tse_${s}.tw|otc_${s}.tw`).join('|');
        let data;
        if (isDev) {
            const resp = await fetchWithTimeout(`/api/twse/stock/api/getStockInfo.jsp?json=1&delay=0&ex_ch=${exCh}`, {}, 8000);
            if (resp?.ok) data = await resp.json();
        } else {
            data = await fetchViaProxy(`https://mis.twse.com.tw/stock/api/getStockInfo.jsp?json=1&delay=0&ex_ch=${exCh}`, 10000);
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
    } catch { /* next */ }

    // Fallback: 平行個別查詢
    const all = await Promise.all(symbols.map(s => fetchStockRealTime(s).then(d => d ? { [s]: d } : {})));
    return Object.assign({}, ...all);
};

export const checkApiHealth = async () => {
    try { const r = await fetchWithTimeout(`${LOCAL_API}/health`, {}, 2000); return r?.ok || false; } catch { return false; }
};
export const fetchTwseRealTime = fetchStockRealTime;
export const fetchTwseFundamentals = async () => null;
