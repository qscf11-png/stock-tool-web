/**
 * 策略工具函式：實作金唬男投資體系邏輯
 */

/**
 * 計算簡單移動平均線 (SMA)
 */
export const calculateMA = (data, period) => {
    const ma = [];
    for (let i = 0; i < data.length; i++) {
        if (i < period - 1) {
            ma.push(null);
            continue;
        }
        const sum = data.slice(i - period + 1, i + 1).reduce((acc, d) => acc + d.close, 0);
        ma.push(sum / period);
    }
    return ma;
};

/**
 * 核心：二日法則驗證邏輯
 * 規則：
 * 1. 突破驗證：今日站上均線為 Day 1，隔日高點必須過今日高點則驗證成功 (Day 2)。
 * 2. 跌破驗證：今日跌破均線為 Day 1，隔日低點必須破今日低點則驗證成功 (Day 2)。
 * 3. 上帝的禮物：跌破均線 (Day 1) 後，隔日 (Day 2) 未破低且收復或收紅，為強力洗盤買點。
 */
export const checkTwoDayRule = (history, maValue) => {
    if (history.length < 3) return { status: 'TRENDING' };

    const today = history[history.length - 1];
    const yesterday = history[history.length - 2];
    const dayBefore = history[history.length - 3];

    // CASE A: 驗證「昨天」剛發生的突破 (今天就是 Day 2)
    // 昨天站上，前天在下
    if (yesterday.close > maValue && dayBefore.close <= maValue) {
        if (today.high > yesterday.high) return { type: 'BREAKOUT', status: 'VALIDATED' }; // 二日法則驗證成功
        return { type: 'BREAKOUT', status: 'FAILED' }; // 二日法則失敗（假突破或洗盤預備）
    }

    // CASE B: 驗證「昨天」剛發生的跌破 (今天就是 Day 2)
    // 昨天跌破，前天在上
    if (yesterday.close < maValue && dayBefore.close >= maValue) {
        if (today.low < yesterday.low) return { type: 'BREAKDOWN', status: 'VALIDATED' }; // 二日法則驗證跌破
        return { type: 'WASHOUT', status: 'GIFT' }; // 跌破不創新低 = 上帝的禮物 (洗盤)
    }

    // CASE C: 「今天」剛發生突破 (Day 1)
    if (today.close > maValue && yesterday.close <= maValue) {
        return { type: 'BREAKOUT', status: 'WATCH' };
    }

    // CASE D: 「今天」剛發生跌破 (Day 1)
    if (today.close < maValue && yesterday.close >= maValue) {
        return { type: 'BREAKDOWN', status: 'WATCH' };
    }

    // 其他情況：處於穩定趨勢中
    return { type: 'TREND', status: 'STABLE' };
};

/**
 * 1% 損傷率部位規模計算
 */
export const calculatePositionSize = (totalAssets, entryPrice, stopLossPrice) => {
    if (entryPrice <= stopLossPrice) return 0;
    const riskPerShare = entryPrice - stopLossPrice;
    const totalRiskAllowed = totalAssets * 0.01;
    return Math.floor(totalRiskAllowed / riskPerShare);
};

/**
 * 狀態識別與操作建議
 */
export const getStrategyAdvice = (history, maShortPeriod, maLongPeriod, mode = 'short') => {
    if (!history || history.length < Math.max(maShortPeriod, maLongPeriod) + 3) {
        return { advice: '數據不足，無法提供建議', status: 'WAITING', color: 'text-gray-400' };
    }

    const shortMA = calculateMA(history, maShortPeriod);
    const longMA = calculateMA(history, maLongPeriod);

    const lastPrice = history[history.length - 1].close;
    const lastShortMA = shortMA[shortMA.length - 1];
    const lastLongMA = longMA[longMA.length - 1];

    const primaryMAValue = mode === 'short' ? lastShortMA : lastLongMA;
    const maName = mode === 'short' ? `短期均線(MA${maShortPeriod})` : `長期均線(MA${maLongPeriod})`;

    const rule = checkTwoDayRule(history, primaryMAValue);

    // 1. 特殊強訊號優先：上帝的禮物
    if (rule.type === 'WASHOUT' && rule.status === 'GIFT') {
        return {
            advice: `出現「上帝的禮物」洗盤訊號！股價跌破 ${maName} 但今日未破昨日低點。這是機構洗盤的徵兆，適合進場。`,
            status: 'GIFT_BUY',
            color: 'text-orange-500',
            reason: '跌破不創新低（洗盤確認）'
        };
    }

    // 2. 剛發生 (Day 1)
    if (rule.status === 'WATCH') {
        if (rule.type === 'BREAKOUT') {
            return {
                advice: `股價今日站上 ${maName} (Day 1)。進入二日法則觀察期，隔日高點若過今日高點即確認多頭。`,
                status: 'WATCH_BREAKOUT',
                color: 'text-yellow-500',
                reason: '初步突破，等待 Day 2 驗證'
            };
        } else {
            return {
                advice: `股價今日跌破 ${maName} (Day 1)。進入二日法則觀察期，隔日低點若破今日低點即確認趨勢轉弱。`,
                status: 'WATCH_BREAKDOWN',
                color: 'text-yellow-600',
                reason: '初步跌破，等待 Day 2 驗證'
            };
        }
    }

    // 3. 驗證成功 (Day 2 Confirm)
    if (rule.status === 'VALIDATED') {
        if (rule.type === 'BREAKOUT') {
            return {
                advice: `二日法則驗證成功！高點已過昨日高點。確認站穩 ${maName}，是明確的加碼或買進訊號。`,
                status: 'BULLISH_CONFIRMED',
                color: 'text-red-500',
                reason: '站穩重要均線（時間與價格驗證）'
            };
        } else {
            return {
                advice: `二日法則跌破確認。今日低點已破昨日低點。建議大幅減碼或空手觀望。`,
                status: 'BEARISH_CONFIRMED',
                color: 'text-green-500',
                reason: '跌破趨勢確認'
            };
        }
    }

    // 4. 驗證失敗 (可能是洗盤或盤整)
    if (rule.status === 'FAILED') {
        return {
            advice: `二日法則驗證失敗。股價雖然站上 ${maName} 但未創新高。建議觀望，不宜在此重倉。`,
            status: 'CONSOLIDATING',
            color: 'text-gray-300',
            reason: '假突破或盤整中'
        };
    }

    // 5. 穩定趨勢中 (STABLE) - 修復用戶提到的「方向未明」問題
    if (lastPrice > primaryMAValue) {
        return {
            advice: `股價穩定運行於 ${maName} 之上。目前處於強勢多頭慣性，持股續抱，關注乖離率。`,
            status: 'BULLISH_TREND',
            color: 'text-red-400',
            reason: '處於穩定多頭軌道'
        };
    } else {
        return {
            advice: `股價運行於 ${maName} 之下。目前趨勢偏弱，建議空手觀望，靜待二日法則再度翻多。`,
            status: 'BEARISH_TREND',
            color: 'text-green-600',
            reason: '處於穩定空頭軌道'
        };
    }
};
