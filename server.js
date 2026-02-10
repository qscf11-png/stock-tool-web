// 股票資料 API 後端伺服器
// 使用 Yahoo Finance v8 chart API 取得台股即時報價

import express from 'express';
import cors from 'cors';

const app = express();
const PORT = 3001;

// 啟用 CORS
app.use(cors());
app.use(express.json());

/**
 * 從 Yahoo Finance API 取得股票資料
 * @param {string} symbol - 股票代號（如 2330）
 * @param {string} suffix - .TW (上市) 或 .TWO (上櫃)
 */
async function fetchYahooQuote(symbol, suffix = '.TW') {
    const ticker = `${symbol}${suffix}`;
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?interval=1d&range=1d`;

    console.log(`📊 查詢: ${ticker}`);

    try {
        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            }
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        const data = await response.json();

        if (data.chart?.result?.[0]) {
            const result = data.chart.result[0];
            const meta = result.meta;
            const quote = result.indicators?.quote?.[0];

            // 取得最新價格
            const price = meta.regularMarketPrice || 0;
            const prevClose = meta.chartPreviousClose || meta.previousClose || price;
            const change = price - prevClose;
            const changePercent = prevClose !== 0 ? (change / prevClose) * 100 : 0;

            // 取得當日高低開
            const opens = quote?.open?.filter(v => v != null) || [];
            const highs = quote?.high?.filter(v => v != null) || [];
            const lows = quote?.low?.filter(v => v != null) || [];
            const volumes = quote?.volume?.filter(v => v != null) || [];

            return {
                symbol: symbol,
                name: meta.shortName || meta.longName || `股票 ${symbol}`,
                price: price,
                change: change,
                changePercent: changePercent,
                open: opens[0] || price,
                high: Math.max(...highs) || price,
                low: Math.min(...lows) || price,
                volume: volumes.reduce((a, b) => a + b, 0) || 0,
                previousClose: prevClose,
                currency: meta.currency,
                exchange: meta.exchangeName,
                marketState: meta.marketState,
                timestamp: meta.regularMarketTime,
                dataSource: 'YAHOO_FINANCE_V8'
            };
        }

        return null;
    } catch (error) {
        console.error(`❌ [${ticker}] ${error.message}`);
        return null;
    }
}

// 取得單一股票報價
app.get('/api/stock/:symbol', async (req, res) => {
    try {
        const { symbol } = req.params;

        // 先嘗試上市 (.TW)
        let result = await fetchYahooQuote(symbol, '.TW');

        // 若失敗，嘗試上櫃 (.TWO)
        if (!result || result.price === 0) {
            console.log(`🔄 [${symbol}] 嘗試上櫃格式...`);
            result = await fetchYahooQuote(symbol, '.TWO');
        }

        if (result && result.price > 0) {
            console.log(`✅ [${symbol}] ${result.name} @ $${result.price}`);
            res.json(result);
        } else {
            console.warn(`❌ [${symbol}] 查無資料`);
            res.status(404).json({ error: '查無股票資料', symbol });
        }
    } catch (error) {
        console.error(`❌ [${req.params.symbol}] 錯誤:`, error.message);
        res.status(500).json({ error: error.message, symbol: req.params.symbol });
    }
});

// 批次查詢多檔股票
app.post('/api/stocks', async (req, res) => {
    try {
        const { symbols } = req.body;

        if (!Array.isArray(symbols)) {
            return res.status(400).json({ error: 'symbols must be an array' });
        }

        console.log(`📊 批次查詢: ${symbols.join(', ')}`);

        const results = {};

        for (const symbol of symbols) {
            // 先嘗試上市
            let result = await fetchYahooQuote(symbol, '.TW');

            // 若失敗，嘗試上櫃
            if (!result || result.price === 0) {
                result = await fetchYahooQuote(symbol, '.TWO');
            }

            if (result && result.price > 0) {
                results[symbol] = result;
                console.log(`✅ [${symbol}] ${result.name} @ $${result.price}`);
            } else {
                results[symbol] = { error: '查無資料', symbol };
                console.warn(`❌ [${symbol}] 查無資料`);
            }
        }

        res.json(results);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 健康檢查
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
    console.log(`\n🚀 股票資料 API 伺服器已啟動`);
    console.log(`   http://localhost:${PORT}`);
    console.log(`\n📖 API 端點:`);
    console.log(`   GET  /api/stock/:symbol  - 查詢單一股票`);
    console.log(`   POST /api/stocks         - 批次查詢`);
    console.log(`   GET  /api/health         - 健康檢查`);
    console.log(`\n📊 資料來源: Yahoo Finance v8 Chart API\n`);
});
