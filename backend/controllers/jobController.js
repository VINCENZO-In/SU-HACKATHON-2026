const emailService = require('../services/emailService');
const { Order } = require('../models/Schemas');
const { Job, Machine } = require('../models/Schemas');

exports.getAll = async (req, res) => {
  const jobs = await Job.find().sort({ priority: 1, deadline: 1 })
    .populate('assignedWorker', 'name');
  res.json(jobs);
};

exports.create = async (req, res) => {
  try {
    const job = await Job.create(req.body);
    req.io.emit('job_created', job);
    res.status(201).json(job);
  } catch (err) {
    res.status(400).json({ msg: err.message });
  }
};

exports.update = async (req, res) => {
  try {
    const job = await Job.findByIdAndUpdate(req.params.id, req.body, { new: true });
    req.io.emit('job_updated', job);
    // Notify on completion
    if (req.body.status === 'Completed') {
      try {
        const { Order } = require('../models/Schemas');
        const order = await Order.findOne({ orderId: job.orderId });
        emailService.notifyJobCompleted({ job, order }).catch(() => {});
      } catch {}
    }
    res.json(job);
  } catch (err) {
    res.status(400).json({ msg: err.message });
  }
};

exports.remove = async (req, res) => {
  await Job.findByIdAndDelete(req.params.id);
  res.json({ msg: 'Job deleted' });
};

exports.assignToMachine = async (req, res) => {
  try {
    const { machineId } = req.body;
    const machine = await Machine.findOne({ machineId });
    if (!machine) return res.status(404).json({ msg: 'Machine not found' });
    if (machine.status === 'Running') return res.status(400).json({ msg: 'Machine is busy' });

    const job = await Job.findByIdAndUpdate(req.params.id, { status: 'In-Progress', assignedMachine: machineId }, { new: true });
    await Machine.findOneAndUpdate({ machineId }, { status: 'Running', currentJob: job.orderId });
    req.io.emit('job_assigned', { job, machine: machineId });
    res.json(job);
  } catch (err) {
    res.status(400).json({ msg: err.message });
  }
};

exports.getGanttData = async (req, res) => {
  const jobs = await Job.find({ status: { $in: ['Pending', 'In-Progress'] } })
    .sort({ priority: 1 });
  const gantt = jobs.map(j => ({
    id: j._id,
    orderId: j.orderId,
    machine: j.assignedMachine || 'Unassigned',
    fabricType: j.fabricType,
    start: j.createdAt,
    end: j.deadline || new Date(Date.now() + j.estimatedHours * 3600000),
    progress: j.totalMeters > 0 ? Math.round((j.completedMeters / j.totalMeters) * 100) : 0,
    status: j.status,
    priority: j.priority,
    color: j.color
  }));
  res.json(gantt);
};

exports.optimizeSchedule = async (req, res) => {
  const machines = await Machine.find({ status: 'Idle' });
  const jobs = await Job.find({ status: 'Pending' }).sort({ priority: 1, deadline: 1 });

  const assignments = [];
  for (let i = 0; i < Math.min(machines.length, jobs.length); i++) {
    await Machine.findOneAndUpdate({ machineId: machines[i].machineId }, { status: 'Running', currentJob: jobs[i].orderId });
    await Job.findByIdAndUpdate(jobs[i]._id, { status: 'In-Progress', assignedMachine: machines[i].machineId });
    assignments.push({ machine: machines[i].machineId, job: jobs[i].orderId, fabric: jobs[i].fabricType });
  }

  req.io.emit('schedule_optimized', assignments);
  res.json({ msg: `Optimized ${assignments.length} assignments`, assignments });
};
