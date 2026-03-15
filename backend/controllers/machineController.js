const { Machine, SensorLog } = require('../models/Schemas');

exports.getMachines = async (req, res) => {
  const machines = await Machine.find();
  res.json(machines);
};

exports.getMachine = async (req, res) => {
  const machine = await Machine.findOne({ machineId: req.params.id });
  if (!machine) return res.status(404).json({ msg: 'Machine not found' });
  res.json(machine);
};

exports.createMachine = async (req, res) => {
  try {
    const machine = await Machine.create(req.body);
    res.status(201).json(machine);
  } catch (err) {
    res.status(400).json({ msg: err.message });
  }
};

exports.updateMachine = async (req, res) => {
  try {
    const machine = await Machine.findOneAndUpdate({ machineId: req.params.id }, req.body, { new: true });
    req.io.emit('machine_updated', machine);
    res.json(machine);
  } catch (err) {
    res.status(400).json({ msg: err.message });
  }
};

exports.getMachineSensors = async (req, res) => {
  const logs = await SensorLog.find({ machineId: req.params.id })
    .sort({ createdAt: -1 }).limit(50);
  res.json(logs);
};

exports.getMaintenanceForecast = async (req, res) => {
  const machine = await Machine.findOne({ machineId: req.params.id });
  if (!machine) return res.status(404).json({ msg: 'Machine not found' });

  const hoursRemaining = machine.serviceThreshold - (machine.totalRuntimeHours % machine.serviceThreshold);
  const daysUntilService = hoursRemaining / (machine.avgHoursPerDay || 8);
  const forecastDate = new Date();
  forecastDate.setDate(forecastDate.getDate() + daysUntilService);

  res.json({
    machineId: machine.machineId,
    name: machine.name,
    currentHours: machine.totalRuntimeHours,
    hoursUntilNextService: hoursRemaining.toFixed(1),
    predictedServiceDate: forecastDate.toDateString(),
    healthScore: machine.healthScore,
    priority: daysUntilService < 7 ? 'HIGH' : daysUntilService < 14 ? 'MEDIUM' : 'NORMAL'
  });
};

exports.simulateSensor = async (req, res) => {
  const machine = await Machine.findOne({ machineId: req.params.id });
  if (!machine) return res.status(404).json({ msg: 'Machine not found' });

  // Simulate realistic IoT sensor data
  const isAnomaly = Math.random() < 0.1;
  const sensorData = {
    machineId: machine.machineId,
    vibration: isAnomaly ? (0.8 + Math.random() * 0.5) : (0.1 + Math.random() * 0.4),
    temperature: isAnomaly ? (75 + Math.random() * 20) : (30 + Math.random() * 25),
    energyKw: 3 + Math.random() * 3,
    rpm: machine.status === 'Running' ? (900 + Math.random() * 300) : 0,
    productionMeter: machine.status === 'Running' ? Math.floor(40 + Math.random() * 20) : 0,
    anomaly: isAnomaly,
    anomalyType: isAnomaly ? (Math.random() > 0.5 ? 'High Vibration' : 'Overheating') : ''
  };

  const log = await SensorLog.create(sensorData);

  // Update machine live stats
  await Machine.findOneAndUpdate({ machineId: req.params.id }, {
    vibration: sensorData.vibration,
    temperature: sensorData.temperature,
    energyKw: sensorData.energyKw,
    rpm: sensorData.rpm,
    healthScore: isAnomaly ? Math.max(machine.healthScore - 2, 0) : Math.min(machine.healthScore + 0.5, 100)
  });

  req.io.emit('sensor_data', sensorData);
  res.json(log);
};
