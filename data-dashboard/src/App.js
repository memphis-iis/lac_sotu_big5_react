import React, { useState, useEffect, useRef } from 'react';
import Papa from 'papaparse';
import { Chart } from 'chart.js/auto';

const App = () => {
  const [data, setData] = useState([]);
  const [xAxisColumn, setXAxisColumn] = useState('');
  const [yAxisColumn, setYAxisColumn] = useState('');
  const [yearRange, setYearRange] = useState([null, null]);
  const [chartType, setChartType] = useState('line');
  const [barAggregation, setBarAggregation] = useState("average");

  const chartRef = useRef(null);

  useEffect(() => {
    const fetchData = async () => {
      const results = await new Promise((resolve, reject) => {
        Papa.parse('./knn_imputed_values.csv', {
          download: true,
          header: true,
          dynamicTyping: true,
          complete: (results) => {
            console.log("CSV Content:", results.data);
            resolve(results);
          },
          error: (error) => reject(error)
        });
      });
      return results.data;
    };

    fetchData().then(data => setData(data));
  }, []);

  useEffect(() => {
    createChart();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, chartType, yearRange, xAxisColumn, yAxisColumn, barAggregation]);

  const getRandomColor = () => {
    const letters = '0123456789ABCDEF';
    let color = '#';
    for (let i = 0; i < 6; i++) {
      color += letters[Math.floor(Math.random() * 16)];
    }
    return color;
  };

  const createChart = () => {
    if (chartRef.current) {
      chartRef.current.destroy();
    }
    if (!data || data.length === 0 || !yAxisColumn) return;

    const filteredData = data.filter(item => {
      let include = true;
      if (yearRange[0] !== null && yearRange[1] !== null) {
        include = include && (item.year >= yearRange[0] && item.year <= yearRange[1]);
      }
      return include;
    });

    let chartData = {};

    if (chartType === 'line') {
      const labels = filteredData.map(item => item[xAxisColumn]);
      const datasets = [{
        label: yAxisColumn,
        data: filteredData.map(item => item[yAxisColumn]),
        borderColor: getRandomColor(),
        fill: false,
      }];
      chartData = { labels, datasets };
    } else if (chartType === 'bar') {
      const groups = {};
      filteredData.forEach(item => {
        const key = item[xAxisColumn];
        if (!groups[key]) groups[key] = [];
        groups[key].push(item);
      });
      const labels = Object.keys(groups).sort();
      const aggregatedData = labels.map(label => {
        const values = groups[label]
          .map(item => item[yAxisColumn])
          .filter(val => typeof val === 'number');
        if (values.length === 0) return null;
        if (barAggregation === 'average') {
          return values.reduce((sum, v) => sum + v, 0) / values.length;
        } else if (barAggregation === 'median') {
          const sorted = [...values].sort((a, b) => a - b);
          const mid = Math.floor(sorted.length / 2);
          return sorted.length % 2 !== 0
            ? sorted[mid]
            : (sorted[mid - 1] + sorted[mid]) / 2;
        } else if (barAggregation === 'total') {
          return values.reduce((sum, v) => sum + v, 0);
        } else if (barAggregation === 'count') {
          return values.length;
        }
        return null;
      });
      const datasets = [{
        label: `${barAggregation} of ${yAxisColumn}`,
        data: aggregatedData,
        backgroundColor: getRandomColor(),
      }];
      chartData = { labels, datasets };
    }

    const ctx = document.getElementById('myChart');
    chartRef.current = new Chart(ctx, {
      type: chartType,
      data: chartData,
      options: {
        responsive: true,
        scales: {
          x: { title: { display: true, text: xAxisColumn || 'Index' } },
          y: { title: { display: true, text: yAxisColumn } },
        },
      },
    });
  };

  const downloadCSV = () => {
    const csv = Papa.unparse(data);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', 'data.csv');
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const downloadImage = () => {
    const canvas = document.getElementById('myChart');
    if (canvas) {
      const link = document.createElement('a');
      link.href = canvas.toDataURL('image/png');
      link.download = 'chart.png';
      link.click();
    }
  };

  const availableColumns = data.length > 0 ? Object.keys(data[0]) : [];

  return (
    <div class="container">
      <h1>LAC-SOTU Dashboard</h1>
      <div class="row">
        <div class="col-md-6">
          <label htmlFor="xAxisSelect">Select X-Axis Column:</label>
          <select
            class="form-select" 
            id="xAxisSelect"
            value={xAxisColumn}
            onChange={(e) => setXAxisColumn(e.target.value)}
          >
            <option value="">-- Select Column --</option>
            {availableColumns.map(column => (
              <option key={column} value={column}>{column}</option>
            ))}
          </select>
        </div>

        <div class="col-md-6">
          <label htmlFor="yAxisSelect">Select Y-Axis Column:</label>
          <select
            class="form-select" 
            id="yAxisSelect"
            value={yAxisColumn}
            onChange={(e) => setYAxisColumn(e.target.value)}
          >
            <option value="">-- Select Column --</option>
            {availableColumns.map(column => (
              <option key={column} value={column}>{column}</option>
            ))}
          </select>
        </div>
      </div>
      <br></br>

      <div>
        <label htmlFor="startYear">Start Year:</label>
        <input
          type="range"
          id="startYear"
          min={
            data.length > 0
              ? Math.min(...data.map(item => item.year).filter(year => typeof year === 'number'))
              : 1900
          }
          max={
            data.length > 0
              ? Math.max(...data.map(item => item.year).filter(year => typeof year === 'number'))
              : 2023
          }
          step={1}
          value={yearRange[0] || ''}
          onChange={(e) => {
            const newStart = parseInt(e.target.value);
            setYearRange([newStart, yearRange[1] !== null ? yearRange[1] : newStart]);
          }}
        />
        <span>{yearRange[0] || 'All'}</span>
      </div>
      <div>
        <label htmlFor="endYear">End Year:</label>
        <input
          type="range"
          id="endYear"
          min={
            data.length > 0
              ? Math.min(...data.map(item => item.year).filter(year => typeof year === 'number'))
              : 1900
          }
          max={
            data.length > 0
              ? Math.max(...data.map(item => item.year).filter(year => typeof year === 'number'))
              : 2023
          }
          step={1}
          value={yearRange[1] || ''}
          onChange={(e) => {
            const newEnd = parseInt(e.target.value);
            setYearRange([yearRange[0] !== null ? yearRange[0] : newEnd, newEnd]);
          }}
        />
        <span>{yearRange[1] || 'All'}</span>
      </div>

      <div>
        <label htmlFor="chartType">Chart Type:</label>
        <select class="form-select" id="chartType" value={chartType} onChange={(e) => setChartType(e.target.value)}>
          <option value="line">Line</option>
          <option value="bar">Bar</option>
        </select>
      </div>

      {chartType === 'bar' && (
        <div>
          <label htmlFor="barAggregation">Bar Aggregation:</label>
          <select
            class="form-select" 
            id="barAggregation"
            value={barAggregation}
            onChange={(e) => setBarAggregation(e.target.value)}
          >
            <option value="count">Count</option>
            <option value="average">Average</option>
            <option value="median">Median</option>
            <option value="total">Total</option>
          </select>
        </div>
      )}

      <canvas id="myChart"></canvas>

      <div>
        <button class="btn btn-primary my-2" onClick={downloadCSV}>Download CSV</button><br />
        <button class="btn btn-primary" onClick={downloadImage}>Download Chart</button>
      </div>
    </div>
  );
};

export default App;