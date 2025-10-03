let activeCanvas = null;
let activePoints = [];
let activeData = [];
let activeOptions = {};
let tooltipElement = null;

export function renderChart(canvas, data, options = {}) {
  if (!canvas || !data || data.length === 0) {
    return;
  }

  const ctx = canvas.getContext('2d');
  const isCumulative = options.cumulative === true;

  const width = canvas.width;
  const height = canvas.height;
  const padding = { top: 20, right: 40, bottom: 30, left: 50 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;

  ctx.clearRect(0, 0, width, height);

  activeCanvas = canvas;
  activeData = data;
  activeOptions = options;

  if (!canvas.dataset.listenerAttached) {
    canvas.addEventListener('mousemove', handleMouseMove);
    canvas.addEventListener('mouseleave', handleMouseLeave);
    canvas.dataset.listenerAttached = 'true';
  }

  const values = data.map(d => parseFloat(d.value) || 0);
  const labels = data.map(d => d.label || '');

  let plotValues = values;
  if (isCumulative) {
    plotValues = [];
    let sum = 0;
    for (const val of values) {
      sum += val;
      plotValues.push(sum);
    }
  }

  const minValue = Math.min(...plotValues);
  const maxValue = Math.max(...plotValues);
  const valueRange = maxValue - minValue || 1;

  const points = plotValues.map((val, idx) => {
    const x = padding.left + (chartWidth / (plotValues.length - 1 || 1)) * idx;
    const y = padding.top + chartHeight - ((val - minValue) / valueRange) * chartHeight;
    return {
      x,
      y,
      label: labels[idx],
      value: plotValues[idx],
      originalValue: values[idx]
    };
  });

  activePoints = points;

  ctx.fillStyle = '#f7f7f7';
  ctx.fillRect(padding.left, padding.top, chartWidth, chartHeight);

  ctx.strokeStyle = '#e0e0e0';
  ctx.lineWidth = 1;
  for (let i = 0; i <= 5; i++) {
    const yPos = padding.top + (chartHeight / 5) * i;
    ctx.beginPath();
    ctx.moveTo(padding.left, yPos);
    ctx.lineTo(padding.left + chartWidth, yPos);
    ctx.stroke();
  }

  ctx.strokeStyle = '#cccccc';
  ctx.strokeRect(padding.left, padding.top, chartWidth, chartHeight);

  ctx.fillStyle = '#666666';
  ctx.font = '11px sans-serif';
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  for (let i = 0; i <= 5; i++) {
    const val = minValue + (valueRange / 5) * (5 - i);
    const yPos = padding.top + (chartHeight / 5) * i;
    ctx.fillText(formatNumber(val), padding.left - 8, yPos);
  }

  if (labels.length > 0) {
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    const labelStep = Math.ceil(labels.length / 6);
    labels.forEach((label, idx) => {
      if (idx % labelStep === 0 || idx === labels.length - 1) {
        const xPos = padding.left + (chartWidth / (labels.length - 1 || 1)) * idx;
        ctx.fillText(truncateLabel(label), xPos, padding.top + chartHeight + 6);
      }
    });
  }

  ctx.strokeStyle = isCumulative ? '#4A90E2' : '#1f77b4';
  ctx.lineWidth = isCumulative ? 2.5 : 2;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';

  ctx.beginPath();
  points.forEach((point, idx) => {
    if (idx === 0) {
      ctx.moveTo(point.x, point.y);
    } else {
      ctx.lineTo(point.x, point.y);
    }
  });
  ctx.stroke();

  if (isCumulative) {
    ctx.fillStyle = '#4A90E2';
    points.forEach(point => {
      ctx.beginPath();
      ctx.arc(point.x, point.y, 3.5, 0, 2 * Math.PI);
      ctx.fill();
    });
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
  if (!activeCanvas || !activePoints.length) {
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

  activePoints.forEach(point => {
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

  let content = `<div style="font-weight: bold; margin-bottom: 4px;">${point.label}</div>`;
  content += `<div>${measureName}: ${formatNumber(point.value)}</div>`;

  if (isCumulative && point.originalValue !== undefined) {
    content += `<div style="font-size: 0.9em; color: #666; margin-top: 2px;">Period: ${formatNumber(point.originalValue)}</div>`;
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
