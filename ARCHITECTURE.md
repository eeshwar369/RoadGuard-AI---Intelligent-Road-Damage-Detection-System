# System Architecture

## Overview
```
┌─────────────────────────────────────────────────────────────┐
│                     Road Damage Detection                    │
│                    Edge AI System                            │
└─────────────────────────────────────────────────────────────┘

┌──────────────┐      ┌──────────────┐      ┌──────────────┐
│   Dataset    │─────▶│ Edge Impulse │─────▶│   Optimized  │
│ Preparation  │      │   Training   │      │    Model     │
└──────────────┘      └──────────────┘      └──────────────┘
                                                     │
                                                     ▼
┌──────────────────────────────────────────────────────────────┐
│                      Deployment Layer                         │
├──────────────────────────────────────────────────────────────┤
│  ┌────────────┐         ┌────────────┐         ┌──────────┐ │
│  │  Node.js   │◀───────▶│  Web UI    │◀───────▶│  Camera  │ │
│  │   Server   │         │ (Browser)  │         │  /Upload │ │
│  └────────────┘         └────────────┘         └──────────┘ │
└──────────────────────────────────────────────────────────────┘
                              │
                              ▼
                    ┌──────────────────┐
                    │   Predictions    │
                    │  + Confidence    │
                    │  + Severity      │
                    └──────────────────┘
```

## Component Details

### 1. Data Pipeline
```
Raw Images (RDD2022)
    │
    ├─ Resize (320x320)
    ├─ Normalize
    ├─ Augment (brightness, rotation, blur)
    └─ Split (70/20/10)
    │
    ▼
Processed Dataset
    ├─ train/
    ├─ val/
    └─ test/
```

### 2. Model Training (Edge Impulse)
```
Input: 320x320x3 RGB Image
    │
    ▼
┌─────────────────────┐
│  Image Processing   │
│  - RGB extraction   │
│  - Normalization    │
└─────────────────────┘
    │
    ▼
┌─────────────────────┐
│  MobileNetV2 0.35   │
│  - Feature extract  │
│  - Transfer learn   │
└─────────────────────┘
    │
    ▼
┌─────────────────────┐
│  Classification     │
│  - 4 damage classes │
│  - Softmax output   │
└─────────────────────┘
    │
    ▼
Output: Class probabilities
```

### 3. Backend API (Node.js + Express)

**Endpoints:**
```
GET  /health          - Server health check
POST /predict         - Single image prediction
POST /predict-batch   - Batch predictions
GET  /model-info      - Model metadata
```

**Request Flow:**
```
Client Upload
    │
    ▼
Multer (file handling)
    │
    ▼
Image Preprocessing
    │
    ▼
Edge Impulse Model
    │
    ▼
Post-processing
    │
    ▼
JSON Response
```

### 4. Frontend UI

**Components:**
```
┌─────────────────────────────────────┐
│           Main Interface            │
├─────────────────────────────────────┤
│  ┌───────────┐    ┌──────────────┐ │
│  │  Upload   │    │   Camera     │ │
│  │  Section  │    │   Section    │ │
│  └───────────┘    └──────────────┘ │
├─────────────────────────────────────┤
│         Results Display             │
│  - Damage type                      │
│  - Confidence score                 │
│  - All class probabilities          │
│  - Severity assessment              │
│  - Inference time                   │
└─────────────────────────────────────┘
```

### 5. Evaluation Pipeline
```
Test Images
    │
    ▼
Batch Inference
    │
    ▼
Metrics Calculation
    ├─ Confusion Matrix
    ├─ Precision/Recall/F1
    ├─ Per-class accuracy
    └─ Inference time stats
    │
    ▼
Results Export
    ├─ JSON report
    └─ CSV confusion matrix
```

## Data Flow

### Image Upload Flow
```
1. User selects image
2. Preview displayed
3. Image sent to /predict endpoint
4. Server loads image buffer
5. Model inference (Edge Impulse)
6. Results processed
7. JSON response returned
8. UI updates with results
```

### Camera Capture Flow
```
1. User starts camera
2. Video stream displayed
3. User captures frame
4. Canvas extracts image
5. Blob created
6. Same as upload flow (steps 3-8)
```

## Technology Stack

### Frontend
- HTML5 + CSS3
- Vanilla JavaScript
- Canvas API (camera capture)
- Fetch API (HTTP requests)

### Backend
- Node.js 14+
- Express.js (web framework)
- Multer (file uploads)
- Edge Impulse Node SDK

### Model
- Edge Impulse Studio
- MobileNetV2 (base)
- TensorFlow Lite (runtime)
- Quantization (int8)

### Data Processing
- Sharp (image processing)
- Node.js file system

## Deployment Options

### Option 1: Local Development
```
Laptop/Desktop
├─ Node.js server (localhost:3000)
└─ Browser UI (file:// or localhost)
```

### Option 2: Raspberry Pi
```
Raspberry Pi 4
├─ Node.js server
├─ Camera module
└─ Local display or remote access
```

### Option 3: Cloud + Edge
```
Cloud (Vercel/Netlify)
├─ Static UI hosting
└─ API proxy

Edge Device
└─ Model inference
```

### Option 4: Mobile App
```
React Native / Flutter
├─ Embedded model
├─ Camera integration
└─ Offline inference
```

## Performance Characteristics

### Model
- Input: 320x320x3 (307,200 pixels)
- Parameters: ~600K (MobileNetV2 0.35)
- Model size: ~1.5MB (quantized)
- Inference: 50-100ms (CPU)
- Inference: 10-30ms (GPU/NPU)

### API
- Upload limit: 10MB
- Concurrent requests: 10+
- Response time: <200ms (including network)

### UI
- Load time: <1s
- Image preview: Instant
- Results update: <100ms after API response

## Security Considerations

### Current Implementation
- CORS enabled (development)
- File type validation
- File size limits
- No authentication (demo)

### Production Recommendations
- Add API authentication (JWT)
- Rate limiting
- Input sanitization
- HTTPS only
- Secure file storage
- Audit logging

## Scalability

### Horizontal Scaling
```
Load Balancer
    │
    ├─ Server Instance 1
    ├─ Server Instance 2
    └─ Server Instance N
```

### Optimization Strategies
1. Model caching
2. Result caching (for duplicate images)
3. Batch processing
4. Async inference queue
5. CDN for static assets

## Future Enhancements

### Sensor Fusion
```
Camera + IMU + Microphone
    │
    ▼
Multi-modal Model
    │
    ▼
Enhanced Predictions
```

### Continuous Learning
```
User Feedback
    │
    ▼
Data Collection
    │
    ▼
Periodic Retraining
    │
    ▼
Model Update
```

### Integration
```
Road Damage System
    │
    ├─ GIS Mapping
    ├─ Maintenance Scheduling
    ├─ Cost Estimation
    └─ Reporting Dashboard
```
