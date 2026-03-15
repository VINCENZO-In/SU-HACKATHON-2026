const { Ledger, SensorLog, Machine, Order, Supplier, QualityLog, Job } = require('../models/Schemas');

// ─── Helper: month label ──────────────────────────────────────────────────────
const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

function monthLabel(year, month) { return `${MONTHS[month - 1]} ${year}`; }

// ─── GET /api/reports/monthly?year=2026&month=3 ────────────────────────────────
exports.getMonthlyReport = async (req, res) => {
  try {
    const year  = parseInt(req.query.year)  || new Date().getFullYear();
    const month = parseInt(req.query.month) || new Date().getMonth() + 1;

    const start = new Date(year, month - 1, 1);
    const end   = new Date(year, month, 0, 23, 59, 59);

    // ── Bills / Ledger ──
    const ledger = await Ledger.find({ createdAt: { $gte: start, $lte: end } });
    const inflow  = ledger.filter(l => l.type === 'INFLOW').reduce((s, l) => s + l.amount, 0);
    const outflow = ledger.filter(l => l.type === 'OUTFLOW').reduce((s, l) => s + l.amount, 0);
    const byCategory = {};
    ledger.forEach(l => {
      if (!byCategory[l.category]) byCategory[l.category] = { inflow: 0, outflow: 0 };
      byCategory[l.category][l.type === 'INFLOW' ? 'inflow' : 'outflow'] += l.amount;
    });

    // ── Energy ──
    const energyAgg = await SensorLog.aggregate([
      { $match: { createdAt: { $gte: start, $lte: end } } },
      { $group: {
          _id: { machineId: '$machineId', day: { $dayOfMonth: '$createdAt' } },
          avgKw: { $avg: '$energyKw' },
          kwhDay: { $sum: { $multiply: ['$energyKw', { $divide: [5, 3600] }] } }
      }},
      { $group: {
          _id: '$_id.machineId',
          totalKwh: { $sum: '$kwhDay' },
          avgKw: { $avg: '$avgKw' }
      }},
      { $sort: { totalKwh: -1 } }
    ]);
    const totalKwh  = energyAgg.reduce((s, e) => s + e.totalKwh, 0);
    const energyCost = parseFloat((totalKwh * 8).toFixed(0)); // ₹8/kWh

    // Daily energy trend
    const dailyEnergy = await SensorLog.aggregate([
      { $match: { createdAt: { $gte: start, $lte: end } } },
      { $group: {
          _id: { $dayOfMonth: '$createdAt' },
          avgKw: { $avg: '$energyKw' },
          totalKwh: { $sum: { $multiply: ['$energyKw', { $divide: [5, 3600] }] } }
      }},
      { $sort: { '_id': 1 } }
    ]);

    // ── Orders ──
    const orders = await Order.find({ createdAt: { $gte: start, $lte: end } });
    const orderRevenue = orders.reduce((s, o) => s + o.totalAmount, 0);
    const paidOrders = orders.filter(o => o.paymentStatus === 'Paid').length;

    // ── Quality ──
    const qualityLogs = await QualityLog.find({ inspectedAt: { $gte: start, $lte: end } });
    const passRate = qualityLogs.length
      ? ((qualityLogs.filter(q => q.grade === 'A' || q.grade === 'B').length / qualityLogs.length) * 100).toFixed(1)
      : 0;

    // ── Machines ──
    const machines = await Machine.find();

    res.json({
      period: { year, month, label: monthLabel(year, month), start, end },
      bills: {
        inflow: parseFloat(inflow.toFixed(0)),
        outflow: parseFloat(outflow.toFixed(0)),
        net: parseFloat((inflow - outflow).toFixed(0)),
        entries: ledger,
        byCategory
      },
      energy: {
        totalKwh: parseFloat(totalKwh.toFixed(2)),
        estimatedCost: energyCost,
        byMachine: energyAgg.map(e => ({
          machineId: e._id,
          totalKwh: parseFloat(e.totalKwh.toFixed(3)),
          avgKw: parseFloat(e.avgKw.toFixed(2)),
          cost: parseFloat((e.totalKwh * 8).toFixed(0))
        })),
        dailyTrend: dailyEnergy.map(d => ({
          day: d._id,
          label: `${d._id} ${MONTHS[month-1]}`,
          avgKw: parseFloat((d.avgKw||0).toFixed(2)),
          totalKwh: parseFloat((d.totalKwh||0).toFixed(3))
        }))
      },
      orders: {
        count: orders.length,
        revenue: parseFloat(orderRevenue.toFixed(0)),
        paidCount: paidOrders,
        collectionRate: orders.length ? ((paidOrders / orders.length) * 100).toFixed(1) : 0
      },
      quality: {
        inspections: qualityLogs.length,
        passRate,
        rejected: qualityLogs.filter(q => q.grade === 'REJECT').length
      },
      machines: {
        total: machines.length,
        avgHealth: machines.length ? (machines.reduce((s, m) => s + (m.healthScore || 0), 0) / machines.length).toFixed(1) : 0,
        maintenanceCost: machines.reduce((s, m) => s + (m.totalMaintenanceCost || 0), 0)
      }
    });
  } catch (err) {
    res.status(500).json({ msg: err.message });
  }
};

