require('dotenv').config({ path: '../.env' });
const mongoose = require('mongoose');
const { User, Machine, Inventory, Job, Order, Supplier, Ledger } = require('../models/Schemas');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/weavemind';

async function seed() {
  await mongoose.connect(MONGO_URI);
  console.log('Connected to MongoDB...');

  // Clear existing
  await Promise.all([User.deleteMany(), Machine.deleteMany(), Inventory.deleteMany(),
    Job.deleteMany(), Order.deleteMany(), Supplier.deleteMany(), Ledger.deleteMany()]);

  // Users
  await User.create([
    { name: 'Admin User', email: 'admin@weavemind.com', password: 'admin123', role: 'admin' },
    { name: 'Rajan Sharma', email: 'manager@weavemind.com', password: 'manager123', role: 'manager' },
    { name: 'Amit Kumar', email: 'worker@weavemind.com', password: 'worker123', role: 'worker' }
  ]);
  console.log('✅ Users seeded');

  // Machines
  await Machine.create([
    { machineId: 'LOOM-01', name: 'Power Loom Alpha', type: 'Loom', status: 'Running', totalRuntimeHours: 1240, healthScore: 88, productionPerHour: 55, location: 'Floor A' },
    { machineId: 'LOOM-02', name: 'Power Loom Beta', type: 'Loom', status: 'Idle', totalRuntimeHours: 980, healthScore: 95, productionPerHour: 60, location: 'Floor A' },
    { machineId: 'LOOM-03', name: 'Rapier Loom X3', type: 'Loom', status: 'Maintenance', totalRuntimeHours: 2100, healthScore: 62, productionPerHour: 45, location: 'Floor B' },
    { machineId: 'SPIN-01', name: 'Ring Spinner S1', type: 'Spinning', status: 'Running', totalRuntimeHours: 750, healthScore: 91, productionPerHour: 80, location: 'Floor B' },
    { machineId: 'DYE-01', name: 'Jigger Dye D1', type: 'Dyeing', status: 'Running', totalRuntimeHours: 430, healthScore: 97, productionPerHour: 35, location: 'Dye House' },
    { machineId: 'CUT-01', name: 'Auto Cutter C1', type: 'Cutting', status: 'Idle', totalRuntimeHours: 320, healthScore: 99, productionPerHour: 120, location: 'Floor C' }
  ]);
  console.log('✅ Machines seeded');

  // Inventory
  await Inventory.create([
    { barcode: 'TXTL-1001', itemName: 'Raw Cotton', vendorName: 'Gujarat Cotton Co.', stockLevel: 5000, reorderPoint: 1000, unit: 'kg', location: 'Warehouse A' },
    { barcode: 'TXTL-1002', itemName: 'Polyester Yarn', vendorName: 'Reliance Textiles', stockLevel: 800, reorderPoint: 500, unit: 'kg', location: 'Warehouse B' },
    { barcode: 'TXTL-1003', itemName: 'Natural Dye (Red)', vendorName: 'ColorMart India', stockLevel: 120, reorderPoint: 200, unit: 'liters', location: 'Dye Store' },
    { barcode: 'TXTL-1004', itemName: 'Synthetic Dye (Blue)', vendorName: 'ColorMart India', stockLevel: 85, reorderPoint: 150, unit: 'liters', location: 'Dye Store' },
    { barcode: 'TXTL-1005', itemName: 'Finished Fabric (White)', vendorName: '', stockLevel: 2400, reorderPoint: 500, unit: 'meters', location: 'Finished Goods', processingStatus: 'Finished' },
    { barcode: 'TXTL-1006', itemName: 'Silk Thread', vendorName: 'Karnataka Silk Board', stockLevel: 310, reorderPoint: 400, unit: 'kg', location: 'Warehouse A' }
  ]);
  console.log('✅ Inventory seeded');

  // Jobs
  const deadline1 = new Date(Date.now() + 2 * 86400000);
  const deadline2 = new Date(Date.now() + 5 * 86400000);
  const deadline3 = new Date(Date.now() + 1 * 86400000);
  await Job.create([
    { orderId: 'ORD-2001', fabricType: 'Cotton Plain Weave', totalMeters: 500, completedMeters: 210, priority: 1, status: 'In-Progress', assignedMachine: 'LOOM-01', deadline: deadline3, color: '#f43f5e', estimatedHours: 10 },
    { orderId: 'ORD-2002', fabricType: 'Polyester Blend', totalMeters: 300, completedMeters: 0, priority: 2, status: 'Pending', deadline: deadline1, color: '#6366f1', estimatedHours: 6 },
    { orderId: 'ORD-2003', fabricType: 'Silk Saree Fabric', totalMeters: 200, completedMeters: 180, priority: 1, status: 'In-Progress', assignedMachine: 'SPIN-01', deadline: deadline2, color: '#f59e0b', estimatedHours: 4 },
    { orderId: 'ORD-2004', fabricType: 'Denim Weave', totalMeters: 800, completedMeters: 0, priority: 3, status: 'Pending', deadline: deadline2, color: '#10b981', estimatedHours: 16 },
    { orderId: 'ORD-2005', fabricType: 'Printed Cotton', totalMeters: 450, completedMeters: 0, priority: 2, status: 'Pending', deadline: deadline1, color: '#8b5cf6', estimatedHours: 9 }
  ]);
  console.log('✅ Jobs seeded');

  // Orders
  await Order.create([
    { orderId: 'CUST-3001', clientName: 'Rajasthan Garments Ltd', clientEmail: 'rg@example.com', fabricType: 'Cotton Plain Weave', totalMeters: 500, totalAmount: 75000, paymentStatus: 'Paid', status: 'In Production', deadline: deadline3 },
    { orderId: 'CUST-3002', clientName: 'Mumbai Fashion House', clientEmail: 'mf@example.com', fabricType: 'Silk Saree Fabric', totalMeters: 200, totalAmount: 120000, paymentStatus: 'Partial', status: 'In Production', deadline: deadline2 },
    { orderId: 'CUST-3003', clientName: 'Delhi Exporters', clientEmail: 'de@example.com', fabricType: 'Denim Weave', totalMeters: 800, totalAmount: 96000, paymentStatus: 'Unpaid', status: 'Received', deadline: deadline2 },
    { orderId: 'CUST-3004', clientName: 'Surat Textile Park', clientEmail: 'st@example.com', fabricType: 'Polyester Blend', totalMeters: 1000, totalAmount: 60000, paymentStatus: 'Paid', status: 'Dispatched' }
  ]);
  console.log('✅ Orders seeded');

  // Suppliers
  await Supplier.create([
    { supplierId: 'SUP-001', name: 'Gujarat Cotton Co.', email: 'gc@supplier.com', materials: ['Raw Cotton', 'Cotton Yarn'], lateDeliveryRate: 5, defectRate: 2, reliabilityScore: 92, riskLevel: 'Low', deliveryHistory: [{ orderId: 'PO-101', onTime: true, qualityScore: 94 }, { orderId: 'PO-102', onTime: true, qualityScore: 91 }] },
    { supplierId: 'SUP-002', name: 'Reliance Textiles', email: 'rt@supplier.com', materials: ['Polyester Yarn', 'Nylon Thread'], lateDeliveryRate: 18, defectRate: 8, reliabilityScore: 67, riskLevel: 'Medium', deliveryHistory: [{ orderId: 'PO-103', onTime: false, qualityScore: 72 }, { orderId: 'PO-104', onTime: true, qualityScore: 80 }] },
    { supplierId: 'SUP-003', name: 'ColorMart India', email: 'cm@supplier.com', materials: ['Natural Dye', 'Synthetic Dye'], lateDeliveryRate: 35, defectRate: 15, reliabilityScore: 41, riskLevel: 'High', deliveryHistory: [{ orderId: 'PO-105', onTime: false, qualityScore: 55 }, { orderId: 'PO-106', onTime: false, qualityScore: 60 }] },
    { supplierId: 'SUP-004', name: 'Karnataka Silk Board', email: 'ks@supplier.com', materials: ['Silk Thread', 'Raw Silk'], lateDeliveryRate: 8, defectRate: 3, reliabilityScore: 89, riskLevel: 'Low', deliveryHistory: [{ orderId: 'PO-107', onTime: true, qualityScore: 96 }] }
  ]);
  console.log('✅ Suppliers seeded');

  // Ledger
  await Ledger.create([
    { type: 'INFLOW', amount: 75000, description: 'Payment - Rajasthan Garments ORD-2001', party: 'Rajasthan Garments', category: 'Order', status: 'Completed', dueDate: new Date() },
    { type: 'INFLOW', amount: 60000, description: 'Advance - Delhi Exporters', party: 'Delhi Exporters', category: 'Order', status: 'Pending', dueDate: new Date(Date.now() + 7 * 86400000) },
    { type: 'OUTFLOW', amount: 28000, description: 'Raw Cotton Purchase - Gujarat Cotton Co.', party: 'Gujarat Cotton Co.', category: 'Material', status: 'Completed', dueDate: new Date() },
    { type: 'OUTFLOW', amount: 45000, description: 'Worker Salaries - March 2026', party: 'Staff', category: 'Salary', status: 'Pending', dueDate: new Date(Date.now() + 15 * 86400000) },
    { type: 'OUTFLOW', amount: 12000, description: 'Electricity Bill - February', party: 'State Electricity Board', category: 'Utility', status: 'Completed', dueDate: new Date() },
    { type: 'OUTFLOW', amount: 8500, description: 'Loom-03 Maintenance Parts', party: 'Machinery Supplier', category: 'Maintenance', status: 'Pending', dueDate: new Date(Date.now() + 3 * 86400000) }
  ]);
  console.log('✅ Ledger seeded');

  console.log('\n🎉 Database seeded successfully!');
  console.log('Login: admin@weavemind.com / admin123');
  process.exit(0);
}

seed().catch(err => { console.error(err); process.exit(1); });
