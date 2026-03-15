const { Machine, SensorLog } = require('../models/Schemas');

// ─── Compute maintenance status for a machine ─────────────────────────────────
function getMaintenanceStatus(machine) {
  const hoursRemaining = machine.serviceThreshold - (machine.totalRuntimeHours % machine.serviceThreshold);
  const daysRemaining = hoursRemaining / (machine.avgHoursPerDay || 8);
  const pct = ((machine.totalRuntimeHours % machine.serviceThreshold) / machine.serviceThreshold) * 100;

  let urgency = 'OK';
  let alertLevel = 'none';

  if (hoursRemaining <= 0 || pct >= 100) {
    urgency = 'OVERDUE';
    alertLevel = 'critical';
  } else if (hoursRemaining <= 20 || daysRemaining <= 2) {
    urgency = 'CRITICAL';
    alertLevel = 'critical';
  } else if (hoursRemaining <= 50 || daysRemaining <= 5) {
    urgency = 'WARNING';
    alertLevel = 'warning';
  } else if (hoursRemaining <= 100 || daysRemaining <= 10) {
    urgency = 'UPCOMING';
    alertLevel = 'info';
  }

  const forecastDate = new Date();
  forecastDate.setDate(forecastDate.getDate() + Math.round(daysRemaining));

  return {
    hoursRemaining: Math.max(0, parseFloat(hoursRemaining.toFixed(1))),
    daysRemaining: Math.max(0, parseFloat(daysRemaining.toFixed(1))),
    progressPct: Math.min(100, parseFloat(pct.toFixed(1))),
    predictedServiceDate: forecastDate,
    urgency,
    alertLevel,
    shouldAlert: alertLevel === 'critical' || alertLevel === 'warning'
  };
}

// ─── GET all machines with full maintenance status ────────────────────────────
exports.getAllStatus = async (req, res) => {
  try {
    const machines = await Machine.find();
    const result = machines.map(m => {
      const ms = getMaintenanceStatus(m);
      return {
        _id: m._id,
        machineId: m.machineId,
        name: m.name,
        type: m.type,
        status: m.status,
        location: m.location,
        healthScore: m.healthScore,
        totalRuntimeHours: m.totalRuntimeHours,
        serviceThreshold: m.serviceThreshold,
        avgHoursPerDay: m.avgHoursPerDay,
        lastServiceDate: m.lastServiceDate,
        maintenanceLogs: m.maintenanceLogs,
        totalMaintenanceCost: m.totalMaintenanceCost,
        ...ms
      };
    });

    // Sort by urgency
    const urgencyOrder = { OVERDUE: 0, CRITICAL: 1, WARNING: 2, UPCOMING: 3, OK: 4 };
    result.sort((a, b) => (urgencyOrder[a.urgency] || 4) - (urgencyOrder[b.urgency] || 4));

    res.json(result);
  } catch (err) {
    res.status(500).json({ msg: err.message });
  }
};

// ─── GET single machine maintenance detail ────────────────────────────────────
exports.getDetail = async (req, res) => {
  try {
    const machine = await Machine.findOne({ machineId: req.params.id });
    if (!machine) return res.status(404).json({ msg: 'Machine not found' });

    const ms = getMaintenanceStatus(machine);

    // Get sensor trend (last 50 readings)
    const sensorTrend = await SensorLog.find({ machineId: req.params.id })
      .sort({ createdAt: -1 }).limit(50).select('vibration temperature energyKw rpm createdAt anomaly anomalyType');

    // Anomaly count last 24h
    const since24h = new Date(Date.now() - 86400000);
    const anomalies24h = await SensorLog.countDocuments({ machineId: req.params.id, anomaly: true, createdAt: { $gte: since24h } });

    res.json({
      machine: {
        machineId: machine.machineId,
        name: machine.name,
        type: machine.type,
        status: machine.status,
        healthScore: machine.healthScore,
        totalRuntimeHours: machine.totalRuntimeHours,
        serviceThreshold: machine.serviceThreshold,
        lastServiceDate: machine.lastServiceDate,
        maintenanceLogs: machine.maintenanceLogs,
        totalMaintenanceCost: machine.totalMaintenanceCost
      },
      maintenance: ms,
      sensorTrend: sensorTrend.reverse(), // chronological
      anomalies24h
    });
  } catch (err) {
    res.status(500).json({ msg: err.message });
  }
};

