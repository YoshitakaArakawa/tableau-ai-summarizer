let activeCanvas = null;
let activeComparisonPoints = [];
let activeCurrentPoints = [];
let activeChartData = null;
let activeOptions = {};
let tooltipElement = null;

export function renderChart(canvas, chartData, options = {}) {
  // Validate input
  if (!canvas || !chartData) {
    return;
  }

  // Check if data structure is valid
  if (!chartData.comparison && !chartData.current) {
    return;
  }

  if (!chartData.metadata) {
    return;
  }

  const ctx = canvas.getContext('2d');
  const isCumulative = options.cumulative === true;

  const width = canvas.width;
  const height = canvas.height;
  const padding = { top: 20, right: 100, bottom: 30, left: 100 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;

  ctx.clearRect(0, 0, width, height);

  activeCanvas = canvas;
  activeChartData = chartData;
  activeOptions = options;

  if (!canvas.dataset.listenerAttached) {
    canvas.addEventListener('mousemove', handleMouseMove);
    canvas.addEventListener('mouseleave', handleMouseLeave);
    canvas.dataset.listenerAttached = 'true';
  }

  const { comparison, current, metadata } = chartData;
  const { totalDays, yesterdayIndex, yesterdayLabel } = metadata;

  // Prepare data for plotting
  const prepareValues = (dataArray) => {
    if (!dataArray || dataArray.length === 0) return [];

    if (isCumulative) {
      const cumulative = [];
      let sum = 0;
      for (const item of dataArray) {
        sum += item.value;
        cumulative.push({ ...item, value: sum, originalValue: item.value });
      }
      return cumulative;
    }
    return dataArray.map(item => ({ ...item, originalValue: item.value }));
  };

  const comparisonValues = prepareValues(comparison);
  const currentValues = prepareValues(current);

  // Calculate value range for Y-axis
  const allValues = [...comparisonValues, ...currentValues].map(d => d.value);
  if (allValues.length === 0) {
    return;
  }

  const minValue = Math.min(...allValues);
  const maxValue = Math.max(...allValues);
  const valueRange = maxValue - minValue || 1;

  // Helper function to convert day index to X position
  const dayIndexToX = (dayIndex) => {
    return padding.left + (chartWidth / (totalDays - 1 || 1)) * (dayIndex - 1);
  };

  // Helper function to convert value to Y position
  const valueToY = (value) => {
    return padding.top + chartHeight - ((value - minValue) / valueRange) * chartHeight;
  };

  // Convert data to points
  const comparisonPoints = comparisonValues.map(item => ({
    x: dayIndexToX(item.dayIndex),
    y: valueToY(item.value),
    dayIndex: item.dayIndex,
    date: item.date,
    value: item.value,
    originalValue: item.originalValue,
    period: 'comparison'
  }));

  const currentPoints = currentValues.map(item => ({
    x: dayIndexToX(item.dayIndex),
    y: valueToY(item.value),
    dayIndex: item.dayIndex,
    date: item.date,
    value: item.value,
    originalValue: item.originalValue,
    period: 'current'
  }));

  activeComparisonPoints = comparisonPoints;
  activeCurrentPoints = currentPoints;

  // Draw background
  ctx.fillStyle = '#f7f7f7';
  ctx.fillRect(padding.left, padding.top, chartWidth, chartHeight);

  // Draw reference lines
  // 1. First day reference line (light, no label)
  const firstDayX = dayIndexToX(1);
  ctx.strokeStyle = '#e0e0e0';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(firstDayX, padding.top);
  ctx.lineTo(firstDayX, padding.top + chartHeight);
  ctx.stroke();

  // 2. Last day reference line (light, no label)
  const lastDayX = dayIndexToX(totalDays);
  ctx.strokeStyle = '#e0e0e0';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(lastDayX, padding.top);
  ctx.lineTo(lastDayX, padding.top + chartHeight);
  ctx.stroke();

  // 3. Yesterday reference line (darker, with label)
  const yesterdayX = dayIndexToX(yesterdayIndex);
  ctx.strokeStyle = '#999999';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(yesterdayX, padding.top);
  ctx.lineTo(yesterdayX, padding.top + chartHeight);
  ctx.stroke();

  // Draw yesterday label
  ctx.fillStyle = '#666666';
  ctx.font = 'bold 11px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillText(yesterdayLabel, yesterdayX, padding.top + chartHeight + 6);

  // Draw comparison period line (gray, dashed)
  if (comparisonPoints.length > 0) {
    ctx.strokeStyle = '#999999';
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 5]);
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';

    ctx.beginPath();
    comparisonPoints.forEach((point, idx) => {
      if (idx === 0) {
        ctx.moveTo(point.x, point.y);
      } else {
        ctx.lineTo(point.x, point.y);
      }
    });
    ctx.stroke();
    ctx.setLineDash([]);
  }

  // Draw current period line (blue, solid)
  if (currentPoints.length > 0) {
    ctx.strokeStyle = isCumulative ? '#4A90E2' : '#1f77b4';
    ctx.lineWidth = isCumulative ? 2.5 : 2;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';

    ctx.beginPath();
    currentPoints.forEach((point, idx) => {
      if (idx === 0) {
        ctx.moveTo(point.x, point.y);
      } else {
        ctx.lineTo(point.x, point.y);
      }
    });
    ctx.stroke();

    // Draw dots for cumulative mode
    if (isCumulative) {
      ctx.fillStyle = '#4A90E2';
      currentPoints.forEach(point => {
        ctx.beginPath();
        ctx.arc(point.x, point.y, 3.5, 0, 2 * Math.PI);
        ctx.fill();
      });
    }
  }
}