// ─── GET /api/reports/yearly?year=2026 ───────────────────────────────────────
exports.getYearlyReport = async (req, res) => {
  try {
    const year = parseInt(req.query.year) || new Date().getFullYear();
    const start = new Date(year, 0, 1);
    const end   = new Date(year, 11, 31, 23, 59, 59);

    // Monthly breakdown of bills
    const monthlyBills = await Ledger.aggregate([
      { $match: { createdAt: { $gte: start, $lte: end } } },
      { $group: {
          _id: { month: { $month: '$createdAt' }, type: '$type' },
          total: { $sum: '$amount' }
      }}
    ]);

    const monthlyBillsMap = {};
    for (let m = 1; m <= 12; m++) {
      monthlyBillsMap[m] = { month: m, label: MONTHS[m-1], inflow: 0, outflow: 0, net: 0 };
    }
    monthlyBills.forEach(b => {
      const m = b._id.month;
      if (b._id.type === 'INFLOW') monthlyBillsMap[m].inflow += b.total;
      else monthlyBillsMap[m].outflow += b.total;
    });
    Object.values(monthlyBillsMap).forEach(m => { m.net = m.inflow - m.outflow; });

    // Monthly energy
    const monthlyEnergy = await SensorLog.aggregate([
      { $match: { createdAt: { $gte: start, $lte: end } } },
      { $group: {
          _id: { $month: '$createdAt' },
          totalKwh: { $sum: { $multiply: ['$energyKw', { $divide: [5, 3600] }] } },
          avgKw: { $avg: '$energyKw' }
      }},
      { $sort: { '_id': 1 } }
    ]);

    const energyByMonth = {};
    for (let m = 1; m <= 12; m++) energyByMonth[m] = { month: m, label: MONTHS[m-1], totalKwh: 0, cost: 0 };
    monthlyEnergy.forEach(e => {
      energyByMonth[e._id].totalKwh = parseFloat(e.totalKwh.toFixed(2));
      energyByMonth[e._id].cost = parseFloat((e.totalKwh * 8).toFixed(0));
    });

    // Monthly orders/revenue
    const monthlyOrders = await Order.aggregate([
      { $match: { createdAt: { $gte: start, $lte: end } } },
      { $group: {
          _id: { $month: '$createdAt' },
          count: { $sum: 1 },
          revenue: { $sum: '$totalAmount' }
      }},
      { $sort: { '_id': 1 } }
    ]);

    const ordersByMonth = {};
    for (let m = 1; m <= 12; m++) ordersByMonth[m] = { month: m, label: MONTHS[m-1], count: 0, revenue: 0 };
    monthlyOrders.forEach(o => {
      ordersByMonth[o._id].count = o.count;
      ordersByMonth[o._id].revenue = parseFloat(o.revenue.toFixed(0));
    });

    // Category-wise annual spending
    const categorySpend = await Ledger.aggregate([
      { $match: { createdAt: { $gte: start, $lte: end }, type: 'OUTFLOW' } },
      { $group: { _id: '$category', total: { $sum: '$amount' } } },
      { $sort: { total: -1 } }
    ]);

    // Totals
    const allLedger = await Ledger.find({ createdAt: { $gte: start, $lte: end } });
    const totalInflow  = allLedger.filter(l => l.type === 'INFLOW').reduce((s, l) => s + l.amount, 0);
    const totalOutflow = allLedger.filter(l => l.type === 'OUTFLOW').reduce((s, l) => s + l.amount, 0);
    const totalEnergyKwh = Object.values(energyByMonth).reduce((s, e) => s + e.totalKwh, 0);

    res.json({
      year,
      totals: {
        inflow: parseFloat(totalInflow.toFixed(0)),
        outflow: parseFloat(totalOutflow.toFixed(0)),
        net: parseFloat((totalInflow - totalOutflow).toFixed(0)),
        energyKwh: parseFloat(totalEnergyKwh.toFixed(2)),
        energyCost: parseFloat((totalEnergyKwh * 8).toFixed(0))
      },
      monthlyBills: Object.values(monthlyBillsMap),
      monthlyEnergy: Object.values(energyByMonth),
      monthlyOrders: Object.values(ordersByMonth),
      categorySpend
    });
  } catch (err) {
    res.status(500).json({ msg: err.message });
  }
};

