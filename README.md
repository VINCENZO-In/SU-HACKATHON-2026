# 🧵 WeaveMind — Smart Textile Factory OS

A full-stack AI-powered manufacturing management platform for textile factories, featuring real-time IoT monitoring and YOLOv8 defect detection.

---

## 📁 Project Structure

```
weavemind/
├── backend/          ← Node.js + Express + MongoDB API
├── frontend/         ← React.js dashboard UI
└── ml_service/       ← Python + FastAPI + YOLOv8 ML service
```

---

## 🚀 Quick Start

### 1. Backend Setup
```bash
cd backend
npm install
cp .env.example .env  # Update with your MongoDB & Email credentials
npm run seed          # Seeds demo data
npm start             # Starts server on port 5001
```

### 2. ML Service Setup (Python 3.10+)
```bash
cd ml_service
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
python -m uvicorn main:app --port 8001
```

### 3. Frontend Setup
```bash
cd frontend
npm install
npm start             # Starts React app on port 3000
```

Open: **http://localhost:3000**

---

## 🚀 Vercel Deployment (Monorepo)

To deploy the Frontend and Backend to Vercel:

1.  **Connect your GitHub Repo** to a new project in Vercel.
2.  **Environment Variables:** Add all variables from `backend/.env.example` to the Vercel project settings (prefixed by `process.env` in the backend).
3.  **Automatic Routing:** The root `vercel.json` handles the monorepo structure, routing `/api` to the Node.js backend and all other traffic to the React frontend.
4.  **Note:** The `ml_service` (Python) should be deployed separately (e.g., on Render, AWS, or DigitalOcean) as it requires a persistent Python environment and large ML dependencies.

---

## 🔧 Core Modules

### 🔐 Multi-Role Access
- **Admin:** Full system configuration and financial oversight.
- **Manager:** Production scheduling, inventory control, and order management.
- **Worker:** Focused view for assigned production jobs and maintenance.

### ⚙️ IoT Machine Monitoring
- Real-time sensor telemetry (Vibration, Temp, Energy, RPM) via Socket.IO.
- **Predictive Maintenance:** AI-calculated health scores and service countdowns.
- Live status tracking with anomaly detection alerts.

### 🔬 AI Quality Control (WeaveMind Perfect™)
- **YOLOv8 Defect Detection:** Real-time scanning for holes, stains, and misweaves.
- **Tiled Inference:** High-precision scanning of large fabric rolls in overlapping patches.
- **Adaptive Preprocessing:** Dynamic CLAHE and sharpening for various fabric textures.
- Professional grading system (A/B/C/REJECT).

### 📦 Smart Inventory
- Barcode/QR asset tracking with movement history.
- **Auto-Replenishment:** Low stock triggers automated reorder emails to best-ranked suppliers.

### 🚚 Supplier Intelligence
- **Vendor Reliability Score:** Algorithm using delivery speed, quality, and payment history.
- Risk analysis (Low/Medium/High) with alternative source recommendations.

---

## 🛠 Tech Stack

- **Backend:** Node.js, Express, MongoDB (Mongoose), Socket.IO, JWT, Nodemailer.
- **Frontend:** React 18, Framer Motion (Animations), Recharts (Analytics), Axios.
- **ML Service:** Python 3.10, YOLOv8 (Ultralytics), FastAPI, OpenCV, Torch.
- **Design:** Industrial Dark Theme with custom glassmorphism and micro-animations.

---

## 🛡 License
Distributed under the MIT License. See `LICENSE` for more information.