function formatNumber(num) {
  if (Math.abs(num) >= 1000000) {
    return (num / 1000000).toFixed(1) + 'M';
  }
  if (Math.abs(num) >= 1000) {
    return (num / 1000).toFixed(1) + 'K';
  }
  return num.toFixed(0);
}

function truncateLabel(label, maxLength = 10) {
  if (label.length <= maxLength) {
    return label;
  }
  return label.substring(0, maxLength - 1) + '…';
}

function handleMouseMove(event) {
  if (!activeCanvas || (!activeComparisonPoints.length && !activeCurrentPoints.length)) {
    return;
  }

  const rect = activeCanvas.getBoundingClientRect();
  const scaleX = activeCanvas.width / rect.width;
  const scaleY = activeCanvas.height / rect.height;
  const mouseX = (event.clientX - rect.left) * scaleX;
  const mouseY = (event.clientY - rect.top) * scaleY;

  const threshold = 10;
  let nearestPoint = null;
  let minDistance = Infinity;

  // Check comparison points
  activeComparisonPoints.forEach(point => {
    const distance = Math.sqrt(Math.pow(point.x - mouseX, 2) + Math.pow(point.y - mouseY, 2));
    if (distance < threshold && distance < minDistance) {
      minDistance = distance;
      nearestPoint = point;
    }
  });

  // Check current points
  activeCurrentPoints.forEach(point => {
    const distance = Math.sqrt(Math.pow(point.x - mouseX, 2) + Math.pow(point.y - mouseY, 2));
    if (distance < threshold && distance < minDistance) {
      minDistance = distance;
      nearestPoint = point;
    }
  });

  if (nearestPoint) {
    showTooltip(event.clientX, event.clientY, nearestPoint);
    activeCanvas.style.cursor = 'pointer';
  } else {
    hideTooltip();
    activeCanvas.style.cursor = 'default';
  }
}

function handleMouseLeave() {
  hideTooltip();
  if (activeCanvas) {
    activeCanvas.style.cursor = 'default';
  }
}

function showTooltip(clientX, clientY, point) {
  if (!tooltipElement) {
    tooltipElement = document.getElementById('chartTooltip');
  }

  if (!tooltipElement) {
    return;
  }

  const measureName = activeOptions.measureName || 'Value';
  const isCumulative = activeOptions.cumulative === true;
  const periodLabel = point.period === 'comparison' ? 'Comparison' : 'Current';
  const periodColor = point.period === 'comparison' ? '#999999' : '#4A90E2';

  let content = `<div style="font-weight: bold; margin-bottom: 4px; color: ${periodColor};">${periodLabel}: ${point.date}</div>`;
  content += `<div>${measureName}: ${formatNumber(point.value)}</div>`;

  if (isCumulative && point.originalValue !== undefined) {
    content += `<div style="font-size: 0.9em; color: #ccc; margin-top: 2px;">Period: ${formatNumber(point.originalValue)}</div>`;
  }

  tooltipElement.innerHTML = content;
  tooltipElement.style.display = 'block';
  tooltipElement.style.left = (clientX + 10) + 'px';
  tooltipElement.style.top = (clientY + 10) + 'px';
}

function hideTooltip() {
  if (tooltipElement) {
    tooltipElement.style.display = 'none';
  }
}