// ─── GET /api/reports/supplier-ranking ───────────────────────────────────────
exports.getSupplierRanking = async (req, res) => {
  try {
    const suppliers = await Supplier.find({ isActive: true });

    const ranked = suppliers.map(s => {
      const history = s.deliveryHistory || [];
      const total = history.length;
      const onTime = history.filter(d => d.onTime).length;
      const lateRate = total > 0 ? ((total - onTime) / total) * 100 : s.lateDeliveryRate || 0;
      const avgQuality = total > 0
        ? history.reduce((sum, d) => sum + (d.qualityScore || 80), 0) / total
        : 80;

      // Early payment bonus — check ledger for payments made before due date
      // Score algorithm: weighted reliability score
      let score = 100;
      score -= lateRate * 0.8;        // late delivery penalty
      score -= (s.defectRate || 0) * 1.2;  // defect penalty
      score = score * 0.6 + avgQuality * 0.4;
      score = Math.max(0, Math.min(100, Math.round(score)));

      const riskLevel = score >= 80 ? 'Low' : score >= 60 ? 'Medium' : 'High';
      const tier = score >= 85 ? 'Preferred' : score >= 70 ? 'Standard' : score >= 50 ? 'Probation' : 'Blacklist';

      // Suggest paying early if score >= 80 (reliable supplier deserves priority payment)
      const payEarly = score >= 80;
      const earlyPaymentDiscount = payEarly ? '2% discount if paid 10 days early' : null;

      return {
        _id: s._id,
        supplierId: s.supplierId,
        name: s.name,
        email: s.email,
        materials: s.materials,
        score,
        riskLevel,
        tier,
        lateDeliveryRate: parseFloat(lateRate.toFixed(1)),
        defectRate: s.defectRate || 0,
        avgQualityScore: parseFloat(avgQuality.toFixed(1)),
        totalDeliveries: total,
        onTimeDeliveries: onTime,
        payEarly,
        earlyPaymentDiscount,
        recommendation: tier === 'Preferred'
          ? '⭐ Pay early — reliable partner. Request bulk discounts.'
          : tier === 'Standard'
          ? '✅ Pay on time. Monitor quality.'
          : tier === 'Probation'
          ? '⚠️ Delay payment until delivery confirmed. Seek alternatives.'
          : '🚫 Avoid new orders. Find replacement supplier.'
      };
    });

    ranked.sort((a, b) => b.score - a.score);

    res.json({
      total: ranked.length,
      preferred: ranked.filter(s => s.tier === 'Preferred').length,
      atRisk: ranked.filter(s => s.tier === 'Probation' || s.tier === 'Blacklist').length,
      suppliers: ranked
    });
  } catch (err) {
    res.status(500).json({ msg: err.message });
  }
};

