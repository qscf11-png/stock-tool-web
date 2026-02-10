// 從 TWSE/TPEX 官方 API 取得完整股票清單並生成中文名稱對照表

import fs from 'fs';

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function fetchTwseStocks() {
    console.log('📊 正在取得上市股票清單...');
    try {
        const response = await fetch('https://www.twse.com.tw/exchangeReport/STOCK_DAY_ALL?response=json', {
            headers: { 'User-Agent': 'Mozilla/5.0' }
        });
        const data = await response.json();

        if (data.data && Array.isArray(data.data)) {
            const stocks = {};
            for (const item of data.data) {
                // item: [代號, 名稱, 成交股數, 成交金額, 開盤價, 最高價, 最低價, 收盤價, 漲跌價差, 成交筆數]
                const symbol = item[0];
                const name = item[1];
                if (symbol && name) {
                    stocks[symbol] = name;
                }
            }
            console.log(`✅ 取得 ${Object.keys(stocks).length} 檔上市股票`);
            return stocks;
        }
    } catch (error) {
        console.error('❌ TWSE API 錯誤:', error.message);
    }
    return {};
}

async function fetchTpexStocks() {
    console.log('📊 正在取得上櫃股票清單...');
    try {
        const response = await fetch('https://www.tpex.org.tw/openapi/v1/tpex_mainboard_quotes', {
            headers: { 'User-Agent': 'Mozilla/5.0' }
        });
        const data = await response.json();

        if (Array.isArray(data)) {
            const stocks = {};
            for (const item of data) {
                const symbol = item.SecuritiesCompanyCode;
                const name = item.CompanyName;
                if (symbol && name) {
                    stocks[symbol] = name;
                }
            }
            console.log(`✅ 取得 ${Object.keys(stocks).length} 檔上櫃股票`);
            return stocks;
        }
    } catch (error) {
        console.error('❌ TPEX API 錯誤:', error.message);
    }
    return {};
}

async function generateStockNamesFile() {
    console.log('\n🚀 開始取得台灣股票清單...\n');

    const twseStocks = await fetchTwseStocks();
    await delay(1000);
    const tpexStocks = await fetchTpexStocks();

    const allStocks = { ...twseStocks, ...tpexStocks };
    const totalCount = Object.keys(allStocks).length;

    console.log(`\n📋 共取得 ${totalCount} 檔股票`);

    // 生成 JavaScript 檔案
    let output = `// 台股中文名稱對照表（自動生成）
// 產生時間: ${new Date().toISOString()}
// 上市: ${Object.keys(twseStocks).length} 檔, 上櫃: ${Object.keys(tpexStocks).length} 檔

export const stockNameMap = {\n`;

    // 按代號排序
    const sortedSymbols = Object.keys(allStocks).sort((a, b) => a.localeCompare(b, 'zh-TW', { numeric: true }));

    for (const symbol of sortedSymbols) {
        const name = allStocks[symbol].replace(/'/g, "\\'"); // 避免單引號問題
        output += `    '${symbol}': '${name}',\n`;
    }

    output += `};

/**
 * 取得股票中文名稱
 * @param {string} symbol - 股票代號
 * @param {string} fallback - 若查無中文名稱時的預設值
 * @returns {string} 股票中文名稱
 */
export const getChineseName = (symbol, fallback = '') => {
    return stockNameMap[symbol] || fallback || \`股票 \${symbol}\`;
};

/**
 * 檢查是否有中文名稱
 * @param {string} symbol - 股票代號
 * @returns {boolean}
 */
export const hasChineseName = (symbol) => {
    return symbol in stockNameMap;
};

export default stockNameMap;
`;

    // 寫入檔案
    fs.writeFileSync('./src/utils/stockNames.js', output, 'utf8');
    console.log(`\n✅ 已生成 src/utils/stockNames.js (${totalCount} 檔股票)`);
}

generateStockNamesFile().catch(console.error);
