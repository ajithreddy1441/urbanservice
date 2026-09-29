import './config/timezone.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import bcrypt from 'bcryptjs';
import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const schemaPath = path.resolve(__dirname, '../../database/schema.sql');

const categories = [
  ['AC Services', 'ac-services', 'Cooling, gas refill, and AC repair', 'snowflake', 1],
  ['Electrical', 'electrical', 'Wiring, fittings, and electrical repairs', 'zap', 2],
  ['Plumbing', 'plumbing', 'Leaks, blockages, and bathroom fittings', 'droplet', 3],
  ['Cleaning', 'cleaning', 'Home, kitchen, and deep cleaning', 'sparkles', 4],
  ['Appliance Repair', 'appliance-repair', 'Washers, fridges, and kitchen appliances', 'refrigerator', 5],
  ['Painting', 'painting', 'Interior and exterior painting', 'paintbrush', 6],
  ['Carpentry', 'carpentry', 'Furniture repair and woodwork', 'hammer', 7],
  ['Pest Control', 'pest-control', 'Safe treatment for homes and offices', 'bug', 8],
  ['Home Maintenance', 'home-maintenance', 'General upkeep and handyman work', 'wrench', 9],
  ['Beauty Services', 'beauty-services', 'Salon services at home', 'heart', 10],
  ['Other Services', 'other-services', 'Everything else you need at home', 'layout-grid', 11],
];

const services = [
  ['AC Repair', 'ac-services', 'Diagnosis and repair for split and window ACs that are not cooling.', 1300, 90, 0, 100, 0, 500, 1, 1],
  ['AC Gas Refill', 'ac-services', 'Gas top-up with a cooling check and basic filter clean.', 2499, 75, 0, 200, 0, 900, 1, 2],
  ['AC General Service', 'ac-services', 'Jet-pump service, filter cleaning, and performance check.', 699, 60, 0, 50, 0, 280, 1, 3],
  ['Fan Installation', 'electrical', 'Ceiling or wall fan installation with wiring check.', 349, 45, 0, 0, 0, 180, 0, 4],
  ['Switchboard Repair', 'electrical', 'Repair or replacement of faulty switches and boards.', 299, 40, 0, 0, 0, 150, 0, 5],
  ['Tap & Leak Repair', 'plumbing', 'Fix dripping taps, leaking pipes, and loose fittings.', 349, 50, 0, 0, 0, 180, 1, 6],
  ['Drain Blockage', 'plumbing', 'Clear blocked kitchen and bathroom drains.', 499, 60, 0, 0, 0, 220, 0, 7],
  ['Bathroom Deep Clean', 'cleaning', 'Descaling, scrubbing, and sanitising the full bathroom.', 899, 90, 0, 100, 0, 400, 1, 8],
  ['Home Deep Cleaning', 'cleaning', 'A full home clean for apartments up to 2 BHK.', 2499, 240, 0, 300, 0, 1100, 1, 9],
  ['Washing Machine Repair', 'appliance-repair', 'Repair for front and top load washing machines.', 499, 70, 0, 0, 0, 250, 1, 10],
  ['Refrigerator Repair', 'appliance-repair', 'Cooling issues, gas check, and thermostat repair.', 599, 80, 0, 0, 0, 280, 0, 11],
  ['1 BHK Painting', 'painting', 'Interior emulsion painting for a 1 BHK home.', 4999, 480, 18, 0, 0, 2200, 0, 12],
  ['Door Repair', 'carpentry', 'Hinge, lock, and alignment repair for wooden doors.', 449, 60, 0, 0, 0, 220, 0, 13],
  ['Cockroach Control', 'pest-control', 'Gel and spray treatment for kitchens and bathrooms.', 999, 60, 0, 100, 0, 400, 1, 14],
  ['Handyman Visit', 'home-maintenance', 'A one-hour visit for small repairs around the house.', 399, 60, 0, 0, 0, 200, 0, 15],
  ['At-home Haircut', 'beauty-services', 'Professional haircut at your home.', 499, 45, 0, 0, 0, 250, 0, 16],
  ['TV Wall Mount', 'other-services', 'Secure wall mounting for TVs up to 55 inches.', 799, 60, 0, 0, 0, 350, 0, 17],
];

