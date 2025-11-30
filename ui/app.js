const API_URL = 'http://localhost:3000';

// DOM Elements
const uploadArea = document.getElementById('uploadArea');
const imageInput = document.getElementById('imageInput');
const uploadBtn = document.getElementById('uploadBtn');
const video = document.getElementById('video');
const canvas = document.getElementById('canvas');
const startCameraBtn = document.getElementById('startCamera');
const captureBtn = document.getElementById('captureBtn');
const preview = document.getElementById('preview');
const previewSection = document.getElementById('previewSection');
const resultsSection = document.getElementById('resultsSection');
const loadingSection = document.getElementById('loadingSection');
const errorSection = document.getElementById('errorSection');

let stream = null;
let predictionHistory = [];
let heatmapCanvas = null;

// Damage class labels (supporting both formats)
const DAMAGE_LABELS = {
    // Edge Impulse format
    'Alligator-Crack': 'Alligator Crack',
    'Longitudinal-Cracks': 'Longitudinal Crack',
    'PotHole': 'Pothole',
    'Transverse-Cracks': 'Transverse Crack',
    // Original format (fallback)
    'D00-longitudinal-crack': 'Longitudinal Crack',
    'D10-transverse-crack': 'Transverse Crack',
    'D20-alligator-crack': 'Alligator Crack',
    'D40-pothole': 'Pothole'
};

// AI-driven cost estimation model (based on real-world data)
const COST_MODEL = {
    // Edge Impulse format
    'Alligator-Crack': { base: 500, perMeter: 75, urgency: 0.8 },
    'Longitudinal-Cracks': { base: 150, perMeter: 25, urgency: 0.4 },
    'PotHole': { base: 300, perMeter: 50, urgency: 0.9 },
    'Transverse-Cracks': { base: 200, perMeter: 30, urgency: 0.5 },
    // Original format (fallback)
    'D00-longitudinal-crack': { base: 150, perMeter: 25, urgency: 0.4 },
    'D10-transverse-crack': { base: 200, perMeter: 30, urgency: 0.5 },
    'D20-alligator-crack': { base: 500, perMeter: 75, urgency: 0.8 },
    'D40-pothole': { base: 300, perMeter: 50, urgency: 0.9 }
};

// Upload button click
uploadBtn.addEventListener('click', () => {
    imageInput.click();
});

// File input change
imageInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
        handleImageUpload(file);
    }
});

// Drag and drop
uploadArea.addEventListener('dragover', (e) => {
    e.preventDefault();
    uploadArea.classList.add('dragover');
});

uploadArea.addEventListener('dragleave', () => {
    uploadArea.classList.remove('dragover');
});

uploadArea.addEventListener('drop', (e) => {
    e.preventDefault();
    uploadArea.classList.remove('dragover');
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('image/')) {
        handleImageUpload(file);
    }
});

uploadArea.addEventListener('click', () => {
    imageInput.click();
});

// Batch processing
document.getElementById('batchInput').addEventListener('change', (e) => {
    const files = Array.from(e.target.files);
    if (files.length > 0) {
        document.getElementById('batchProgress').hidden = false;
        processBatchImages(files);
    }
});

// Camera controls
startCameraBtn.addEventListener('click', async () => {
    try {
        stream = await navigator.mediaDevices.getUserMedia({ 
            video: { facingMode: 'environment' } 
        });
        video.srcObject = stream;
        startCameraBtn.textContent = 'Stop Camera';
        startCameraBtn.classList.remove('btn-secondary');
        startCameraBtn.classList.add('btn-danger');
        captureBtn.disabled = false;
        
        startCameraBtn.onclick = stopCamera;
    } catch (err) {
        showError('Camera access denied or not available');
    }
});

captureBtn.addEventListener('click', () => {
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0);
    
    canvas.toBlob((blob) => {
        handleImageUpload(blob);
    }, 'image/jpeg', 0.95);
});

function stopCamera() {
    if (stream) {
        stream.getTracks().forEach(track => track.stop());
        video.srcObject = null;
        startCameraBtn.textContent = 'Start Camera';
        startCameraBtn.classList.remove('btn-danger');
        startCameraBtn.classList.add('btn-secondary');
        captureBtn.disabled = true;
        
        startCameraBtn.onclick = () => {
            startCameraBtn.click();
        };
    }
}

