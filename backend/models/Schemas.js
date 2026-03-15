const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

// ==================== USER ====================
const UserSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: { type: String, enum: ['admin', 'manager', 'worker'], default: 'worker' },
  isActive: { type: Boolean, default: true }
}, { timestamps: true });
UserSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 10); next();
});
UserSchema.methods.matchPassword = async function(p) { return bcrypt.compare(p, this.password); };

// ==================== MACHINE ====================
const MachineSchema = new mongoose.Schema({
  machineId: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  type: { type: String, enum: ['Loom', 'Spinning', 'Dyeing', 'Cutting', 'Finishing'], default: 'Loom' },
  status: { type: String, enum: ['Running', 'Idle', 'Maintenance', 'Fault'], default: 'Idle' },
  totalRuntimeHours: { type: Number, default: 0 },
  avgHoursPerDay: { type: Number, default: 8 },
  serviceThreshold: { type: Number, default: 500 },
  healthScore: { type: Number, default: 100 },
  productionPerHour: { type: Number, default: 50 },
  currentJob: { type: String, default: null },
  vibration: { type: Number, default: 0.2 },
  temperature: { type: Number, default: 35 },
  energyKw: { type: Number, default: 3.5 },
  rpm: { type: Number, default: 1000 },
  location: { type: String, default: 'Floor A' },
  lastServiceDate: { type: Date, default: null },
  nextServiceDate: { type: Date, default: null },
  maintenanceLogs: [{
    type: { type: String, enum: ['Scheduled', 'Emergency', 'Inspection'], default: 'Scheduled' },
    description: String, performedBy: String,
    cost: { type: Number, default: 0 },
    date: { type: Date, default: Date.now },
    hoursAtService: Number
  }],
  alertSent: { type: Boolean, default: false },
  totalMaintenanceCost: { type: Number, default: 0 },
  // Load management
  canAutoSwitch: { type: Boolean, default: true },
  minLoadThreshold: { type: Number, default: 20 } // % load below which machine can be switched off
}, { timestamps: true });

// ==================== INVENTORY ====================
const InventorySchema = new mongoose.Schema({
  barcode: { type: String, required: true, unique: true },
  qrCode: { type: String, default: '' }, // base64 QR image
  itemName: { type: String, required: true },
  vendorName: { type: String, default: '' },
  category: { type: String, default: 'Raw Material' },
  stockLevel: { type: Number, default: 0 },
  reorderPoint: { type: Number, default: 100 },
  unit: { type: String, default: 'meters' },
  location: { type: String, default: 'Warehouse A' },
  processingStatus: { type: String, enum: ['Raw', 'Processing', 'Finished', 'Dispatched'], default: 'Raw' },
  lifecycle: [{
    stage: { type: String, enum: ['Received', 'Quality Check', 'In Production', 'Finished', 'Packed', 'Dispatched', 'Delivered'] },
    location: String,
    note: String,
    performedBy: String,
    timestamp: { type: Date, default: Date.now }
  }],
  movementHistory: [{
    from: String, to: String, movedBy: String,
    timestamp: { type: Date, default: Date.now }
  }],
  lowStockAlertSent: { type: Boolean, default: false }
}, { timestamps: true });

// ==================== QUALITY LOG ====================
const QualityLogSchema = new mongoose.Schema({
  batchId: { type: String, required: true },
  machineId: { type: String, required: true },
  vendorName: { type: String, default: '' },
  inspectorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  defects: [{
    type: { type: String, enum: ['Hole', 'Stain', 'BrokenYarn', 'Misweave', 'OilSpot', 'ColorBleed', 'Other'] },
    count: Number, severity: { type: String, enum: ['Low', 'Medium', 'High'], default: 'Low' }
  }],
  totalDefects: { type: Number, default: 0 },
  grade: { type: String, enum: ['A', 'B', 'C', 'REJECT'], default: 'A' },
  aiDetected: { type: Boolean, default: false },
  inspectedAt: { type: Date, default: Date.now }
}, { timestamps: true });