function price(base, discountAmount, discountPercent, taxPercent) {
  const discount = discountAmount + base * (discountPercent / 100);
  const taxable = Math.max(base - discount, 0);
  const tax = taxable * (taxPercent / 100);
  return {
    discount: Math.round(discount * 100) / 100,
    tax: Math.round(tax * 100) / 100,
    total: Math.round((taxable + tax) * 100) / 100,
  };
}

function margin(total, techCost, discount, other = 0) {
  return Math.round((total - techCost - discount - other) * 100) / 100;
}

function iso(date) {
  const p = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())}`;
}

async function main() {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    multipleStatements: true,
    dateStrings: true,
  });

  const dbName = process.env.DB_NAME || 'urban_services';
  if (!/^[A-Za-z0-9_]+$/.test(dbName)) {
    throw new Error('DB_NAME may contain only letters, numbers, and underscores');
  }
  console.log(`Preparing database ${dbName}...`);
  await conn.query(`CREATE DATABASE IF NOT EXISTS \`${dbName}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
  await conn.query(`USE \`${dbName}\``);
  console.log('Applying schema...');
  const schema = fs.readFileSync(schemaPath, 'utf8');
  await conn.query(schema);

  const adminHash = await bcrypt.hash('Admin@123', 10);
  const customerHash = await bcrypt.hash('Customer@123', 10);
  const techHash = await bcrypt.hash('Tech@123', 10);

  const insertUser = async (role, name, email, phone, hash) => {
    const [result] = await conn.query(
      'INSERT INTO users (role, name, email, phone, password_hash, status) VALUES (?, ?, ?, ?, ?, \'active\')',
      [role, name, email, phone, hash],
    );
    return result.insertId;
  };

  const adminId = await insertUser('ADMIN', 'Asha Menon', 'admin@urbanservices.com', '9000000001', adminHash);
  const rajId = await insertUser('CUSTOMER', 'Raj Kumar', 'raj@urbanservices.com', '9876501001', customerHash);
  const priyaId = await insertUser('CUSTOMER', 'Priya Sharma', 'priya@urbanservices.com', '9876501002', customerHash);
  const rameshId = await insertUser('TECHNICIAN', 'Ramesh Kumar', 'ramesh@urbanservices.com', '9876502001', techHash);
  const sureshId = await insertUser('TECHNICIAN', 'Suresh Reddy', 'suresh@urbanservices.com', '9876502002', techHash);
  const anitaId = await insertUser('TECHNICIAN', 'Anita Rao', 'anita@urbanservices.com', '9876502003', techHash);
  const kiranId = await insertUser('TECHNICIAN', 'Kiran Das', 'kiran@urbanservices.com', '9876502004', techHash);

  const [rajCustomer] = await conn.query(
    'INSERT INTO customers (user_id, address, city, state, pincode) VALUES (?, ?, ?, ?, ?)',
    [rajId, '12-3-45, Brodipet', 'Guntur', 'Andhra Pradesh', '522002'],
  );
  const [priyaCustomer] = await conn.query(
    'INSERT INTO customers (user_id, address, city, state, pincode) VALUES (?, ?, ?, ?, ?)',
    [priyaId, '8-2-10, Lakshmipuram', 'Guntur', 'Andhra Pradesh', '522007'],
  );

  const levelIds = {};
  for (const [name, description, sort] of [
    ['Beginner', 'New technicians under supervision', 1],
    ['Standard', 'Independently handles regular jobs', 2],
    ['Experienced', 'Handles complex repairs with a higher service cost', 3],
    ['Expert', 'Senior technicians for premium jobs', 4],
  ]) {
    const [row] = await conn.query(
      'INSERT INTO technician_experience_levels (name, description, sort_order, status) VALUES (?, ?, ?, \'active\')',
      [name, description, sort],
    );
    levelIds[name] = row.insertId;
  }

  const techRows = [
    [rameshId, '1988-04-12', 'Arundelpet', 'Guntur', 'Andhra Pradesh', '522002', 8, levelIds.Experienced, 'approved', 'available', 1, 5, 4.8, 26, 'ramesh@upi', 16.3122, 80.4421],
    [sureshId, '1992-11-02', 'Pattabhipuram', 'Guntur', 'Andhra Pradesh', '522006', 5, levelIds.Standard, 'approved', 'available', 1, 5, 4.6, 18, 'suresh@upi', 16.2894, 80.4215],
    [anitaId, '1985-07-19', 'Brindavan Gardens', 'Guntur', 'Andhra Pradesh', '522006', 11, levelIds.Expert, 'approved', 'offline', 0, 4, 4.9, 31, 'anita@upi', 16.3310, 80.4550],
    [kiranId, '1998-01-25', 'Nallapadu', 'Guntur', 'Andhra Pradesh', '522005', 1.5, levelIds.Beginner, 'pending', 'offline', 0, 3, 0, 0, null, 16.3001, 80.4102],
  ];
  const techIds = {};
  const techNames = ['Ramesh', 'Suresh', 'Anita', 'Kiran'];
  for (let i = 0; i < techRows.length; i += 1) {
    const row = techRows[i];
    const [inserted] = await conn.query(
      `INSERT INTO technicians (
        user_id, dob, address, city, state, pincode, experience_years, level_id, approval_status,
        availability, is_online, daily_job_limit, rating_avg, rating_count, upi_id, base_latitude, base_longitude, bio
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [...row, 'Verified field technician for Urban Services.'],
    );
    techIds[techNames[i]] = inserted.insertId;
  }

  const categoryIds = {};
  for (const [name, slug, description, icon, sort] of categories) {
    const [row] = await conn.query(
      'INSERT INTO categories (name, slug, description, icon, sort_order, status) VALUES (?, ?, ?, ?, ?, \'active\')',
      [name, slug, description, icon, sort],
    );
    categoryIds[slug] = row.insertId;
  }

  const serviceIds = {};
  for (const item of services) {
    const [name, category, description, base, duration, taxPercent, discountAmount, discountPercent, techCost, featured, sort] = item;
    const money = price(base, discountAmount, discountPercent, taxPercent);
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    const [row] = await conn.query(
      `INSERT INTO services (
        category_id, name, slug, description, base_price, duration_minutes, tax_percent, discount_amount,
        discount_percent, final_price, technician_cost, status, featured, is_available, sort_order
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, 1, ?)`,
      [categoryIds[category], name, slug, description, base, duration, taxPercent, discountAmount, discountPercent, money.total, techCost, featured, sort],
    );
    serviceIds[name] = { id: row.insertId, base, discount: money.discount, tax: money.tax, total: money.total, techCost };
  }

  const expertise = {
    Ramesh: ['AC Repair', 'AC Gas Refill', 'AC General Service', 'Fan Installation'],
    Suresh: ['Tap & Leak Repair', 'Drain Blockage', 'Switchboard Repair', 'Washing Machine Repair'],
    Anita: ['Home Deep Cleaning', 'Bathroom Deep Clean', '1 BHK Painting', 'Cockroach Control', 'At-home Haircut'],
    Kiran: ['Handyman Visit', 'Door Repair', 'TV Wall Mount'],
  };
  for (const [name, list] of Object.entries(expertise)) {
    for (const serviceName of list) {
      await conn.query('INSERT INTO technician_services (technician_id, service_id) VALUES (?, ?)', [techIds[name], serviceIds[serviceName].id]);
    }
  }

  await conn.query(
    `INSERT INTO technician_costs (technician_id, service_id, level_id, cost, effective_date, status) VALUES
     (?, ?, NULL, 600, '2026-01-01', 'active'),
     (?, ?, NULL, 500, '2026-01-01', 'active'),
     (NULL, ?, ?, 650, '2026-01-01', 'active'),
     (NULL, ?, ?, 450, '2026-01-01', 'active')`,
    [
      techIds.Ramesh, serviceIds['AC Repair'].id,
      techIds.Suresh, serviceIds['AC Repair'].id,
      serviceIds['AC Repair'].id, levelIds.Expert,
      serviceIds['AC Repair'].id, levelIds.Standard,
    ],
  );

  const [rajAddress] = await conn.query(
    `INSERT INTO customer_addresses (customer_id, label, house_no, street, area, city, state, pincode, landmark, latitude, longitude, is_default)
     VALUES (?, 'Home', '12-3-45', 'Main Road', 'Brodipet', 'Guntur', 'Andhra Pradesh', '522002', 'Near clock tower', 16.3067, 80.4365, 1)`,
    [rajCustomer.insertId],
  );
  const [priyaAddress] = await conn.query(
    `INSERT INTO customer_addresses (customer_id, label, house_no, street, area, city, state, pincode, landmark, latitude, longitude, is_default)
     VALUES (?, 'Home', '8-2-10', 'Lakshmi Street', 'Lakshmipuram', 'Guntur', 'Andhra Pradesh', '522007', 'Opposite park', 16.3184, 80.4512, 1)`,
    [priyaCustomer.insertId],
  );

  await conn.query(
    `INSERT INTO incentive_rules (name, period_type, min_services, amount, start_date, status) VALUES
     ('5 jobs a day', 'daily', 5, 300, '2026-01-01', 'active'),
     ('8 jobs a day', 'daily', 8, 500, '2026-01-01', 'active'),
     ('10 jobs a day', 'daily', 10, 800, '2026-01-01', 'active'),
     ('20 jobs a week', 'weekly', 20, 1000, '2026-01-01', 'active'),
     ('40 jobs a month', 'monthly', 40, 2500, '2026-01-01', 'active')`,
  );

  const faqs = JSON.stringify([
    { q: 'How do I book a service?', a: 'Choose a service, pick a time, confirm your exact location, and pay online or in cash.' },
    { q: 'Can I track the technician?', a: 'Yes. Once the technician is on the way, live tracking opens in your dashboard.' },
    { q: 'How do cancellations work?', a: 'You can cancel or reschedule until 4 hours before the visit, unless an admin override is needed.' },
    { q: 'Are technicians verified?', a: 'Every technician submits an ID and is approved by the admin team before receiving jobs.' },
    { q: 'When is the technician paid?', a: 'Technician earnings use the cost configured by admin, plus any incentive they qualify for.' },
  ]);

  const settings = [
    ['business_name', 'Urban Services', 'general'],
    ['business_email', 'hello@urbanservices.com', 'general'],
    ['business_phone', '+91 90000 00001', 'general'],
    ['business_address', 'Lakshmipuram Main Road, Guntur, Andhra Pradesh', 'general'],
    ['tagline', 'Trusted professionals for every room in your home.', 'general'],
    ['hero_subtitle', 'Book verified technicians for AC, electrical, plumbing, cleaning, and more.', 'general'],
    ['about_text', 'Urban Services connects households with approved technicians, exact locations, and clear pricing.', 'general'],
    ['primary_color', '#2563EB', 'general'],
    ['secondary_color', '#0F172A', 'general'],
    ['currency_symbol', '₹', 'general'],
    ['faqs', faqs, 'general'],
    ['min_booking_lead_hours', '1', 'booking'],
    ['cancellation_hours', '4', 'booking'],
    ['reschedule_hours', '4', 'booking'],
    ['slot_start', '08:00', 'booking'],
    ['slot_end', '20:00', 'booking'],
    ['slot_interval', '60', 'booking'],
    ['max_jobs_per_day', '5', 'technician'],
    ['auto_assign', '0', 'technician'],
    ['smtp_host', '', 'email'],
    ['smtp_port', '587', 'email'],
    ['smtp_user', '', 'email'],
    ['smtp_password', '', 'email'],
    ['smtp_from_name', 'Urban Services', 'email'],
    ['smtp_from_email', 'noreply@urbanservices.local', 'email'],
    ['maps_browser_key', '', 'maps'],
    ['payment_mode', 'record', 'payment'],
  ];
  for (const [key, value, group] of settings) {
    await conn.query('INSERT INTO settings (setting_key, setting_value, group_name) VALUES (?, ?, ?)', [key, value, group]);
  }

  const cities = [
    ['Guntur', 'Guntur', 'Andhra Pradesh', '522001', 16.3067, 80.4365],
    ['Vijayawada', 'Vijayawada', 'Andhra Pradesh', '520001', 16.5062, 80.6480],
    ['Visakhapatnam', 'Visakhapatnam', 'Andhra Pradesh', '530001', 17.6868, 83.2185],
    ['Hyderabad', 'Hyderabad', 'Telangana', '500001', 17.3850, 78.4867],
  ];
  for (const city of cities) {
    await conn.query(
      'INSERT INTO locations (name, city, state, pincode, latitude, longitude, is_serviceable) VALUES (?, ?, ?, ?, ?, ?, 1)',
      city,
    );
  }

  await conn.query(
    `INSERT INTO technician_locations (technician_id, latitude, longitude, accuracy, created_at) VALUES
     (?, 16.3095, 80.4390, 12, NOW()),
     (?, 16.3002, 80.4288, 18, NOW())`,
    [techIds.Ramesh, techIds.Suresh],
  );

  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);

  async function createOrder({
    customerId, addressId, serviceName, techKey, date, time, status, payment, lat, lng, address, city = 'Guntur', landmark = 'Near clock tower', createdAt,
  }) {
    const service = serviceIds[serviceName];
    const techId = techKey ? techIds[techKey] : null;
    let techCost = service.techCost;
    if (techKey === 'Ramesh' && serviceName === 'AC Repair') techCost = 600;
    if (techKey === 'Suresh' && serviceName === 'AC Repair') techCost = 500;
    const adminMargin = margin(service.total, techCost, service.discount);
    const [order] = await conn.query(
      `INSERT INTO orders (
        order_number, customer_id, service_id, technician_id, address_id, house_no, street, area, address_line, landmark,
        city, state, pincode, latitude, longitude, scheduled_date, scheduled_time, subtotal, discount, tax, total_amount,
        technician_cost, other_costs, admin_margin, payment_method, payment_status, order_status, created_at
      ) VALUES ('PENDING', ?, ?, ?, ?, '12-3-45', 'Main Road', 'Brodipet', ?, ?, ?, 'Andhra Pradesh', '522002', ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?)`,
      [
        customerId, service.id, techId, addressId, address, landmark, city, lat, lng, iso(date), time,
        service.base, service.discount, service.tax, service.total, techCost, adminMargin,
        payment === 'paid' ? 'upi' : 'cash', payment, status, createdAt,
      ],
    );
    const orderNumber = `ORD-${10000 + order.insertId}`;
    await conn.query('UPDATE orders SET order_number = ? WHERE id = ?', [orderNumber, order.insertId]);
    await conn.query(
      'INSERT INTO order_items (order_id, service_id, quantity, unit_price, discount, tax, total) VALUES (?, ?, 1, ?, ?, ?, ?)',
      [order.insertId, service.id, service.base, service.discount, service.tax, service.total],
    );
    await conn.query(
      'INSERT INTO order_status_history (order_id, status, note, changed_by, created_at) VALUES (?, \'pending\', \'Booking created\', ?, ?), (?, \'confirmed\', \'Order confirmed\', ?, ?)',
      [order.insertId, rajId, createdAt, order.insertId, adminId, createdAt],
    );
    if (techId) {
      await conn.query(
        'INSERT INTO technician_assignments (order_id, technician_id, assigned_by, status, created_at) VALUES (?, ?, ?, ?, ?)',
        [order.insertId, techId, adminId, ['assigned'].includes(status) ? 'assigned' : 'accepted', createdAt],
      );
      await conn.query(
        'INSERT INTO order_status_history (order_id, status, note, changed_by, created_at) VALUES (?, \'assigned\', \'Technician assigned\', ?, ?)',
        [order.insertId, adminId, createdAt],
      );
    }
    if (['payment_completed', 'service_completed'].includes(status) || payment === 'paid') {
      await conn.query(
        `INSERT INTO payments (order_id, customer_id, amount, method, status, transaction_id, gateway_ref, paid_at, created_at)
         VALUES (?, ?, ?, 'upi', ?, ?, 'RECORDED', ?, ?)`,
        [order.insertId, customerId, service.total, payment === 'paid' ? 'paid' : 'pending', payment === 'paid' ? `TXN${order.insertId}` : null, payment === 'paid' ? createdAt : null, createdAt],
      );
    }
    if (['service_completed', 'payment_completed'].includes(status) && techId) {
      await conn.query(
        `INSERT INTO technician_earnings (technician_id, order_id, base_amount, incentive_amount, total_amount, status, earned_at)
         VALUES (?, ?, ?, 0, ?, 'earned', ?)`,
        [techId, order.insertId, techCost, techCost, createdAt],
      );
    }
    return order.insertId;
  }

  const raj = rajCustomer.insertId;
  const priya = priyaCustomer.insertId;

  await createOrder({
    customerId: raj, addressId: rajAddress.insertId, serviceName: 'AC Repair', techKey: 'Ramesh',
    date: today, time: '16:00:00', status: 'assigned', payment: 'unpaid',
    lat: 16.3067, lng: 80.4365, address: '12-3-45, Main Road, Brodipet, Guntur, Andhra Pradesh, 522002',
    createdAt: `${iso(today)} 09:15:00`,
  });
  await createOrder({
    customerId: priya, addressId: priyaAddress.insertId, serviceName: 'Tap & Leak Repair', techKey: 'Suresh',
    date: today, time: '18:00:00', status: 'on_the_way', payment: 'paid',
    lat: 16.3184, lng: 80.4512, address: '8-2-10, Lakshmi Street, Lakshmipuram, Guntur, Andhra Pradesh, 522007',
    landmark: 'Opposite park', createdAt: `${iso(today)} 08:40:00`,
  });
  await createOrder({
    customerId: raj, addressId: rajAddress.insertId, serviceName: 'Bathroom Deep Clean', techKey: null,
    date: tomorrow, time: '11:00:00', status: 'confirmed', payment: 'unpaid',
    lat: 16.3067, lng: 80.4365, address: '12-3-45, Main Road, Brodipet, Guntur, Andhra Pradesh, 522002',
    createdAt: `${iso(today)} 10:05:00`,
  });

  const catalog = Object.keys(serviceIds);
  const techs = ['Ramesh', 'Suresh', 'Anita'];
  for (let i = 1; i <= 48; i += 1) {
    const when = new Date(today);
    when.setDate(today.getDate() - (i % 28 === 0 ? 1 : i * 2));
    const serviceName = catalog[i % catalog.length];
    const techKey = techs[i % techs.length];
    const customerId = i % 2 === 0 ? raj : priya;
    const addressId = customerId === raj ? rajAddress.insertId : priyaAddress.insertId;
    const stamp = `${iso(when)} 14:00:00`;
    await createOrder({
      customerId, addressId, serviceName, techKey, date: when, time: '14:00:00',
      status: 'payment_completed', payment: 'paid',
      lat: customerId === raj ? 16.3067 : 16.3184,
      lng: customerId === raj ? 80.4365 : 80.4512,
      address: customerId === raj
        ? '12-3-45, Main Road, Brodipet, Guntur, Andhra Pradesh, 522002'
        : '8-2-10, Lakshmi Street, Lakshmipuram, Guntur, Andhra Pradesh, 522007',
      createdAt: stamp,
    });
  }

  const [completed] = await conn.query(
    `SELECT id, customer_id, technician_id FROM orders WHERE order_status = 'payment_completed' ORDER BY id DESC LIMIT 8`,
  );
  const comments = [
    'Reached on time and fixed the issue quickly.',
    'Very professional and explained the work clearly.',
    'Clean work and fair communication.',
    'Would book again.',
  ];
  for (let i = 0; i < completed.length; i += 1) {
    const row = completed[i];
    if (!row.technician_id) continue;
    await conn.query(
      'INSERT INTO reviews (order_id, customer_id, technician_id, rating, comment, status) VALUES (?, ?, ?, ?, ?, \'published\')',
      [row.id, row.customer_id, row.technician_id, 4 + (i % 2), comments[i % comments.length]],
    );
  }
  await conn.query(
    `UPDATE technicians t
     SET rating_avg = COALESCE((SELECT AVG(rating) FROM reviews r WHERE r.technician_id = t.id AND r.status = 'published'), t.rating_avg),
         rating_count = (SELECT COUNT(*) FROM reviews r WHERE r.technician_id = t.id AND r.status = 'published')`,
  );

  await conn.query(
    `INSERT INTO notifications (user_id, title, message, type, link) VALUES
     (?, 'Technician assigned', 'Ramesh Kumar will handle your AC repair today at 4:00 PM.', 'assignment', '/customer/orders'),
     (?, 'New job assigned', 'AC Repair for Raj Kumar is waiting for you.', 'assignment', '/technician/orders'),
     (?, 'New order', 'A bathroom deep clean is waiting for a technician.', 'order', '/admin/orders')`,
    [rajId, rameshId, adminId],
  );

  console.log('Seed complete.');
  console.log('Admin      admin@urbanservices.com / Admin@123');
  console.log('Customer   raj@urbanservices.com / Customer@123');
  console.log('Customer   priya@urbanservices.com / Customer@123');
  console.log('Technician ramesh@urbanservices.com / Tech@123');
  console.log('Technician suresh@urbanservices.com / Tech@123');
  console.log('Technician anita@urbanservices.com / Tech@123');
  console.log('Pending    kiran@urbanservices.com / Tech@123');
  await conn.end();
}

main().catch((error) => {
  console.error('Seed failed:', error.message);
  process.exit(1);
});
