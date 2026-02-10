import React, { useState, useEffect, useRef } from 'react';
import { Chart, registerables } from 'chart.js';
import 'chartjs-adapter-date-fns';
import * as XLSX from 'xlsx';
import './PerformanceTracker.css';

Chart.register(...registerables);

const PerformanceTracker = () => {
    const [db, setDb] = useState({ years: {}, assetConfig: { assets: [], liabilities: [] } });
    const [selectedYear, setSelectedYear] = useState('');
    const [recordDate, setRecordDate] = useState(new Date().toISOString().slice(0, 10));
    const [assetInputs, setAssetInputs] = useState({});
    const [liabilityInputs, setLiabilityInputs] = useState({});

    const performanceChartRef = useRef(null);
    const overallChartRef = useRef(null);
    const performanceChartInstance = useRef(null);
    const overallChartInstance = useRef(null);

    const defaultAssetNames = ['兆豐', '銀行現金', '中信信託非投資'];
    const defaultLiabilityNames = ['未入帳(應付)'];

    // Initialize
    useEffect(() => {
        loadData();
    }, []);

    useEffect(() => {
        if (selectedYear && db.years[selectedYear]) {
            refreshAllViews();
        }
    }, [selectedYear, db]);

    const loadData = () => {
        const data = localStorage.getItem('performanceTrackerData');
        const loaded = data ? JSON.parse(data) : {};

        if (Object.keys(loaded.years || {}).length === 0) {
            const currentYear = new Date().getFullYear().toString();
            loaded.years = { [currentYear]: createNewYearData() };
        }

        if (!loaded.assetConfig) {
            loaded.assetConfig = {
                assets: [...defaultAssetNames],
                liabilities: [...defaultLiabilityNames]
            };
        }

        setDb(loaded);
        const latestYear = Object.keys(loaded.years).sort().pop();
        setSelectedYear(latestYear);
    };

    const saveData = (newDb) => {
        localStorage.setItem('performanceTrackerData', JSON.stringify(newDb));
        setDb(newDb);
    };

    const createNewYearData = () => ({
        basis: 0,
        capitalInjections: [],
        records: []
    });

    const refreshAllViews = () => {
        if (!db.years[selectedYear]) return;

        // Sort records by date
        const yearData = { ...db.years[selectedYear] };
        yearData.records.sort((a, b) => new Date(a.date) - new Date(b.date));

        updateCharts();
    };

    const updateCharts = () => {
        updateWaterfallChart();
        updateOverallChart();
    };

    const updateWaterfallChart = () => {
        if (!performanceChartRef.current || !db.years[selectedYear]) return;

        const yearData = db.years[selectedYear];
        if (yearData.records.length === 0) {
            if (performanceChartInstance.current) {
                performanceChartInstance.current.destroy();
                performanceChartInstance.current = null;
            }
            return;
        }

        const totalBasis = yearData.basis + yearData.capitalInjections.reduce((sum, item) => sum + item.amount, 0);
        const labels = yearData.records.map(r => r.date);
        const data = [];
        let lastPerf = 0;

        yearData.records.forEach(record => {
            const cumulativePerf = totalBasis > 0 ? ((record.netValue - totalBasis) / totalBasis) * 100 : 0;
            data.push([lastPerf, cumulativePerf]);
            lastPerf = cumulativePerf;
        });

        const ctx = performanceChartRef.current.getContext('2d');

        if (performanceChartInstance.current) {
            performanceChartInstance.current.destroy();
        }

        performanceChartInstance.current = new Chart(ctx, {
            type: 'bar',
            data: {
                labels,
                datasets: [{
                    label: '績效 %',
                    data,
                    backgroundColor: (ctx) => (ctx.raw[1] >= ctx.raw[0] ? 'rgba(255, 99, 132, 0.7)' : 'rgba(75, 192, 192, 0.7)'),
                    borderColor: (ctx) => (ctx.raw[1] >= ctx.raw[0] ? 'rgb(255, 99, 132)' : 'rgb(75, 192, 192)'),
                }]
            },
            options: {
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        callbacks: {
                            label: (c) => `累計: ${c.raw[1].toFixed(2)}%, 變動: ${(c.raw[1] - c.raw[0]).toFixed(2)}%`
                        }
                    }
                },
                scales: {
                    y: { ticks: { callback: (v) => v + '%' } },
                    x: { ticks: { maxRotation: 70, minRotation: 70 } }
                }
            }
        });
    };

    const updateOverallChart = () => {
        if (!overallChartRef.current) return;

        const sortedYears = Object.keys(db.years).sort();
        if (sortedYears.length === 0) {
            if (overallChartInstance.current) {
                overallChartInstance.current.destroy();
                overallChartInstance.current = null;
            }
            return;
        }

        const labels = [];
        const annualPnlData = [];
        const cumulativePnlData = [];
        let runningCumulativePnl = 0;

        sortedYears.forEach(year => {
            const yearData = db.years[year];
            if (!yearData) return;

            const totalBasis = yearData.basis + yearData.capitalInjections.reduce((sum, item) => sum + item.amount, 0);
            const endOfYearValue = yearData.records.length > 0 ? yearData.records[yearData.records.length - 1].netValue : totalBasis;
            const annualPnl = endOfYearValue - totalBasis;

            runningCumulativePnl += annualPnl;

            labels.push(year);
            annualPnlData.push(annualPnl);
            cumulativePnlData.push(runningCumulativePnl);
        });

        const ctx = overallChartRef.current.getContext('2d');

        if (overallChartInstance.current) {
            overallChartInstance.current.destroy();
        }

        overallChartInstance.current = new Chart(ctx, {
            data: {
                labels,
                datasets: [
                    {
                        type: 'bar',
                        label: '年度損益',
                        data: annualPnlData,
                        backgroundColor: (ctx) => (ctx.raw >= 0 ? 'rgba(255, 99, 132, 0.7)' : 'rgba(75, 192, 192, 0.7)'),
                        borderColor: (ctx) => (ctx.raw >= 0 ? 'rgb(255, 99, 132)' : 'rgb(75, 192, 192)'),
                        yAxisID: 'yPnl',
                        order: 2
                    },
                    {
                        type: 'line',
                        label: '累積損益',
                        data: cumulativePnlData,
                        borderColor: 'rgb(54, 162, 235)',
                        backgroundColor: 'rgba(54, 162, 235, 0.5)',
                        tension: 0.1,
                        yAxisID: 'yCumulativePnl',
                        order: 1
                    }
                ]
            },
            options: {
                responsive: true,
                interaction: { mode: 'index', intersect: false },
                plugins: {
                    tooltip: {
                        callbacks: {
                            label: function (context) {
                                let label = context.dataset.label || '';
                                if (label) label += ': ';
                                if (context.parsed.y !== null) label += context.parsed.y.toLocaleString();
                                return label;
                            }
                        }
                    }
                },
                scales: {
                    yPnl: {
                        type: 'linear',
                        position: 'left',
                        title: { display: true, text: '年度損益 (金額)' }
                    },
                    yCumulativePnl: {
                        type: 'linear',
                        position: 'right',
                        title: { display: true, text: '年底累積損益 (金額)' },
                        grid: { drawOnChartArea: false }
                    }
                }
            }
        });
    };

    // User Actions
    const addNewYear = () => {
        const year = prompt("請輸入要新增的年份 (例如 2025):");
        if (year && /^\d{4}$/.test(year) && !db.years[year]) {
            const basis = parseFloat(prompt(`請輸入 ${year} 年的初始 Basis:`));
            if (!isNaN(basis)) {
                const newDb = {
                    ...db,
                    years: {
                        ...db.years,
                        [year]: { ...createNewYearData(), basis }
                    }
                };
                saveData(newDb);
                setSelectedYear(year);
            } else {
                alert("Basis 必須是數字!");
            }
        } else if (db.years[year]) {
            alert("該年份已存在!");
        } else {
            alert("無效的年份!");
        }
    };

    const editBasis = () => {
        const newBasis = prompt(`請輸入 ${selectedYear} 年的新初始 Basis:`, db.years[selectedYear].basis);
        if (newBasis !== null && !isNaN(parseFloat(newBasis))) {
            const newDb = {
                ...db,
                years: {
                    ...db.years,
                    [selectedYear]: {
                        ...db.years[selectedYear],
                        basis: parseFloat(newBasis)
                    }
                }
            };
            saveData(newDb);
        }
    };

    const addCapital = () => {
        const date = prompt("請輸入增資日期 (YYYY-MM-DD):", new Date().toISOString().slice(0, 10));
        if (date && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
            const amount = parseFloat(prompt("請輸入增資金額:"));
            if (!isNaN(amount) && amount > 0) {
                const newInjections = [...db.years[selectedYear].capitalInjections, { date, amount }];
                newInjections.sort((a, b) => new Date(a.date) - new Date(b.date));

                const newDb = {
                    ...db,
                    years: {
                        ...db.years,
                        [selectedYear]: {
                            ...db.years[selectedYear],
                            capitalInjections: newInjections
                        }
                    }
                };
                saveData(newDb);
            } else {
                alert("金額無效!");
            }
        } else if (date) {
            alert("日期格式不正確!");
        }
    };

    const addRecord = () => {
        if (!recordDate) {
            alert("請選擇記帳日期!");
            return;
        }

        if (new Date(recordDate).getFullYear().toString() !== selectedYear) {
            alert(`日期 ${recordDate} 不屬於當前選擇的年份 ${selectedYear}！`);
            return;
        }

        const netValue = calculateCurrentEntryNetValue();
        const records = [...db.years[selectedYear].records];
        const existingIndex = records.findIndex(r => r.date === recordDate);

        if (existingIndex > -1) {
            if (confirm(`日期 ${recordDate} 已有紀錄，要覆蓋嗎？`)) {
                records[existingIndex].netValue = netValue;
            } else {
                return;
            }
        } else {
            records.push({ date: recordDate, netValue });
        }

        const newDb = {
            ...db,
            years: {
                ...db.years,
                [selectedYear]: {
                    ...db.years[selectedYear],
                    records
                }
            }
        };
        saveData(newDb);
    };

    const deleteRecord = (date) => {
        if (confirm(`確定要刪除 ${date} 的紀錄嗎?`)) {
            const newDb = {
                ...db,
                years: {
                    ...db.years,
                    [selectedYear]: {
                        ...db.years[selectedYear],
                        records: db.years[selectedYear].records.filter(r => r.date !== date)
                    }
                }
            };
            saveData(newDb);
        }
    };

    const addAssetField = (type) => {
        const name = prompt(`請輸入新的${type === 'asset' ? '資產' : '負債'}項目名稱:`);
        if (name && name.trim()) {
            const list = type === 'asset' ? db.assetConfig.assets : db.assetConfig.liabilities;
            const otherList = type === 'asset' ? db.assetConfig.liabilities : db.assetConfig.assets;

            if (list.includes(name) || otherList.includes(name)) {
                alert('項目名稱已存在！');
                return;
            }

            const newDb = {
                ...db,
                assetConfig: {
                    ...db.assetConfig,
                    [type === 'asset' ? 'assets' : 'liabilities']: [...list, name]
                }
            };
            saveData(newDb);
        }
    };

    const removeAssetField = (name, type) => {
        if (!confirm(`確定要移除項目 "${name}" 嗎？`)) return;

        const listName = type === 'asset' ? 'assets' : 'liabilities';
        const newList = db.assetConfig[listName].filter(item => item !== name);

        const newDb = {
            ...db,
            assetConfig: {
                ...db.assetConfig,
                [listName]: newList
            }
        };
        saveData(newDb);

        // Clear the input value
        if (type === 'asset') {
            const newInputs = { ...assetInputs };
            delete newInputs[name];
            setAssetInputs(newInputs);
        } else {
            const newInputs = { ...liabilityInputs };
            delete newInputs[name];
            setLiabilityInputs(newInputs);
        }
    };

    const calculateCurrentEntryNetValue = () => {
        let netValue = 0;

        db.assetConfig.assets.forEach(name => {
            netValue += parseFloat(assetInputs[name] || 0);
        });

        db.assetConfig.liabilities.forEach(name => {
            netValue -= parseFloat(liabilityInputs[name] || 0);
        });

        return netValue;
    };

    // Export/Import functions
    const exportData = () => {
        const dataStr = JSON.stringify(db, null, 2);
        const dataBlob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(dataBlob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `investment_tracker_backup_${new Date().toISOString().slice(0, 10)}.json`;
        link.click();
        URL.revokeObjectURL(url);
    };

    const importData = (event) => {
        const file = event.target.files[0];
        if (!file || !confirm("匯入 JSON 將會覆蓋現有所有資料，確定要繼續嗎？")) {
            event.target.value = '';
            return;
        }

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const importedDb = JSON.parse(e.target.result);
                if (importedDb && importedDb.years && importedDb.assetConfig) {
                    saveData(importedDb);
                    const latestYear = Object.keys(importedDb.years).sort().pop();
                    setSelectedYear(latestYear);
                    alert("JSON 資料匯入成功!");
                } else {
                    alert("JSON 檔案格式不正確!");
                }
            } catch (error) {
                alert("讀取檔案失敗: " + error);
            }
        };
        reader.readAsText(file);
        event.target.value = '';
    };

    const exportToExcel = () => {
        const wb = XLSX.utils.book_new();

        // Config sheet
        const maxRows = Math.max(db.assetConfig.assets.length, db.assetConfig.liabilities.length);
        const configData = [['Assets', 'Liabilities']];
        for (let i = 0; i < maxRows; i++) {
            configData.push([db.assetConfig.assets[i] || '', db.assetConfig.liabilities[i] || '']);
        }
        XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(configData), 'Config');

        // Year sheets
        Object.keys(db.years).sort().forEach(year => {
            const yearData = db.years[year];
            const sheetData = [
                ['Initial Basis', yearData.basis],
                [],
                ['Capital Injections'],
                ['Date', 'Amount'],
                ...yearData.capitalInjections.map(inj => [inj.date, inj.amount]),
                [],
                ['Weekly Records'],
                ['Date', 'Net Value'],
                ...yearData.records.map(rec => [rec.date, rec.netValue])
            ];
            XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(sheetData), year);
        });

        XLSX.writeFile(wb, `investment_tracker_excel_backup_${new Date().toISOString().slice(0, 10)}.xlsx`);
    };

    const importFromExcel = (event) => {
        const file = event.target.files[0];
        if (!file || !confirm("從 Excel 匯入將會更新/覆蓋對應年份的資料，確定要繼續嗎？")) {
            event.target.value = '';
            return;
        }

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const workbook = XLSX.read(e.target.result, { type: 'array', cellDates: true });
                const newDb = { ...db };

                // Import config
                const configSheet = workbook.Sheets['Config'];
                if (configSheet) {
                    newDb.assetConfig = { assets: [], liabilities: [] };
                    const configJson = XLSX.utils.sheet_to_json(configSheet, { header: 1 });
                    for (let i = 1; i < configJson.length; i++) {
                        if (configJson[i][0]) newDb.assetConfig.assets.push(String(configJson[i][0]).trim());
                        if (configJson[i][1]) newDb.assetConfig.liabilities.push(String(configJson[i][1]).trim());
                    }
                }

                let lastImportedYear = null;
                workbook.SheetNames.forEach(sheetName => {
                    if (sheetName === 'Config' || !/^\d{4}$/.test(sheetName)) return;

                    const year = sheetName;
                    lastImportedYear = year;
                    newDb.years[year] = createNewYearData();

                    const sheetJson = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { header: 1, raw: false });
                    const basisIndex = sheetJson.findIndex(r => String(r[0]).includes('Initial Basis'));
                    const injectionIndex = sheetJson.findIndex(r => String(r[0]).includes('Capital Injections'));
                    const recordIndex = sheetJson.findIndex(r => String(r[0]).includes('Weekly Records'));

                    if (basisIndex > -1) newDb.years[year].basis = parseFloat(sheetJson[basisIndex][1]) || 0;
                    if (injectionIndex > -1) {
                        for (let i = injectionIndex + 2; i < sheetJson.length && sheetJson[i].length; i++) {
                            if (sheetJson[i][0] && sheetJson[i][1] !== undefined) {
                                newDb.years[year].capitalInjections.push({
                                    date: formatDate(sheetJson[i][0]),
                                    amount: parseFloat(sheetJson[i][1])
                                });
                            }
                        }
                    }
                    if (recordIndex > -1) {
                        for (let i = recordIndex + 2; i < sheetJson.length && sheetJson[i].length; i++) {
                            if (sheetJson[i][0] && sheetJson[i][1] !== undefined) {
                                newDb.years[year].records.push({
                                    date: formatDate(sheetJson[i][0]),
                                    netValue: parseFloat(sheetJson[i][1])
                                });
                            }
                        }
                    }
                });

                saveData(newDb);
                if (lastImportedYear) setSelectedYear(lastImportedYear);
                alert("Excel 資料匯入/更新成功！");
            } catch (error) {
                console.error(error);
                alert("讀取 Excel 檔案失敗: " + error.message);
            }
        };
        reader.readAsArrayBuffer(file);
        event.target.value = '';
    };

    const formatDate = (d) => {
        if (d instanceof Date) return d.toISOString().slice(0, 10);
        if (typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d)) return d;
        if (typeof d === 'string') {
            const parsedDate = new Date(d);
            if (!isNaN(parsedDate)) return parsedDate.toISOString().slice(0, 10);
        }
        return '';
    };

    // Calculate summary
    const getSummary = () => {
        if (!db.years[selectedYear]) return { basis: 0, currentValue: 0, pnl: 0, performance: 0 };

        const yearData = db.years[selectedYear];
        const totalBasis = yearData.basis + yearData.capitalInjections.reduce((sum, item) => sum + item.amount, 0);
        const latestRecord = yearData.records[yearData.records.length - 1];
        const currentValue = latestRecord ? latestRecord.netValue : totalBasis;
        const pnl = latestRecord ? currentValue - totalBasis : 0;
        const performance = totalBasis > 0 ? (pnl / totalBasis) * 100 : 0;

        return { basis: totalBasis, currentValue, pnl, performance };
    };

    const getRecordsTableData = () => {
        if (!db.years[selectedYear]) return [];

        const yearData = db.years[selectedYear];
        const totalBasis = yearData.basis + yearData.capitalInjections.reduce((sum, item) => sum + item.amount, 0);

        return yearData.records.map((record, index) => {
            const prevRecordValue = index > 0 ? yearData.records[index - 1].netValue : yearData.basis;
            const prevRecordDate = index > 0 ? new Date(yearData.records[index - 1].date) : new Date(`${selectedYear}-01-01`);

            const injectionsBetween = yearData.capitalInjections
                .filter(inj => new Date(inj.date) > prevRecordDate && new Date(inj.date) <= new Date(record.date))
                .reduce((sum, inj) => sum + inj.amount, 0);

            const adjustedPrevValue = prevRecordValue + injectionsBetween;
            const weeklyChange = record.netValue - adjustedPrevValue;
            const cumulativePerf = totalBasis > 0 ? ((record.netValue - totalBasis) / totalBasis) * 100 : 0;
            const weeklyPerfChange = adjustedPrevValue > 0 ? (weeklyChange / adjustedPrevValue) * 100 : 0;

            return {
                date: record.date,
                netValue: record.netValue,
                weeklyChange,
                cumulativePerf,
                weeklyPerfChange
            };
        });
    };

    const summary = getSummary();
    const tableData = getRecordsTableData();
    const currentNetValue = calculateCurrentEntryNetValue();

    return (
        <div className="performance-tracker">
            <div className="pt-container">
                {/* Left Panel */}
                <div className="pt-left-panel">
                    {/* Control Panel */}
                    <div className="pt-card">
                        <h2>控制面板</h2>
                        <div className="pt-form-grid">
                            <label htmlFor="yearSelector">選擇年度:</label>
                            <select
                                id="yearSelector"
                                value={selectedYear}
                                onChange={(e) => setSelectedYear(e.target.value)}
                            >
                                {Object.keys(db.years).sort((a, b) => b - a).map(year => (
                                    <option key={year} value={year}>{year}</option>
                                ))}
                            </select>
                        </div>

                        <div className="pt-button-group">
                            <button onClick={addNewYear}>新增年度</button>
                            <button onClick={editBasis}>修改Basis</button>
                            <button onClick={addCapital}>增資</button>
                        </div>

                        <h3 style={{ marginTop: '20px' }}>資料管理</h3>
                        <div className="pt-button-group">
                            <button onClick={exportToExcel} className="excel-btn">匯出 Excel</button>
                            <label htmlFor="importExcelFile" className="button-label excel-btn">
                                匯入 Excel
                                <input
                                    type="file"
                                    id="importExcelFile"
                                    accept=".xlsx, .xls"
                                    style={{ display: 'none' }}
                                    onChange={importFromExcel}
                                />
                            </label>
                            <button onClick={exportData}>匯出 JSON</button>
                            <label htmlFor="importFile" className="button-label">
                                匯入 JSON
                                <input
                                    type="file"
                                    id="importFile"
                                    accept=".json"
                                    style={{ display: 'none' }}
                                    onChange={importData}
                                />
                            </label>
                        </div>
                    </div>

                    {/* Annual Summary */}
                    <div className="pt-card">
                        <h3>年度總覽 (截至最新一筆)</h3>
                        <div className="pt-summary-grid">
                            <div className="pt-summary-item">
                                <div className="label">年度總 Basis</div>
                                <div className="value">{summary.basis.toLocaleString()}</div>
                            </div>
                            <div className="pt-summary-item">
                                <div className="label">當前總淨值</div>
                                <div className="value">{summary.currentValue.toLocaleString()}</div>
                            </div>
                            <div className="pt-summary-item">
                                <div className="label">總損益</div>
                                <div className={`value ${summary.pnl >= 0 ? 'profit' : 'loss'}`}>
                                    {summary.pnl.toLocaleString()}
                                </div>
                            </div>
                            <div className="pt-summary-item">
                                <div className="label">年度績效</div>
                                <div className={`value ${summary.performance >= 0 ? 'profit' : 'loss'}`}>
                                    {summary.performance.toFixed(2)}%
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Data Entry */}
                    <div className="pt-card">
                        <h3>每週數據輸入</h3>
                        <div className="pt-form-grid">
                            <label htmlFor="recordDate">記帳日期:</label>
                            <input
                                type="date"
                                id="recordDate"
                                value={recordDate}
                                onChange={(e) => setRecordDate(e.target.value)}
                            />
                        </div>

                        {/* Assets */}
                        <div className="asset-container">
                            <h4>資產 / 應收 (+)</h4>
                            {db.assetConfig.assets.map(name => (
                                <div key={name} className="asset-item">
                                    <input type="text" value={name} readOnly />
                                    <input
                                        type="number"
                                        placeholder="金額"
                                        value={assetInputs[name] || ''}
                                        onChange={(e) => setAssetInputs({ ...assetInputs, [name]: e.target.value })}
                                    />
                                    <button
                                        onClick={() => removeAssetField(name, 'asset')}
                                        style={{ backgroundColor: '#757575' }}
                                    >
                                        移除
                                    </button>
                                </div>
                            ))}
                            <button
                                onClick={() => addAssetField('asset')}
                                style={{ marginTop: '10px', backgroundColor: '#4caf50' }}
                            >
                                新增資產項目
                            </button>
                        </div>

                        {/* Liabilities */}
                        <div className="liability-container">
                            <h4>負債 / 應付 (-)</h4>
                            {db.assetConfig.liabilities.map(name => (
                                <div key={name} className="asset-item">
                                    <input type="text" value={name} readOnly />
                                    <input
                                        type="number"
                                        placeholder="金額"
                                        value={liabilityInputs[name] || ''}
                                        onChange={(e) => setLiabilityInputs({ ...liabilityInputs, [name]: e.target.value })}
                                    />
                                    <button
                                        onClick={() => removeAssetField(name, 'liability')}
                                        style={{ backgroundColor: '#757575' }}
                                    >
                                        移除
                                    </button>
                                </div>
                            ))}
                            <button
                                onClick={() => addAssetField('liability')}
                                style={{ marginTop: '10px', backgroundColor: '#f44336' }}
                            >
                                新增負債項目
                            </button>
                        </div>

                        <h3 style={{ marginTop: '20px' }}>
                            計算結果: <span>{currentNetValue.toLocaleString()}</span>
                        </h3>
                        <button onClick={addRecord} style={{ width: '100%', marginTop: '10px' }}>
                            新增/更新本週紀錄
                        </button>
                    </div>
                </div>

                {/* Right Panel */}
                <div className="pt-right-panel">
                    {/* Records Table */}
                    <div className="pt-card">
                        <h2>{selectedYear}年 - 績效紀錄</h2>
                        <table className="pt-table">
                            <thead>
                                <tr>
                                    <th>記帳日期</th>
                                    <th>總淨值</th>
                                    <th>當週增減</th>
                                    <th>累計績效</th>
                                    <th>與前週比</th>
                                    <th>操作</th>
                                </tr>
                            </thead>
                            <tbody>
                                {tableData.map((row) => (
                                    <tr key={row.date}>
                                        <td>{row.date}</td>
                                        <td>{row.netValue.toLocaleString()}</td>
                                        <td>{row.weeklyChange.toLocaleString()}</td>
                                        <td style={{ color: row.cumulativePerf >= 0 ? '#d32f2f' : '#388e3c' }}>
                                            {row.cumulativePerf.toFixed(2)}%
                                        </td>
                                        <td style={{ color: row.weeklyPerfChange >= 0 ? '#d32f2f' : '#388e3c' }}>
                                            {row.weeklyPerfChange.toFixed(2)}%
                                        </td>
                                        <td>
                                            <button className="delete-btn" onClick={() => deleteRecord(row.date)}>
                                                刪除
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {/* Waterfall Chart */}
                    <div className="pt-card">
                        <h2>{selectedYear}年 - 績效瀑布圖</h2>
                        <canvas ref={performanceChartRef}></canvas>
                    </div>

                    {/* Overall Performance Chart */}
                    <div className="pt-card">
                        <h2>歷年績效總覽</h2>
                        <canvas ref={overallChartRef}></canvas>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default PerformanceTracker;