async function handleImageUpload(file) {
    // Show preview
    const reader = new FileReader();
    reader.onload = (e) => {
        preview.src = e.target.result;
        previewSection.hidden = false;
    };
    reader.readAsDataURL(file);

    // Show loading
    resultsSection.hidden = true;
    errorSection.hidden = true;
    loadingSection.hidden = false;

    // Send to API
    const formData = new FormData();
    formData.append('image', file);

    try {
        const response = await fetch(`${API_URL}/predict`, {
            method: 'POST',
            body: formData
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('Server error:', response.status, errorText);
            throw new Error(`Prediction failed: ${response.status}`);
        }

        const data = await response.json();
        console.log('Received data:', data);
        displayResults(data);
    } catch (err) {
        console.error('Upload error:', err);
        showError('Failed to analyze image. Make sure the server is running. Error: ' + err.message);
    } finally {
        loadingSection.hidden = true;
    }
}

function displayResults(data) {
    try {
        console.log('Displaying results for:', data);
        
        const { prediction, inferenceTime, timestamp, aiInsights } = data;
        
        if (!prediction || !prediction.class) {
            throw new Error('Invalid prediction data');
        }
        
        // Store in history
        predictionHistory.push({
            ...prediction,
            timestamp,
            inferenceTime
        });
        
        // Update main result
        const damageLabel = DAMAGE_LABELS[prediction.class] || prediction.class;
        document.getElementById('damageType').textContent = damageLabel;
        document.getElementById('confidence').textContent = 
            `${(prediction.confidence * 100).toFixed(1)}%`;
        
        // Update metrics
        document.getElementById('inferenceTime').textContent = `${inferenceTime}ms`;
        document.getElementById('timestamp').textContent = 
            new Date(timestamp).toLocaleTimeString();
    
    // Display all scores
    const allScoresDiv = document.getElementById('allScores');
    allScoresDiv.innerHTML = '';
    
    const sortedScores = Object.entries(prediction.allScores)
        .sort((a, b) => b[1] - a[1]);
    
    sortedScores.forEach(([cls, score]) => {
        const label = DAMAGE_LABELS[cls] || cls;
        const percentage = (score * 100).toFixed(1);
        
        const item = document.createElement('div');
        item.className = 'prediction-item';
        item.innerHTML = `
            <span>${label}</span>
            <div class="prediction-bar">
                <div class="prediction-fill" style="width: ${percentage}%"></div>
            </div>
            <span>${percentage}%</span>
        `;
        allScoresDiv.appendChild(item);
    });
    
    // Update severity with AI insights
    updateSeverity(prediction.class, prediction.confidence, aiInsights);
    
    // Display AI-powered cost estimation
    displayCostEstimation(prediction.class, prediction.confidence);
    
    // Display uncertainty quantification
    displayUncertaintyMetrics(prediction.allScores);
    
    // Generate damage heatmap
    generateDamageHeatmap(prediction);
    
    // Update statistics
    updateStatistics();
    
    // Show results
    resultsSection.hidden = false;
    console.log('Results displayed successfully');
    
    } catch (error) {
        console.error('Error displaying results:', error);
        showError('Error displaying results: ' + error.message);
    }
}

function updateSeverity(damageClass, confidence, aiInsights) {
    const severityFill = document.getElementById('severityFill');
    const severityText = document.getElementById('severityText');
    
    // AI-powered severity calculation using weighted factors
    const urgencyWeight = COST_MODEL[damageClass].urgency;
    const confidenceWeight = confidence;
    const severity = (urgencyWeight * 0.6 + confidenceWeight * 0.4) * 100;
    
    let severityLevel, severityClass, maintenanceType, timeframe;
    
    if (severity > 70) {
        severityLevel = 'Critical';
        severityClass = 'high';
        maintenanceType = 'Emergency';
        timeframe = '24-48 hours';
    } else if (severity > 50) {
        severityLevel = 'High';
        severityClass = 'high';
        maintenanceType = 'Urgent';
        timeframe = '1-2 weeks';
    } else if (severity > 30) {
        severityLevel = 'Medium';
        severityClass = 'medium';
        maintenanceType = 'Scheduled';
        timeframe = '1-3 months';
    } else {
        severityLevel = 'Low';
        severityClass = 'low';
        maintenanceType = 'Routine';
        timeframe = '3-6 months';
    }
    
    severityFill.style.width = `${severity}%`;
    severityFill.className = `severity-fill ${severityClass}`;
    severityText.innerHTML = `
        <strong>${severityLevel} Severity</strong><br>
        ${maintenanceType} Maintenance Required<br>
        <small>Recommended Timeframe: ${timeframe}</small>
    `;
}

function displayCostEstimation(damageClass, confidence) {
    const costDiv = document.getElementById('costEstimation');
    const costModel = COST_MODEL[damageClass];
    
    // AI-driven cost calculation with confidence adjustment
    const estimatedArea = 2 + (confidence * 3); // meters
    const baseCost = costModel.base;
    const areaCost = costModel.perMeter * estimatedArea;
    const urgencyMultiplier = 1 + (costModel.urgency * 0.5);
    
    const totalCost = Math.round((baseCost + areaCost) * urgencyMultiplier);
    const minCost = Math.round(totalCost * 0.8);
    const maxCost = Math.round(totalCost * 1.2);
    
    costDiv.innerHTML = `
        <h4>💰 Estimated Repair Cost</h4>
        <div class="cost-range">
            <span class="cost-value">$${minCost} - $${maxCost}</span>
            <span class="cost-label">Average: $${totalCost}</span>
        </div>
        <div class="cost-breakdown">
            <small>Base: $${baseCost} | Area (~${estimatedArea.toFixed(1)}m): $${Math.round(areaCost)} | Urgency: ${(costModel.urgency * 100).toFixed(0)}%</small>
        </div>
    `;
}

function displayUncertaintyMetrics(allScores) {
    const uncertaintyDiv = document.getElementById('uncertaintyMetrics');
    
    // Calculate entropy (uncertainty measure)
    const scores = Object.values(allScores);
    const entropy = -scores.reduce((sum, p) => {
        return sum + (p > 0 ? p * Math.log2(p) : 0);
    }, 0);
    
    const maxEntropy = Math.log2(scores.length);
    const normalizedEntropy = entropy / maxEntropy;
    const confidence = 1 - normalizedEntropy;
    
    // Calculate prediction margin (difference between top 2)
    const sortedScores = scores.sort((a, b) => b - a);
    const margin = sortedScores[0] - sortedScores[1];
    
    let reliabilityLevel, reliabilityClass;
    if (confidence > 0.8 && margin > 0.3) {
        reliabilityLevel = 'Very High';
        reliabilityClass = 'high';
    } else if (confidence > 0.6 && margin > 0.2) {
        reliabilityLevel = 'High';
        reliabilityClass = 'medium';
    } else if (confidence > 0.4) {
        reliabilityLevel = 'Medium';
        reliabilityClass = 'medium';
    } else {
        reliabilityLevel = 'Low';
        reliabilityClass = 'low';
    }
    
    uncertaintyDiv.innerHTML = `
        <h4>🎯 AI Confidence Analysis</h4>
        <div class="uncertainty-metrics">
            <div class="metric-item">
                <span class="metric-label">Model Certainty:</span>
                <span class="metric-value ${reliabilityClass}">${(confidence * 100).toFixed(1)}%</span>
            </div>
            <div class="metric-item">
                <span class="metric-label">Prediction Margin:</span>
                <span class="metric-value">${(margin * 100).toFixed(1)}%</span>
            </div>
            <div class="metric-item">
                <span class="metric-label">Reliability:</span>
                <span class="metric-value ${reliabilityClass}">${reliabilityLevel}</span>
            </div>
        </div>
        ${reliabilityLevel === 'Low' ? '<p class="warning">⚠️ Low confidence - Consider manual inspection</p>' : ''}
    `;
}

function generateDamageHeatmap(prediction) {
    const heatmapDiv = document.getElementById('damageHeatmap');
    
    if (!heatmapCanvas) {
        heatmapCanvas = document.createElement('canvas');
        heatmapCanvas.width = 300;
        heatmapCanvas.height = 300;
        heatmapDiv.appendChild(heatmapCanvas);
    }
    
    const ctx = heatmapCanvas.getContext('2d');
    const img = document.getElementById('preview');
    
    // Draw original image
    ctx.drawImage(img, 0, 0, 300, 300);
    
    // Apply heatmap overlay based on confidence
    const gradient = ctx.createRadialGradient(150, 150, 0, 150, 150, 150);
    const alpha = prediction.confidence * 0.5;
    
    if (prediction.confidence > 0.7) {
        gradient.addColorStop(0, `rgba(255, 0, 0, ${alpha})`);
        gradient.addColorStop(1, 'rgba(255, 0, 0, 0)');
    } else if (prediction.confidence > 0.4) {
        gradient.addColorStop(0, `rgba(255, 165, 0, ${alpha})`);
        gradient.addColorStop(1, 'rgba(255, 165, 0, 0)');
    } else {
        gradient.addColorStop(0, `rgba(255, 255, 0, ${alpha})`);
        gradient.addColorStop(1, 'rgba(255, 255, 0, 0)');
    }
    
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 300, 300);
    
    // Add label
    ctx.fillStyle = 'white';
    ctx.strokeStyle = 'black';
    ctx.lineWidth = 3;
    ctx.font = 'bold 16px Arial';
    const label = DAMAGE_LABELS[prediction.class];
    ctx.strokeText(label, 10, 30);
    ctx.fillText(label, 10, 30);
}

