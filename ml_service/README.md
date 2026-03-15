# 🤖 WeaveMind ML Service — YOLOv8 Fabric Defect Detector

## Your Trained Model

| Property | Value |
|----------|-------|
| Architecture | YOLOv8n |
| Training Epochs | 100 |
| Image Size | 640×640 |
| **mAP50** | **91.87%** |
| Precision | 96.40% |
| Recall | 82.18% |
| Batch Size | 16 |
| Dataset | Roboflow fb-ynxs8 (241 train / 74 val / 108 test images) |

## Defect Classes

| ID | Class | Severity | Color |
|----|-------|----------|-------|
| 0 | Hole | High | 🔴 Red |
| 1 | Stain | Medium | 🟠 Orange |
| 2 | BrokenYarn | High | 🟡 Yellow |
| 3 | Misweave | Medium | 🟣 Purple |

## Files

```
ml_service/
├── main.py          ← FastAPI server (run this)
├── train.py         ← Retrain script
├── best.pt          ← Your trained model weights (6MB)
├── yolov8n.pt       ← Base YOLOv8n weights (fallback)
├── data.yaml        ← Dataset config
└── requirements.txt ← Python dependencies
```

## Setup & Run

```bash
cd ml_service

# Install dependencies
pip install -r requirements.txt

# Start the API server
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

Open: http://localhost:8000/docs  (Interactive Swagger UI)

## API Endpoints

### POST /detect
Upload a fabric image, get defects + grade + annotated image.

```bash
curl -X POST http://localhost:8000/detect \
  -F "file=@fabric_sample.jpg" \
  -F "batch_id=BATCH-001" \
  -F "machine_id=LOOM-01"
```

Response:
```json
{
  "grade": "B",
  "total_defects": 2,
  "defect_summary": {"Hole": 1, "Stain": 1},
  "detections": [
    {"class": "Hole", "confidence": 0.87, "severity": "High", "bbox": {...}},
    {"class": "Stain", "confidence": 0.73, "severity": "Medium", "bbox": {...}}
  ],
  "annotated_image": "<base64 string>",
  "trigger_machine_stop": false,
  "inference_ms": 42.5
}
```

### GET /model/info
Returns your training metrics and class info.

### GET /health
Check if the service is running.

## Grading Logic

| Defects | Grade |
|---------|-------|
| 0 | A (Perfect) |
| 1–2 | B (Minor defects) |
| 3–4 or 1+ High severity | C (Below standard) |
| 5+ or 3+ High severity | REJECT |

## Retrain on New Data

1. Add images to `../datasets/train/images/` and `../datasets/valid/images/`
2. Add YOLO labels to `../datasets/train/labels/` and `../datasets/valid/labels/`
3. Run: `python train.py`
4. Copy `runs/detect/weavemind_train/weights/best.pt` to `ml_service/best.pt`
5. Restart the server

## Integration with Backend

The Node.js backend (port 5001) proxies ML requests through `/api/ml/detect`.
When the frontend uploads an image to `/api/ml/detect`, the backend:
1. Forwards the image to this Python service
2. Gets the detection result
3. Auto-logs it to MongoDB QualityLog
4. Emits a Socket.IO alert if machine stop is triggered
