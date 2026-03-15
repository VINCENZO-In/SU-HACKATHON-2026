const express = require('express');
const router = express.Router();
const rc = require('../controllers/reportController');
const { protect } = require('../middleware/auth');

// Data endpoints
router.get('/monthly', protect, rc.getMonthlyReport);
router.get('/yearly', protect, rc.getYearlyReport);
router.get('/supplier-ranking', protect, rc.getSupplierRanking);
router.get('/machine-optimization', protect, rc.getMachineOptimization);
router.get('/available-years', protect, rc.getAvailableYears);

// Download endpoints — return Excel file
router.get('/download/monthly-excel', protect, async (req, res) => {
  const { Ledger, SensorLog, Order } = require('../models/Schemas');
  const year  = parseInt(req.query.year)  || new Date().getFullYear();
  const month = parseInt(req.query.month) || new Date().getMonth() + 1;
  const start = new Date(year, month - 1, 1);
  const end   = new Date(year, month, 0, 23, 59, 59);
  const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

  try {
    const ExcelJS = require('exceljs');
    const wb = new ExcelJS.Workbook();
    wb.creator = 'WeaveMind Factory OS';
    wb.created = new Date();

    // ── Bills Sheet ──
    const billsSheet = wb.addWorksheet('Bills & Payments');
    billsSheet.columns = [
      { header: 'Type', key: 'type', width: 12 },
      { header: 'Description', key: 'description', width: 35 },
      { header: 'Party', key: 'party', width: 22 },
      { header: 'Category', key: 'category', width: 15 },
      { header: 'Amount (₹)', key: 'amount', width: 15 },
      { header: 'Status', key: 'status', width: 12 },
      { header: 'Due Date', key: 'dueDate', width: 16 },
      { header: 'Date', key: 'date', width: 16 },
    ];
    // Style header
    billsSheet.getRow(1).eachCell(cell => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF111827' } };
      cell.font = { bold: true, color: { argb: 'FF00D4FF' } };
      cell.border = { bottom: { style: 'thin', color: { argb: 'FF1F2D42' } } };
    });

    const ledger = await Ledger.find({ createdAt: { $gte: start, $lte: end } }).sort({ createdAt: -1 });
    let totalIn = 0, totalOut = 0;
    ledger.forEach(l => {
      const row = billsSheet.addRow({
        type: l.type, description: l.description, party: l.party,
        category: l.category, amount: l.amount, status: l.status,
        dueDate: l.dueDate ? new Date(l.dueDate).toLocaleDateString('en-IN') : '',
        date: new Date(l.createdAt).toLocaleDateString('en-IN')
      });
      row.getCell('amount').numFmt = '₹#,##0';
      if (l.type === 'INFLOW') { row.getCell('amount').font = { color: { argb: 'FF00E676' } }; totalIn += l.amount; }
      else { row.getCell('amount').font = { color: { argb: 'FFFF4757' } }; totalOut += l.amount; }
    });
    // Summary row
    billsSheet.addRow({});
    const sumRow = billsSheet.addRow({ description: 'TOTAL INFLOW', amount: totalIn });
    sumRow.getCell('amount').numFmt = '₹#,##0';
    sumRow.getCell('amount').font = { bold: true, color: { argb: 'FF00E676' } };
    const sumRow2 = billsSheet.addRow({ description: 'TOTAL OUTFLOW', amount: totalOut });
    sumRow2.getCell('amount').numFmt = '₹#,##0';
    sumRow2.getCell('amount').font = { bold: true, color: { argb: 'FFFF4757' } };
    const netRow = billsSheet.addRow({ description: 'NET POSITION', amount: totalIn - totalOut });
    netRow.getCell('amount').numFmt = '₹#,##0';
    netRow.getCell('amount').font = { bold: true, size: 13, color: { argb: totalIn - totalOut >= 0 ? 'FF00E676' : 'FFFF4757' } };

    // ── Energy Sheet ──
    const energySheet = wb.addWorksheet('Energy Consumption');
    energySheet.columns = [
      { header: 'Machine ID', key: 'machineId', width: 14 },
      { header: 'Total kWh', key: 'totalKwh', width: 14 },
      { header: 'Avg kW', key: 'avgKw', width: 12 },
      { header: 'Est. Cost (₹)', key: 'cost', width: 15 },
    ];
    energySheet.getRow(1).eachCell(cell => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF111827' } };
      cell.font = { bold: true, color: { argb: 'FFFFD32A' } };
    });
    const energyAgg = await SensorLog.aggregate([
      { $match: { createdAt: { $gte: start, $lte: end } } },
      { $group: { _id: '$machineId', totalKwh: { $sum: { $multiply: ['$energyKw', { $divide: [5, 3600] }] } }, avgKw: { $avg: '$energyKw' } } },
      { $sort: { totalKwh: -1 } }
    ]);
    let totalKwh = 0;
    energyAgg.forEach(e => {
      const row = energySheet.addRow({ machineId: e._id, totalKwh: parseFloat(e.totalKwh.toFixed(2)), avgKw: parseFloat(e.avgKw.toFixed(2)), cost: parseFloat((e.totalKwh * 8).toFixed(0)) });
      row.getCell('cost').numFmt = '₹#,##0';
      totalKwh += e.totalKwh;
    });
    energySheet.addRow({});
    const etotal = energySheet.addRow({ machineId: 'TOTAL', totalKwh: parseFloat(totalKwh.toFixed(2)), cost: parseFloat((totalKwh * 8).toFixed(0)) });
    etotal.font = { bold: true }; etotal.getCell('cost').numFmt = '₹#,##0';

    // ── Orders Sheet ──
    const ordersSheet = wb.addWorksheet('Orders');
    ordersSheet.columns = [
      { header: 'Order ID', key: 'orderId', width: 16 },
      { header: 'Client', key: 'client', width: 24 },
      { header: 'Fabric', key: 'fabric', width: 22 },
      { header: 'Meters', key: 'meters', width: 10 },
      { header: 'Amount (₹)', key: 'amount', width: 15 },
      { header: 'Payment', key: 'payment', width: 12 },
      { header: 'Status', key: 'status', width: 16 },
    ];
    ordersSheet.getRow(1).eachCell(cell => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF111827' } };
      cell.font = { bold: true, color: { argb: 'FF00E676' } };
    });
    const orders = await Order.find({ createdAt: { $gte: start, $lte: end } });
    orders.forEach(o => {
      const row = ordersSheet.addRow({ orderId: o.orderId, client: o.clientName, fabric: o.fabricType, meters: o.totalMeters, amount: o.totalAmount, payment: o.paymentStatus, status: o.status });
      row.getCell('amount').numFmt = '₹#,##0';
      if (o.paymentStatus === 'Paid') row.getCell('payment').font = { color: { argb: 'FF00E676' } };
      else row.getCell('payment').font = { color: { argb: 'FFFF4757' } };
    });

    // Send
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="WeaveMind_Report_${MONTHS[month-1]}_${year}.xlsx"`);
    await wb.xlsx.write(res);
    res.end();
  } catch (err) {
    res.status(500).json({ msg: err.message });
  }
});

// Yearly Excel
router.get('/download/yearly-excel', protect, async (req, res) => {
  const year = parseInt(req.query.year) || new Date().getFullYear();
  const start = new Date(year, 0, 1);
  const end   = new Date(year, 11, 31, 23, 59, 59);
  const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const { Ledger, SensorLog, Order } = require('../models/Schemas');

  try {
    const ExcelJS = require('exceljs');
    const wb = new ExcelJS.Workbook();
    wb.creator = 'WeaveMind Factory OS';

    // Monthly bills summary sheet
    const sheet = wb.addWorksheet(`${year} Annual Summary`);
    sheet.columns = [
      { header: 'Month', key: 'month', width: 12 },
      { header: 'Inflow (₹)', key: 'inflow', width: 16 },
      { header: 'Outflow (₹)', key: 'outflow', width: 16 },
      { header: 'Net (₹)', key: 'net', width: 16 },
      { header: 'Energy kWh', key: 'kwh', width: 14 },
      { header: 'Energy Cost (₹)', key: 'ecost', width: 16 },
      { header: 'Orders', key: 'orders', width: 10 },
      { header: 'Revenue (₹)', key: 'revenue', width: 16 },
    ];
    sheet.getRow(1).eachCell(cell => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF080B12' } };
      cell.font = { bold: true, color: { argb: 'FF00D4FF' }, size: 12 };
    });

    // Build monthly data
    for (let m = 1; m <= 12; m++) {
      const ms = new Date(year, m - 1, 1);
      const me = new Date(year, m, 0, 23, 59, 59);
      const [ledger, energy, orders] = await Promise.all([
        Ledger.find({ createdAt: { $gte: ms, $lte: me } }),
        SensorLog.aggregate([
          { $match: { createdAt: { $gte: ms, $lte: me } } },
          { $group: { _id: null, kwh: { $sum: { $multiply: ['$energyKw', { $divide: [5, 3600] }] } } } }
        ]),
        Order.find({ createdAt: { $gte: ms, $lte: me } })
      ]);
      const inflow = ledger.filter(l => l.type === 'INFLOW').reduce((s, l) => s + l.amount, 0);
      const outflow = ledger.filter(l => l.type === 'OUTFLOW').reduce((s, l) => s + l.amount, 0);
      const kwh = energy[0]?.kwh || 0;
      const revenue = orders.reduce((s, o) => s + o.totalAmount, 0);

      const row = sheet.addRow({
        month: MONTHS[m - 1], inflow: Math.round(inflow), outflow: Math.round(outflow),
        net: Math.round(inflow - outflow), kwh: parseFloat(kwh.toFixed(2)),
        ecost: Math.round(kwh * 8), orders: orders.length, revenue: Math.round(revenue)
      });
      ['inflow','outflow','net','ecost','revenue'].forEach(k => { row.getCell(k).numFmt = '₹#,##0'; });
      if (inflow - outflow >= 0) row.getCell('net').font = { color: { argb: 'FF00E676' } };
      else row.getCell('net').font = { color: { argb: 'FFFF4757' } };
    }

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="WeaveMind_Annual_${year}.xlsx"`);
    await wb.xlsx.write(res);
    res.end();
  } catch (err) {
    res.status(500).json({ msg: err.message });
  }
});

module.exports = router;