// ==================== JOB ====================
const JobSchema = new mongoose.Schema({
  orderId: { type: String, required: true },
  fabricType: { type: String, required: true },
  totalMeters: { type: Number, default: 100 },
  completedMeters: { type: Number, default: 0 },
  priority: { type: Number, default: 2 },
  status: { type: String, enum: ['Pending', 'In-Progress', 'Completed', 'Cancelled'], default: 'Pending' },
  assignedMachine: { type: String, default: null },
  assignedWorker: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  deadline: { type: Date },
  color: { type: String, default: '#6366f1' },
  estimatedHours: { type: Number, default: 4 },
  // New: placement info
  floor: { type: String, default: 'Floor A' },
  section: { type: String, default: '' },
  clientName: { type: String, default: '' },
  notes: { type: String, default: '' }
}, { timestamps: true });

// ==================== ORDER ====================
const OrderSchema = new mongoose.Schema({
  orderId: { type: String, required: true, unique: true },
  clientName: { type: String, required: true },
  clientEmail: { type: String, default: '' },
  fabricType: { type: String, required: true },
  totalMeters: { type: Number, default: 0 },
  totalAmount: { type: Number, default: 0 },
  paymentStatus: { type: String, enum: ['Unpaid', 'Partial', 'Paid', 'Refunded'], default: 'Unpaid' },
  status: { type: String, enum: ['Received', 'In Production', 'Quality Check', 'Dispatched', 'Delivered'], default: 'Received' },
  deadline: { type: Date }, dispatchedAt: { type: Date }
}, { timestamps: true });

// ==================== SUPPLIER ====================
const SupplierSchema = new mongoose.Schema({
  supplierId: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  contact: { type: String, default: '' },
  email: { type: String, default: '' },
  materials: [String],
  deliveryHistory: [{
    orderId: String,
    expectedDate: Date,
    actualDate: Date,
    onTime: Boolean,
    qualityScore: Number,
    amount: { type: Number, default: 0 },
    paidOnTime: { type: Boolean, default: true },
    paymentDate: Date
  }],
  reliabilityScore: { type: Number, default: 80 },
  lateDeliveryRate: { type: Number, default: 10 },
  defectRate: { type: Number, default: 5 },
  avgDeliveryGapDays: { type: Number, default: 0 }, // avg days early/late
  earlyPaymentBonus: { type: Number, default: 0 },  // times we paid before due date
  riskLevel: { type: String, enum: ['Low', 'Medium', 'High'], default: 'Low' },
  isActive: { type: Boolean, default: true }
}, { timestamps: true });

// ==================== LEDGER ====================
const LedgerSchema = new mongoose.Schema({
  type: { type: String, enum: ['INFLOW', 'OUTFLOW'], required: true },
  amount: { type: Number, required: true },
  dueDate: Date,
  description: { type: String, required: true },
  party: { type: String, default: '' },
  category: { type: String, enum: ['Material', 'Salary', 'Utility', 'Order', 'Maintenance', 'Other'], default: 'Other' },
  status: { type: String, enum: ['Pending', 'Completed', 'Overdue'], default: 'Pending' },
  lastReminderSent: { type: Date, default: null }
}, { timestamps: true });

// ==================== SENSOR LOG ====================
const SensorLogSchema = new mongoose.Schema({
  machineId: { type: String, required: true },
  vibration: Number, temperature: Number, energyKw: Number,
  rpm: Number, productionMeter: Number,
  anomaly: { type: Boolean, default: false },
  anomalyType: { type: String, default: '' }
}, { timestamps: true });

// ==================== SALES PREDICTION DATA ====================
const SalesPredictionSchema = new mongoose.Schema({
  fabricType: { type: String, required: true },
  month: { type: Number, required: true }, // 1-12
  year: { type: Number, required: true },
  actualSales: { type: Number, default: 0 }, // meters sold
  predictedSales: { type: Number, default: 0 },
  confidence: { type: Number, default: 0.8 },
  suggestedProduction: { type: Number, default: 0 }
}, { timestamps: true });

module.exports = {
  User: mongoose.model('User', UserSchema),
  Machine: mongoose.model('Machine', MachineSchema),
  Inventory: mongoose.model('Inventory', InventorySchema),
  QualityLog: mongoose.model('QualityLog', QualityLogSchema),
  Job: mongoose.model('Job', JobSchema),
  Order: mongoose.model('Order', OrderSchema),
  Supplier: mongoose.model('Supplier', SupplierSchema),
  Ledger: mongoose.model('Ledger', LedgerSchema),
  SensorLog: mongoose.model('SensorLog', SensorLogSchema),
  SalesPrediction: mongoose.model('SalesPrediction', SalesPredictionSchema)
};