// ─── GET /api/reports/machine-optimization ───────────────────────────────────
exports.getMachineOptimization = async (req, res) => {
  try {
    const machines = await Machine.find();
    const pendingJobs = await Job.find({ status: 'Pending' });

    const running = machines.filter(m => m.status === 'Running');
    const idle = machines.filter(m => m.status === 'Idle');
    const totalKw = running.reduce((s, m) => s + (m.energyKw || 0), 0);
    const avgKw = running.length > 0 ? totalKw / running.length : 0;

    // Machines that can be turned off (running but energy > 1.5x avg = overloaded, or no jobs assigned)
    const canShutdown = running
      .filter(m => !m.currentJob && (m.energyKw || 0) < avgKw * 0.6)
      .map(m => ({
        machineId: m.machineId,
        name: m.name,
        energyKw: m.energyKw || 0,
        savingKwh: parseFloat(((m.energyKw || 0) * 8).toFixed(2)), // saving per hour
        reason: 'No active job assigned. Idle running waste.',
        suggestion: 'Switch to standby or off'
      }));

    // Overloaded machines (> 1.5x avg kW)
    const overloaded = running
      .filter(m => (m.energyKw || 0) > avgKw * 1.5)
      .map(m => ({
        machineId: m.machineId,
        name: m.name,
        energyKw: m.energyKw || 0,
        excessKw: parseFloat(((m.energyKw || 0) - avgKw).toFixed(2)),
        suggestion: 'Reduce load — shift jobs to idle machines'
      }));

    // Idle machines with pending jobs (inefficiency)
    const idleWithJobs = idle.map(m => ({
      machineId: m.machineId,
      name: m.name,
      type: m.type,
      healthScore: m.healthScore,
      suggestion: pendingJobs.length > 0 ? `Assign pending job: ${pendingJobs[0]?.fabricType || 'available'}` : 'No pending jobs'
    }));

    // Load suggestions
    const potentialSavingKwh = canShutdown.reduce((s, m) => s + m.energyKw, 0);
    const potentialSavingCost = parseFloat((potentialSavingKwh * 8).toFixed(0));

    res.json({
      summary: {
        totalRunning: running.length,
        totalIdle: idle.length,
        totalKw: parseFloat(totalKw.toFixed(2)),
        avgKw: parseFloat(avgKw.toFixed(2)),
        potentialSavingKwPerHour: parseFloat(potentialSavingKwh.toFixed(2)),
        potentialSavingCostPerHour: potentialSavingCost
      },
      canShutdown,
      overloaded,
      idleWithJobs,
      tips: [
        totalKw > 20 ? `⚡ Total load ${totalKw.toFixed(1)} kW is high — consider off-peak scheduling` : null,
        canShutdown.length > 0 ? `💡 ${canShutdown.length} machines running without jobs — save ₹${potentialSavingCost}/hour by switching off` : null,
        overloaded.length > 0 ? `⚖️ ${overloaded.length} machines overloaded — redistribute to idle machines` : null,
        pendingJobs.length > 0 && idle.length > 0 ? `🏭 ${pendingJobs.length} pending jobs, ${idle.length} idle machines — run optimizer` : null,
      ].filter(Boolean)
    });
  } catch (err) {
    res.status(500).json({ msg: err.message });
  }
};

// ─── GET /api/reports/available-years ────────────────────────────────────────
exports.getAvailableYears = async (req, res) => {
  try {
    const oldest = await Ledger.findOne().sort({ createdAt: 1 });
    const currentYear = new Date().getFullYear();
    const startYear = oldest ? new Date(oldest.createdAt).getFullYear() : currentYear;
    const years = [];
    for (let y = startYear; y <= currentYear; y++) years.push(y);
    res.json(years);
  } catch (err) {
    res.json([new Date().getFullYear()]);
  }
};