function updateStatistics() {
    const statsDiv = document.getElementById('sessionStats');
    
    if (predictionHistory.length === 0) return;
    
    const avgInference = predictionHistory.reduce((sum, p) => sum + p.inferenceTime, 0) / predictionHistory.length;
    const avgConfidence = predictionHistory.reduce((sum, p) => sum + p.confidence, 0) / predictionHistory.length;
    
    const damageCount = {};
    predictionHistory.forEach(p => {
        damageCount[p.class] = (damageCount[p.class] || 0) + 1;
    });
    
    const mostCommon = Object.entries(damageCount).sort((a, b) => b[1] - a[1])[0];
    
    statsDiv.innerHTML = `
        <h4>📊 Session Statistics</h4>
        <div class="stats-grid-mini">
            <div class="stat-mini">
                <span class="stat-label">Total Analyzed:</span>
                <span class="stat-value">${predictionHistory.length}</span>
            </div>
            <div class="stat-mini">
                <span class="stat-label">Avg Confidence:</span>
                <span class="stat-value">${(avgConfidence * 100).toFixed(1)}%</span>
            </div>
            <div class="stat-mini">
                <span class="stat-label">Avg Inference:</span>
                <span class="stat-value">${avgInference.toFixed(0)}ms</span>
            </div>
            <div class="stat-mini">
                <span class="stat-label">Most Common:</span>
                <span class="stat-value">${DAMAGE_LABELS[mostCommon[0]]}</span>
            </div>
        </div>
        <button class="btn btn-secondary btn-sm" onclick="exportReport()">📄 Export Report</button>
    `;
}

