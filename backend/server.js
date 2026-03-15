require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const cron = require('node-cron');
const connectDB = require('./config/db');
const emailService = require('./services/emailService');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

connectDB();
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use((req, res, next) => { req.io = io; next(); });

app.use('/api/auth',        require('./routes/authRoutes'));
app.use('/api/machines',    require('./routes/machineRoutes'));
app.use('/api/inventory',   require('./routes/inventoryRoutes'));
app.use('/api/quality',     require('./routes/qualityRoutes'));
app.use('/api/jobs',        require('./routes/jobRoutes'));
app.use('/api/suppliers',   require('./routes/supplierRoutes'));
app.use('/api/orders',      require('./routes/orderRoutes'));
app.use('/api/ml',          require('./routes/mlRoutes'));
app.use('/api/maintenance', require('./routes/maintenanceRoutes'));
app.use('/api/energy',      require('./routes/energyRoutes'));
app.use('/api/payments',    require('./routes/paymentRoutes'));
app.use('/api/reports',     require('./routes/reportRoutes'));
app.use('/api/sales',       require('./routes/salesRoutes'));

app.get('/api/health', (req, res) => res.json({ status: 'OK', time: new Date() }));

// ── CRON: Daily 8am — overdue payment emails ────────────────────────────────
cron.schedule('0 8 * * *', async () => {
  const { Ledger, Supplier } = require('./models/Schemas');
  const now = new Date();
  const overdue = await Ledger.find({ status: 'Pending', dueDate: { $lt: now }, type: 'OUTFLOW' });
  for (const entry of overdue) {
    const daysOverdue = Math.floor((now - new Date(entry.dueDate)) / 86400000);
    if (daysOverdue < 1) continue;
    const lastSent = entry.lastReminderSent;
    if (lastSent && (now - new Date(lastSent)) < 3 * 86400000) continue;
    const supplier = await Supplier.findOne({ name: { $regex: entry.party, $options: 'i' } }) || { name: entry.party, email: null };
    await emailService.sendSupplierPaymentReminder({ supplier, ledgerEntry: entry, daysOverdue, dueDate: entry.dueDate });
    await Ledger.findByIdAndUpdate(entry._id, { lastReminderSent: new Date() });
    io.emit('payment_alert', { party: entry.party, amount: entry.amount, daysOverdue });
  }
});

// ── CRON: Hourly — maintenance + low stock checks ───────────────────────────
cron.schedule('0 * * * *', async () => {
  const { Machine, Inventory, Supplier } = require('./models/Schemas');
  // Maintenance
  for (const machine of await Machine.find()) {
    const rem = machine.serviceThreshold - (machine.totalRuntimeHours % machine.serviceThreshold);
    if (rem <= 20 && !machine.alertSent) {
      await Machine.findOneAndUpdate({ machineId: machine.machineId }, { alertSent: true });
      await emailService.sendMaintenanceAlert({ machine, urgency: rem <= 0 ? 'OVERDUE' : 'CRITICAL', hoursRemaining: Math.max(0, +rem.toFixed(1)), daysRemaining: +(rem / (machine.avgHoursPerDay || 8)).toFixed(1) });
      io.emit('maintenance_alert', { machineId: machine.machineId, name: machine.name, urgency: rem <= 0 ? 'OVERDUE' : 'CRITICAL', hoursRemaining: Math.max(0, +rem.toFixed(1)) });
    }
  }
  // Low stock
  for (const item of await Inventory.find({ $expr: { $lte: ['$stockLevel', '$reorderPoint'] } })) {
    if (item.lowStockAlertSent) continue;
    const suppliers = await Supplier.find({ materials: { $regex: item.itemName, $options: 'i' }, isActive: true }).sort({ reliabilityScore: -1 });
    if (suppliers[0]?.email) {
      await emailService.sendLowStockAlert({ item, supplier: suppliers[0] });
      await Inventory.findByIdAndUpdate(item._id, { lowStockAlertSent: true });
      io.emit('low_stock_alert', { itemName: item.itemName, supplierName: suppliers[0].name });
    }
  }
});

// ── Socket.IO ────────────────────────────────────────────────────────────────
io.on('connection', (socket) => {
  console.log('📊 Client:', socket.id);

  socket.on('request_dashboard', async () => {
    const { Machine, Job, Order, Inventory } = require('./models/Schemas');
    const [machines, jobs, orders, lowStock] = await Promise.all([
      Machine.find(), Job.find({ status: 'In-Progress' }),
      Order.find({ status: { $in: ['Received', 'In Production'] } }),
      Inventory.find({ $expr: { $lte: ['$stockLevel', '$reorderPoint'] } })
    ]);
    socket.emit('dashboard_data', { machines, activeJobs: jobs.length, pendingOrders: orders.length, lowStockAlerts: lowStock.length });
  });

  const sensorInterval = setInterval(async () => {
    const { Machine, SensorLog } = require('./models/Schemas');
    const machines = await Machine.find({ status: 'Running' });
    for (const machine of machines) {
      const isAnomaly = Math.random() < 0.08;
      const data = {
        machineId: machine.machineId,
        vibration: +(isAnomaly ? 0.8 + Math.random()*0.5 : 0.1 + Math.random()*0.4).toFixed(3),
        temperature: +(isAnomaly ? 75 + Math.random()*20 : 30 + Math.random()*25).toFixed(1),
        energyKw: +(3 + Math.random()*3).toFixed(2),
        rpm: +(900 + Math.random()*300).toFixed(0),
        productionMeter: +(40 + Math.random()*20).toFixed(0),
        anomaly: isAnomaly,
        anomalyType: isAnomaly ? ['High Vibration','Overheating','Power Surge'][Math.floor(Math.random()*3)] : ''
      };
      await SensorLog.create(data);
      io.emit('sensor_stream', data);
      if (isAnomaly) io.emit('machine_alert', { machineId: machine.machineId, type: data.anomalyType, severity: 'HIGH' });
      const newH = machine.totalRuntimeHours + 5/3600;
      const rem = machine.serviceThreshold - (newH % machine.serviceThreshold);
      const upd = { totalRuntimeHours: newH, vibration: data.vibration, temperature: data.temperature, energyKw: data.energyKw, rpm: data.rpm };
      if (isAnomaly) upd.healthScore = Math.max(0, (machine.healthScore||100) - 0.5);
      await Machine.findOneAndUpdate({ machineId: machine.machineId }, upd);
      if (!machine.alertSent && rem <= 20) {
        await Machine.findOneAndUpdate({ machineId: machine.machineId }, { alertSent: true });
        const urgency = rem <= 0 ? 'OVERDUE' : 'CRITICAL';
        io.emit('maintenance_alert', { machineId: machine.machineId, name: machine.name, urgency, hoursRemaining: Math.max(0, +rem.toFixed(1)), daysRemaining: +(rem/(machine.avgHoursPerDay||8)).toFixed(1) });
        emailService.sendMaintenanceAlert({ machine, urgency, hoursRemaining: Math.max(0, +rem.toFixed(1)), daysRemaining: +(rem/(machine.avgHoursPerDay||8)).toFixed(1) }).catch(()=>{});
      }
    }
  }, 5000);

  socket.on('disconnect', () => { clearInterval(sensorInterval); });
});

server.listen(process.env.PORT || 5001, () => console.log(`🚀 WeaveMind v4 on port ${process.env.PORT || 5001}`));
