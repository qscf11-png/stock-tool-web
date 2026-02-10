// Calculate health score for a stock
export const calculateHealthScore = (stockData) => {
    if (!stockData) return 0;

    let score = 50; // Base score

    // Fundamental factors (40 points)
    // ROE score (20 points)
    if (stockData.roe > 20) score += 20;
    else if (stockData.roe > 15) score += 15;
    else if (stockData.roe > 10) score += 10;
    else if (stockData.roe > 5) score += 5;

    // P/E score (10 points) - lower is better, but not too low
    if (stockData.pe >= 10 && stockData.pe <= 15) score += 10;
    else if (stockData.pe >= 8 && stockData.pe <= 20) score += 7;
    else if (stockData.pe >= 5 && stockData.pe <= 25) score += 4;

    // Dividend Yield score (10 points)
    if (stockData.dividendYield > 5) score += 10;
    else if (stockData.dividendYield > 3) score += 7;
    else if (stockData.dividendYield > 2) score += 4;
    else if (stockData.dividendYield > 1) score += 2;

    // Technical factors (30 points)
    const { price, ma20, ma60 } = stockData;

    // Moving average arrangement (30 points)
    if (price > ma20 && ma20 > ma60) {
        // Golden cross - bullish
        score += 30;
    } else if (price < ma20 && ma20 < ma60) {
        // Death cross - bearish
        score += 5;
    } else {
        // Mixed/consolidating
        score += 15;
    }

    return Math.min(100, Math.max(0, score));
};

// Generate detailed health report
export const generateHealthReport = (stockData) => {
    if (!stockData) return [];

    const reasons = [];

    // ROE
    if (stockData.roe > 15) reasons.push({ type: 'good', text: `高 ROE (${stockData.roe}%) 顯示公司獲利能力強勁 (權重+20)` });
    else if (stockData.roe < 5) reasons.push({ type: 'bad', text: `低 ROE (${stockData.roe}%) 顯示獲利能力較弱 (權重+5)` });

    // PE
    if (stockData.pe >= 10 && stockData.pe <= 20) reasons.push({ type: 'good', text: `本益比 (${stockData.pe}) 處於合理區間 (權重+10)` });
    else if (stockData.pe > 25) reasons.push({ type: 'bad', text: `本益比 (${stockData.pe}) 偏高，股價可能過熱 (權重+4)` });

    // Yield
    if (stockData.dividendYield > 4) reasons.push({ type: 'good', text: `高殖利率 (${stockData.dividendYield}%) 提供良好的現金流保護 (權重+10)` });

    // Technical
    const { price, ma20, ma60 } = stockData;
    if (price > ma20 && ma20 > ma60) reasons.push({ type: 'good', text: `技術面呈現多頭排列 (黃金交叉)，趨勢向上 (權重+30)` });
    else if (price < ma20 && ma20 < ma60) reasons.push({ type: 'bad', text: `技術面呈現空頭排列 (死亡交叉)，趨勢向下 (權重+5)` });

    // Volatility
    if (stockData.volatility > 30) reasons.push({ type: 'warning', text: `波動率較高 (${stockData.volatility}%)，適合積極型操作` });

    return reasons;
};

// Get health status label
export const getHealthStatus = (score) => {
    if (score >= 80) return { label: '健康', color: 'text-green-400' };
    if (score >= 60) return { label: '普通', color: 'text-yellow-400' };
    if (score >= 40) return { label: '觀察', color: 'text-orange-400' };
    return { label: '警告', color: 'text-red-400' };
};

// Analyze moving averages
export const analyzeMovingAverages = (stockData) => {
    const { price, ma20, ma60 } = stockData;

    if (price > ma20 && ma20 > ma60) {
        return {
            status: '黃金交叉',
            trend: 'bullish',
            message: '股價站上短期與長期均線，趨勢向上'
        };
    }

    if (price < ma20 && ma20 < ma60) {
        return {
            status: '死亡交叉',
            trend: 'bearish',
            message: '股價跌破短期與長期均線，趨勢向下'
        };
    }

    return {
        status: '糾結中',
        trend: 'neutral',
        message: '均線糾結，方向不明確，建議觀察'
    };
};

// Compare with industry average
export const compareWithIndustry = (value, industryAvg, higherIsBetter = true) => {
    const diff = ((value - industryAvg) / industryAvg * 100).toFixed(1);

    if (Math.abs(diff) < 5) {
        return {
            label: '接近業界平均',
            color: 'text-gray-400'
        };
    }

    const isAbove = value > industryAvg;

    if (higherIsBetter) {
        return {
            label: isAbove ? `優於業界 ${diff}%` : `低於業界 ${Math.abs(diff)}%`,
            color: isAbove ? 'text-green-400' : 'text-red-400'
        };
    } else {
        return {
            label: isAbove ? `高於業界 ${diff}%` : `低於業界 ${Math.abs(diff)}%`,
            color: isAbove ? 'text-red-400' : 'text-green-400'
        };
    }
};
