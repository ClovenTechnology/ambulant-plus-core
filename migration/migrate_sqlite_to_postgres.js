// migrate_sqlite_to_postgres.js
// Usage: node migrate_sqlite_to_postgres.js /path/to/sqlite.db
// Make sure .env.production or env vars set for PG (or edit the connection below)

const sqlite3 = require('sqlite3').verbose();
const { Client } = require('pg');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');

const sqliteFile = process.argv[2] || './dev.db';
if (!fs.existsSync(sqliteFile)) {
  console.error("SQLite DB not found:", sqliteFile);
  process.exit(1);
}

const sqlite = new sqlite3.Database(sqliteFile);

const pg = new Client({
  host: process.env.PGHOST || 'localhost',
  port: process.env.PGPORT ? parseInt(process.env.PGPORT) : 5432,
  user: process.env.PGUSER || 'ambulant',
  password: process.env.PGPASSWORD || 'supersecretpg',
  database: process.env.DBNAME || 'ambulant',
});

async function run() {
  await pg.connect();
  console.log('Connected to Postgres.');

  // We'll create mapping tables in memory
  const maps = {
    patient: new Map(),
    clinician: new Map(),
    encounter: new Map(),
    medication: new Map(),
    reminder: new Map(),
    device: new Map(),
    vital: new Map(),
    appointment: new Map(),
    delivery: new Map(),
    draw: new Map(),
    erx: new Map(),
    laborder: new Map(),
    payment: new Map()
  };

  // Helper to run sqlite all
  const sqliteAll = (sql, params=[]) => new Promise((res, rej) => {
    sqlite.all(sql, params, (err, rows) => err ? rej(err) : res(rows));
  });

  // Helper to insert and return new uuid
  const insertAndMap = async (table, row, mapKey, pgInsertSQL, values) => {
    const newId = uuidv4();
    await pg.query(pgInsertSQL, [newId, ...values]);
    maps[mapKey].set(row.id || row.Id || row.ID || row._id, newId);
    return newId;
  };

  // Example: migrate PatientProfile
  const patients = await sqliteAll('SELECT * FROM PatientProfile;').catch(()=>[]);
  console.log('Patients:', patients.length);
  for (const p of patients) {
    const newId = uuidv4();
    // map fields conservatively — adapt to your actual sqlite schema
    await pg.query(
      `INSERT INTO "PatientProfile" ("id","userId","name","contactEmail","phone","primaryComm","dob","idNumber","addressLine1","addressLine2","city","postalCode","useAsDefaultDelivery","heightCm","weightKg","photoUrl","allergies","createdAt","updatedAt")
       VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19)`,
      [
        newId,
        p.userId || null,
        p.name || null,
        p.contactEmail || null,
        p.phone || null,
        p.primaryComm || null,
        p.dob ? new Date(p.dob) : null,
        p.idNumber || null,
        p.addressLine1 || null,
        p.addressLine2 || null,
        p.city || null,
        p.postalCode || null,
        p.useAsDefaultDelivery ? !!p.useAsDefaultDelivery : false,
        p.heightCm ? parseInt(p.heightCm) : null,
        p.weightKg ? parseInt(p.weightKg) : null,
        p.photoUrl || null,
        p.allergies || null,
        p.createdAt ? new Date(p.createdAt) : new Date(),
        p.updatedAt ? new Date(p.updatedAt) : new Date()
      ]
    );
    maps.patient.set(p.id || p.ID || p._id, newId);
  }

  // ClinicianProfile
  const clinicians = await sqliteAll('SELECT * FROM ClinicianProfile;').catch(()=>[]);
  console.log('Clinicians:', clinicians.length);
  for (const c of clinicians) {
    const newId = uuidv4();
    await pg.query(
      `INSERT INTO "ClinicianProfile" ("id","userId","displayName","specialty","feeCents","currency","payoutAccountId","createdAt","updatedAt")
       VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [
        newId,
        c.userId || null,
        c.displayName || null,
        c.specialty || null,
        c.feeCents ? parseInt(c.feeCents) : 0,
        c.currency || 'ZAR',
        c.payoutAccountId || null,
        c.createdAt ? new Date(c.createdAt) : new Date(),
        c.updatedAt ? new Date(c.updatedAt) : new Date()
      ]
    );
    maps.clinician.set(c.id || c.ID || c._id, newId);
  }

  // Encounters
  const encounters = await sqliteAll('SELECT * FROM Encounter;').catch(()=>[]);
  console.log('Encounters:', encounters.length);
  for (const e of encounters) {
    const newId = uuidv4();
    // Map patient/clinician ids
    const patientNew = maps.patient.get(e.patientId) || null;
    const clinicianNew = e.clinicianId ? (maps.clinician.get(e.clinicianId) || null) : null;
    await pg.query(
      `INSERT INTO "Encounter" ("id","caseId","patientId","clinicianId","createdAt","updatedAt","status")
       VALUES($1,$2,$3,$4,$5,$6,$7)`,
      [
        newId,
        e.caseId || null,
        patientNew,
        clinicianNew,
        e.createdAt ? new Date(e.createdAt) : new Date(),
        e.updatedAt ? new Date(e.updatedAt) : new Date(),
        e.status || 'open'
      ]
    );
    maps.encounter.set(e.id || e.ID || e._id, newId);
  }

  // Appointments
  const appointments = await sqliteAll('SELECT * FROM Appointment;').catch(()=>[]);
  console.log('Appointments:', appointments.length);
  for (const a of appointments) {
    const newId = uuidv4();
    const encounterNew = maps.encounter.get(a.encounterId) || null;
    const clinicianNew = maps.clinician.get(a.clinicianId) || null;
    const patientNew = maps.patient.get(a.patientId) || null;
    await pg.query(
      `INSERT INTO "Appointment" ("id","encounterId","sessionId","caseId","clinicianId","patientId","startsAt","endsAt","status","priceCents","currency","platformFeeCents","clinicianTakeCents","paymentProvider","paymentRef","meta")
       VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)`,
       [
         newId,
         encounterNew,
         a.sessionId || null,
         a.caseId || null,
         clinicianNew,
         patientNew,
         a.startsAt ? new Date(a.startsAt) : null,
         a.endsAt ? new Date(a.endsAt) : null,
         a.status || 'pending',
         a.priceCents ? parseInt(a.priceCents) : 0,
         a.currency || 'ZAR',
         a.platformFeeCents ? parseInt(a.platformFeeCents) : 0,
         a.clinicianTakeCents ? parseInt(a.clinicianTakeCents) : 0,
         a.paymentProvider || null,
         a.paymentRef || null,
         a.meta || null
       ]
    );
    maps.appointment.set(a.id || a.ID || a._id, newId);
  }

  // Medications
  const meds = await sqliteAll('SELECT * FROM Medication;').catch(()=>[]);
  console.log('Medications:', meds.length);
  for (const m of meds) {
    const newId = uuidv4();
    const patientNew = m.patientId ? (maps.patient.get(m.patientId) || null) : null;
    await pg.query(
      `INSERT INTO "Medication" ("id","patientId","name","dose","frequency","route","started","lastFilled","status","orderId","source","meta","createdAt","updatedAt")
       VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`,
      [
        newId,
        patientNew,
        m.name || null,
        m.dose || null,
        m.frequency || null,
        m.route || null,
        m.started ? new Date(m.started) : null,
        m.lastFilled ? new Date(m.lastFilled) : null,
        m.status || 'Active',
        m.orderId || null,
        m.source || null,
        m.meta ? m.meta : null,
        m.createdAt ? new Date(m.createdAt) : new Date(),
        m.updatedAt ? new Date(m.updatedAt) : new Date()
      ]
    );
    maps.medication.set(m.id || m.ID || m._id, newId);
  }

  // Reminders
  const reminders = await sqliteAll('SELECT * FROM Reminder;').catch(()=>[]);
  console.log('Reminders:', reminders.length);
  for (const r of reminders) {
    const newId = uuidv4();
    const medicationNew = r.medicationId ? (maps.medication.get(r.medicationId) || null) : null;
    const patientNew = r.patientId ? (maps.patient.get(r.patientId) || null) : null;
    await pg.query(
      `INSERT INTO "Reminder" ("id","medicationId","patientId","name","dose","time","status","snoozedUntil","source","meta","createdAt","updatedAt")
       VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
       [
         newId,
         medicationNew,
         patientNew,
         r.name || null,
         r.dose || null,
         r.time || null,
         r.status || 'Pending',
         r.snoozedUntil ? new Date(r.snoozedUntil) : null,
         r.source || null,
         r.meta ? r.meta : null,
         r.createdAt ? new Date(r.createdAt) : new Date(),
         r.updatedAt ? new Date(r.updatedAt) : new Date()
       ]
    );
    maps.reminder.set(r.id || r.ID || r._id, newId);
  }

  // Devices
  const devices = await sqliteAll('SELECT * FROM Device;').catch(()=>[]);
  console.log('Devices:', devices.length);
  for (const d of devices) {
    const newId = uuidv4();
    const patientNew = d.patientId ? (maps.patient.get(d.patientId) || null) : null;
    await pg.query(
      `INSERT INTO "Device" ("id","deviceId","secret","patientId","roomId","vendor","category","model","createdAt","updatedAt")
       VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
      [
        newId,
        d.deviceId || null,
        d.secret || null,
        patientNew,
        d.roomId || null,
        d.vendor || null,
        d.category || null,
        d.model || null,
        d.createdAt ? new Date(d.createdAt) : new Date(),
        d.updatedAt ? new Date(d.updatedAt) : new Date()
      ]
    );
    maps.device.set(d.id || d.ID || d._id, newId);
  }

  // VitalSample
  const vitals = await sqliteAll('SELECT * FROM VitalSample;').catch(()=>[]);
  console.log('Vitals:', vitals.length);
  for (const v of vitals) {
    const newId = uuidv4();
    const patientNew = maps.patient.get(v.patientId) || null;
    const deviceNew = maps.device.get(v.deviceId) || null;
    await pg.query(
      `INSERT INTO "VitalSample" ("id","patientId","deviceId","t","vType","valueNum","unit","roomId")
       VALUES($1,$2,$3,$4,$5,$6,$7,$8)`,
       [
         newId,
         patientNew,
         deviceNew,
         v.t ? new Date(v.t) : new Date(),
         v.vType || null,
         v.valueNum ? parseFloat(v.valueNum) : null,
         v.unit || null,
         v.roomId || null
       ]
    );
    maps.vital.set(v.id || v.ID || v._id, newId);
  }

  // Deliveries, Draws, Payments, ErxOrder, LabOrder (similar pattern)
  const deliveries = await sqliteAll('SELECT * FROM Delivery;').catch(()=>[]);
  console.log('Deliveries:', deliveries.length);
  for (const d of deliveries) {
    const newId = uuidv4();
    const encounterNew = d.encounterId ? maps.encounter.get(d.encounterId) : null;
    const patientNew = d.patientId ? maps.patient.get(d.patientId) : null;
    await pg.query(
      `INSERT INTO "Delivery" ("id","orderId","encounterId","patientId","clinicianId","riderId","partnerId","status","priceCents","createdAt","updatedAt")
       VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
       [
         newId,
         d.orderId || null,
         encounterNew,
         patientNew,
         d.clinicianId ? maps.clinician.get(d.clinicianId) : null,
         d.riderId ? d.riderId : null,
         d.partnerId ? d.partnerId : null,
         d.status || null,
         d.priceCents ? parseInt(d.priceCents) : 0,
         d.createdAt ? new Date(d.createdAt) : new Date(),
         d.updatedAt ? new Date(d.updatedAt) : new Date()
       ]
    );
    maps.delivery.set(d.id || d.ID || d._id, newId);
  }

  // Additional tables: Draw, Payment, ErxOrder, LabOrder
  // ... (extend similarly if required)

  console.log('Migration done. Close DBs.');
  await pg.end();
  sqlite.close();
  console.log('All closed.');
}

run().catch(err => {
  console.error('Migration error:', err);
  process.exit(1);
});
