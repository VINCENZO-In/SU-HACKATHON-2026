const { Machine, SensorLog } = require('../models/Schemas');
const emailService = require('../services/emailService');

exports.getReport = async (req, res) => {
  try {
    const hours = parseInt(req.query.hours) || 24;
    const since = new Date(Date.now() - hours * 3600000);
    const byMachine = await SensorLog.aggregate([
      { $match: { createdAt: { $gte: since } } },
      { $group: { _id: '$machineId',
        avgKw: { $avg: '$energyKw' }, maxKw: { $max: '$energyKw' }, minKw: { $min: '$energyKw' },
        readings: { $sum: 1 },
        totalKwh: { $sum: { $multiply: ['$energyKw', { $divide: [5, 3600] }] } },
        anomalies: { $sum: { $cond: ['$anomaly', 1, 0] } }
      }}, { $sort: { totalKwh: -1 } }
    ]);
    const hourlyTrend = await SensorLog.aggregate([
      { $match: { createdAt: { $gte: since } } },
      { $group: {
        _id: { hour: { $hour: '$createdAt' }, date: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } } },
        avgKw: { $avg: '$energyKw' }, totalKwh: { $sum: { $multiply: ['$energyKw', { $divide: [5, 3600] }] } }
      }}, { $sort: { '_id.date': 1, '_id.hour': 1 } }, { $limit: 48 }
    ]);
    const machines = await Machine.find({ status: 'Running' });
    const totalCurrentKw = machines.reduce((s, m) => s + (m.energyKw || 0), 0);
    const totalKwh = byMachine.reduce((s, m) => s + (m.totalKwh || 0), 0);
    const now = new Date(); const currentHour = now.getHours();
    const isPeakHour = currentHour >= 6 && currentHour <= 22;
    res.json({
      period: `Last ${hours} hours`,
      summary: { totalKwh: +totalKwh.toFixed(2), estimatedCost: +(totalKwh * (isPeakHour ? 8 : 5)).toFixed(0),
        currentTotalKw: +totalCurrentKw.toFixed(2), runningMachines: machines.length,
        isPeakHour, peakStatus: isPeakHour ? 'PEAK (₹8/kWh)' : 'OFF-PEAK (₹5/kWh)', costPerKwh: isPeakHour ? 8 : 5 },
      byMachine: byMachine.map(m => ({
        machineId: m._id, avgKw: +m.avgKw.toFixed(2), maxKw: +m.maxKw.toFixed(2),
        totalKwh: +m.totalKwh.toFixed(3), cost: +(m.totalKwh * (isPeakHour ? 8 : 5)).toFixed(0),
        readings: m.readings, anomalies: m.anomalies
      })),
      hourlyTrend: hourlyTrend.map(h => ({
        label: `${h._id.date} ${String(h._id.hour).padStart(2,'0')}:00`,
        hour: h._id.hour, avgKw: +h.avgKw.toFixed(2), totalKwh: +h.totalKwh.toFixed(3),
        isPeak: h._id.hour >= 6 && h._id.hour <= 22
      })),
      liveLoads: machines.map(m => ({ machineId: m.machineId, name: m.name, type: m.type, location: m.location, energyKw: +(m.energyKw||0).toFixed(2) }))
    });
  } catch(err) { res.status(500).json({ msg: err.message }); }
};

exports.getLoadDistribution = async (req, res) => {
  try {
    const machines = await Machine.find();
    const running = machines.filter(m => m.status === 'Running');
    const totalKw = running.reduce((s, m) => s + (m.energyKw || 0), 0);
    const avgKw = running.length ? totalKw / running.length : 0;
    const loads = machines.map(m => {
      const load = m.status === 'Running' ? (m.energyKw || 0) : 0;
      const isOver = load > avgKw * 1.5;
      const isUnder = m.status === 'Running' && load < avgKw * 0.5;
      return {
        machineId: m.machineId, name: m.name, type: m.type, location: m.location,
        status: m.status, energyKw: +load.toFixed(2),
        loadPct: totalKw > 0 ? +((load / totalKw) * 100).toFixed(1) : 0,
        loadStatus: isOver ? 'OVERLOADED' : isUnder ? 'UNDERLOADED' : m.status === 'Running' ? 'NORMAL' : 'IDLE',
        healthScore: m.healthScore, canAutoSwitch: m.canAutoSwitch !== false
      };
    });
    loads.sort((a, b) => b.energyKw - a.energyKw);
    const overloaded = loads.filter(l => l.loadStatus === 'OVERLOADED').length;
    // Machines that can be switched off (Idle, low load, eligible)
    const switchOffCandidates = loads.filter(l =>
      (l.loadStatus === 'IDLE' || l.loadStatus === 'UNDERLOADED') && l.canAutoSwitch
    ).map(l => ({ machineId: l.machineId, name: l.name, reason: l.loadStatus === 'IDLE' ? 'No active jobs — safe to power off' : 'Low utilization — consider pausing', savingsKwh: +(l.energyKw * 1).toFixed(2) }));

    if (overloaded > 0) req.io?.emit('load_alert', { overloaded, idle: loads.filter(l=>l.status==='Idle').length, totalKw: +totalKw.toFixed(2), msg: `⚡ ${overloaded} machines overloaded` });

    res.json({
      totalKw: +totalKw.toFixed(2), avgKwPerMachine: +avgKw.toFixed(2),
      runningCount: running.length, idleCount: machines.filter(m=>m.status==='Idle').length,
      overloadedCount: overloaded, imbalanced: overloaded > 0,
      switchOffCandidates, loads
    });
  } catch(err) { res.status(500).json({ msg: err.message }); }
};

// Auto-switch: turn off recommended idle/underloaded machines
exports.autoSwitch = async (req, res) => {
  try {
    const { machineIds, action } = req.body; // action: 'off' | 'on'
    const updated = [];
    for (const mid of machineIds) {
      const m = await Machine.findOneAndUpdate({ machineId: mid },
        { status: action === 'off' ? 'Idle' : 'Running' }, { new: true });
      if (m) {
        updated.push({ machineId: mid, name: m.name, newStatus: m.status });
        req.io?.emit('machine_updated', m);
      }
    }
    res.json({ msg: `${updated.length} machines ${action === 'off' ? 'powered down' : 'activated'}`, updated });
  } catch(err) { res.status(500).json({ msg: err.message }); }
};

exports.triggerLoadAlert = async (req, res) => {
  try {
    await emailService.sendLoadAlert({ overloaded: req.body.overloaded||2, idle: req.body.idle||3, totalLoad: req.body.totalLoad||24.5 });
    res.json({ msg: 'Alert sent' });
  } catch(err) { res.status(500).json({ msg: err.message }); }
};