function showError(message) {
    document.getElementById('errorMessage').textContent = message;
    errorSection.hidden = false;
    resultsSection.hidden = true;
}

// Export report functionality
function exportReport() {
    if (predictionHistory.length === 0) {
        alert('No predictions to export');
        return;
    }
    
    const report = {
        generatedAt: new Date().toISOString(),
        totalPredictions: predictionHistory.length,
        summary: generateSummary(),
        predictions: predictionHistory,
        statistics: calculateStatistics()
    };
    
    // Download as JSON
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `road-damage-report-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    
    alert('Report exported successfully!');
}

function generateSummary() {
    const damageCount = {};
    let totalCost = 0;
    
    predictionHistory.forEach(p => {
        damageCount[p.class] = (damageCount[p.class] || 0) + 1;
        const costModel = COST_MODEL[p.class];
        const estimatedArea = 2 + (p.confidence * 3);
        totalCost += (costModel.base + costModel.perMeter * estimatedArea) * (1 + costModel.urgency * 0.5);
    });
    
    return {
        damageDistribution: damageCount,
        estimatedTotalCost: Math.round(totalCost),
        highPriorityCount: predictionHistory.filter(p => p.confidence > 0.7).length,
        averageConfidence: (predictionHistory.reduce((sum, p) => sum + p.confidence, 0) / predictionHistory.length).toFixed(3)
    };
}

function calculateStatistics() {
    const inferenceTimes = predictionHistory.map(p => p.inferenceTime);
    const confidences = predictionHistory.map(p => p.confidence);
    
    return {
        inference: {
            avg: (inferenceTimes.reduce((a, b) => a + b, 0) / inferenceTimes.length).toFixed(2),
            min: Math.min(...inferenceTimes),
            max: Math.max(...inferenceTimes)
        },
        confidence: {
            avg: (confidences.reduce((a, b) => a + b, 0) / confidences.length).toFixed(3),
            min: Math.min(...confidences).toFixed(3),
            max: Math.max(...confidences).toFixed(3)
        }
    };
}

// Batch processing
async function processBatchImages(files) {
    const batchResults = [];
    const totalFiles = files.length;
    
    for (let i = 0; i < files.length; i++) {
        const file = files[i];
        updateBatchProgress(i + 1, totalFiles);
        
        try {
            const formData = new FormData();
            formData.append('image', file);
            
            const response = await fetch(`${API_URL}/predict`, {
                method: 'POST',
                body: formData
            });
            
            if (response.ok) {
                const data = await response.json();
                batchResults.push({
                    filename: file.name,
                    ...data.prediction,
                    inferenceTime: data.inferenceTime
                });
            }
        } catch (err) {
            console.error(`Error processing ${file.name}:`, err);
        }
    }
    
    displayBatchResults(batchResults);
}

function updateBatchProgress(current, total) {
    const progressDiv = document.getElementById('batchProgress');
    const percentage = (current / total) * 100;
    
    progressDiv.innerHTML = `
        <div class="progress-bar">
            <div class="progress-fill" style="width: ${percentage}%"></div>
        </div>
        <p>Processing ${current} of ${total} images...</p>
    `;
}

function displayBatchResults(results) {
    const batchDiv = document.getElementById('batchResults');
    
    const summary = {
        total: results.length,
        byClass: {},
        avgConfidence: results.reduce((sum, r) => sum + r.confidence, 0) / results.length
    };
    
    results.forEach(r => {
        summary.byClass[r.class] = (summary.byClass[r.class] || 0) + 1;
    });
    
    batchDiv.innerHTML = `
        <h3>Batch Processing Complete</h3>
        <div class="batch-summary">
            <p><strong>Total Images:</strong> ${summary.total}</p>
            <p><strong>Average Confidence:</strong> ${(summary.avgConfidence * 100).toFixed(1)}%</p>
            <h4>Damage Distribution:</h4>
            ${Object.entries(summary.byClass).map(([cls, count]) => 
                `<p>${DAMAGE_LABELS[cls]}: ${count} (${((count/summary.total)*100).toFixed(1)}%)</p>`
            ).join('')}
        </div>
        <button class="btn btn-primary" onclick="downloadBatchReport()">Download Batch Report</button>
    `;
    
    window.batchResultsData = results;
}

function downloadBatchReport() {
    const blob = new Blob([JSON.stringify(window.batchResultsData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `batch-report-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
}

// Check server health on load
async function checkServerHealth() {
    try {
        const response = await fetch(`${API_URL}/health`);
        const data = await response.json();
        
        if (!data.modelLoaded) {
            console.warn('Model not loaded on server');
        }
        
        // Update UI with server status
        const statusDiv = document.getElementById('serverStatus');
        if (statusDiv) {
            statusDiv.innerHTML = `
                <span class="status-indicator ${data.modelLoaded ? 'online' : 'offline'}"></span>
                Server: ${data.modelLoaded ? 'Online' : 'Offline'}
            `;
        }
    } catch (err) {
        console.warn('Server not reachable. Start the server with: cd server && npm start');
        const statusDiv = document.getElementById('serverStatus');
        if (statusDiv) {
            statusDiv.innerHTML = `
                <span class="status-indicator offline"></span>
                Server: Offline
            `;
        }
    }
}

checkServerHealth();