// ─── POST log a maintenance event ─────────────────────────────────────────────
exports.logMaintenance = async (req, res) => {
  try {
    const { description, type = 'Scheduled', performedBy, cost = 0 } = req.body;
    const machine = await Machine.findOne({ machineId: req.params.id });
    if (!machine) return res.status(404).json({ msg: 'Machine not found' });

    const logEntry = {
      type,
      description,
      performedBy: performedBy || req.user.name,
      cost: parseFloat(cost),
      date: new Date(),
      hoursAtService: machine.totalRuntimeHours
    };

    machine.maintenanceLogs.push(logEntry);
    machine.lastServiceDate = new Date();
    machine.totalMaintenanceCost += parseFloat(cost);
    machine.alertSent = false;

    // Calculate next service date
    const hoursUntilNext = machine.serviceThreshold;
    const daysUntilNext = hoursUntilNext / (machine.avgHoursPerDay || 8);
    const nextDate = new Date();
    nextDate.setDate(nextDate.getDate() + daysUntilNext);
    machine.nextServiceDate = nextDate;

    // Boost health score after maintenance
    machine.healthScore = Math.min(100, machine.healthScore + 20);

    await machine.save();

    // Broadcast
    req.io.emit('maintenance_logged', {
      machineId: machine.machineId,
      name: machine.name,
      logEntry,
      newHealthScore: machine.healthScore
    });

    res.json({ msg: 'Maintenance logged', machine, logEntry });
  } catch (err) {
    res.status(400).json({ msg: err.message });
  }
};

// ─── POST add runtime hours (called periodically by IoT sim) ─────────────────
exports.addRuntime = async (req, res) => {
  try {
    const { hours = 1 } = req.body;
    const machine = await Machine.findOne({ machineId: req.params.id });
    if (!machine) return res.status(404).json({ msg: 'Not found' });

    machine.totalRuntimeHours += parseFloat(hours);
    const ms = getMaintenanceStatus(machine);

    // Auto-alert if needed and not already alerted
    if (ms.shouldAlert && !machine.alertSent) {
      machine.alertSent = true;
      req.io.emit('maintenance_alert', {
        machineId: machine.machineId,
        name: machine.name,
        urgency: ms.urgency,
        hoursRemaining: ms.hoursRemaining,
        daysRemaining: ms.daysRemaining,
        msg: `${machine.name} needs service in ${ms.hoursRemaining}h (${ms.daysRemaining} days)`
      });
    }

    await machine.save();
    res.json({ machineId: machine.machineId, totalRuntimeHours: machine.totalRuntimeHours, ...ms });
  } catch (err) {
    res.status(400).json({ msg: err.message });
  }
};

// ─── GET check all machines and emit alerts for ones needing service ──────────
exports.checkAllAlerts = async (req, res) => {
  try {
    const machines = await Machine.find();
    const alerts = [];

    for (const machine of machines) {
      const ms = getMaintenanceStatus(machine);
      if (ms.shouldAlert) {
        alerts.push({
          machineId: machine.machineId,
          name: machine.name,
          urgency: ms.urgency,
          hoursRemaining: ms.hoursRemaining,
          daysRemaining: ms.daysRemaining,
          alertLevel: ms.alertLevel
        });
        if (!machine.alertSent) {
          machine.alertSent = true;
          await machine.save();
          req.io.emit('maintenance_alert', {
            ...alerts[alerts.length - 1],
            msg: `⚠️ ${machine.name}: Service in ${ms.hoursRemaining}h`
          });
        }
      }
    }

    res.json({ total: alerts.length, alerts });
  } catch (err) {
    res.status(500).json({ msg: err.message });
  }
};

// ─── GET summary stats ────────────────────────────────────────────────────────
exports.getSummary = async (req, res) => {
  try {
    const machines = await Machine.find();
    let overdue = 0, critical = 0, warning = 0, ok = 0;
    let totalCost = 0;

    machines.forEach(m => {
      const ms = getMaintenanceStatus(m);
      if (ms.urgency === 'OVERDUE') overdue++;
      else if (ms.urgency === 'CRITICAL') critical++;
      else if (ms.urgency === 'WARNING') warning++;
      else ok++;
      totalCost += m.totalMaintenanceCost || 0;
    });

    res.json({ total: machines.length, overdue, critical, warning, ok, totalMaintenanceCost: totalCost });
  } catch (err) {
    res.status(500).json({ msg: err.message });
  }
};
