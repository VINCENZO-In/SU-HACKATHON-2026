"""
WeaveMind — Retrain YOLOv8 on your textile defect dataset
Run: python train.py
"""
from ultralytics import YOLO
import os

MODEL_BASE = "yolov8n.pt"           # pretrained base weights
DATA_YAML  = "../datasets/data.yaml" # path to your data.yaml
EPOCHS     = 100
IMG_SIZE   = 640
BATCH      = 16
DEVICE     = 0          # 0 = first GPU, "cpu" = CPU

def train():
    print("🧵 WeaveMind YOLOv8 Training")
    print(f"   Model   : {MODEL_BASE}")
    print(f"   Data    : {DATA_YAML}")
    print(f"   Epochs  : {EPOCHS}")
    print(f"   Device  : {DEVICE}")
    print()

    model = YOLO(MODEL_BASE)

    results = model.train(
        data=DATA_YAML,
        epochs=EPOCHS,
        imgsz=IMG_SIZE,
        batch=BATCH,
        device=DEVICE,
        workers=1,
        project="runs/detect",
        name="weavemind_train",
        pretrained=True,
        optimizer="auto",
        lr0=0.01,
        patience=20,
        save=True,
        plots=True,
        verbose=True,
    )

    print("\n✅ Training complete!")
    print(f"   Best weights saved to: runs/detect/weavemind_train/weights/best.pt")
    print("   Copy best.pt to ml_service/ to deploy the new model.")

    # Print final metrics
    try:
        metrics = results.results_dict
        print(f"\n📊 Final Metrics:")
        print(f"   mAP50      : {metrics.get('metrics/mAP50(B)', 'N/A'):.4f}")
        print(f"   mAP50-95   : {metrics.get('metrics/mAP50-95(B)', 'N/A'):.4f}")
        print(f"   Precision  : {metrics.get('metrics/precision(B)', 'N/A'):.4f}")
        print(f"   Recall     : {metrics.get('metrics/recall(B)', 'N/A'):.4f}")
    except:
        pass

if __name__ == "__main__":
    train()
