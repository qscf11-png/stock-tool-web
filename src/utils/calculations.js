// Format Taiwan dollar amounts
export const formatCurrency = (amount) => {
    return new Intl.NumberFormat('zh-TW', {
        style: 'currency',
        currency: 'TWD',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
    }).format(amount);
};

// Format percentage
export const formatPercentage = (value, decimals = 2) => {
    return `${value >= 0 ? '+' : ''}${value.toFixed(decimals)}%`;
};

// Get color class for P/L (Taiwan style: red=gain, green=loss)
export const getPLColorClass = (value) => {
    if (value > 0) return 'gain'; // Red
    if (value < 0) return 'loss'; // Green
    return 'text-gray-400'; // Neutral
};

// Calculate portfolio metrics
export const calculatePortfolioMetrics = (holdings) => {
    let totalCost = 0;
    let totalMarketValue = 0;

    holdings.forEach(holding => {
        const cost = holding.shares * holding.avgCost;
        const marketValue = holding.shares * holding.currentPrice;
        totalCost += cost;
        totalMarketValue += marketValue;
    });

    const unrealizedPL = totalMarketValue - totalCost;
    const roi = totalCost > 0 ? (unrealizedPL / totalCost * 100) : 0;

    return {
        totalCost,
        totalMarketValue,
        unrealizedPL,
        roi
    };
};

// Calculate sector exposure
export const calculateSectorExposure = (holdings, stockDataMap) => {
    const sectorMap = {};

    holdings.forEach(holding => {
        const stockData = stockDataMap[holding.symbol];
        if (!stockData) return;

        const sector = stockData.sector;
        const marketValue = holding.shares * holding.currentPrice;

        if (!sectorMap[sector]) {
            sectorMap[sector] = 0;
        }
        sectorMap[sector] += marketValue;
    });

    const total = Object.values(sectorMap).reduce((sum, val) => sum + val, 0);

    return Object.entries(sectorMap).map(([name, value]) => ({
        name,
        value,
        percentage: total > 0 ? (value / total * 100).toFixed(1) : 0
    }));
};
