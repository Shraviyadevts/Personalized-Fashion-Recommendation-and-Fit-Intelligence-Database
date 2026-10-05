const path = require('path');
const express = require('express');
const cors = require('cors');
const db = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;
const frontendDir = path.join(__dirname, '..', 'frontend');

app.use(cors());
app.use(express.json());
app.use(express.static(frontendDir));

function query(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.query(sql, params, (err, results) => {
      if (err) {
        reject(err);
        return;
      }
      resolve(results);
    });
  });
}

const TABLES = {
  users: 'users',
  categories: 'category',
  garments: 'garment',
  carts: 'cart',
  orders: 'orders',
  orderItems: 'order_items',
  address: 'address',
  bodyMeasures: 'body_measure',
  reviews: 'reviews',
};

const ENTITY_INFO = {
  users: {
    key: 'users',
    label: 'Users',
    table: TABLES.users,
    sortCandidates: ['user_id', 'name'],
  },
  categories: {
    key: 'categories',
    label: 'Categories',
    table: TABLES.categories,
    sortCandidates: ['cat_id', 'cat_name'],
  },
  garments: {
    key: 'garments',
    label: 'Garments',
    table: TABLES.garments,
    sortCandidates: ['garment_id', 'name'],
  },
  carts: {
    key: 'carts',
    label: 'Carts',
    table: TABLES.carts,
    sortCandidates: ['cart_id', 'user_id'],
  },
  orders: {
    key: 'orders',
    label: 'Orders',
    table: TABLES.orders,
    sortCandidates: ['order_id', 'cart_id'],
  },
  orderItems: {
    key: 'orderItems',
    label: 'Order Items',
    table: TABLES.orderItems,
    sortCandidates: ['order_id', 'garment_id'],
  },
  address: {
    key: 'address',
    label: 'Address',
    table: TABLES.address,
    sortCandidates: ['add_id', 'user_id', 'city'],
  },
  bodyMeasures: {
    key: 'bodyMeasures',
    label: 'Body Measures',
    table: TABLES.bodyMeasures,
    sortCandidates: ['mea_id', 'user_id'],
  },
  reviews: {
    key: 'reviews',
    label: 'Reviews',
    table: TABLES.reviews,
    sortCandidates: ['review_id', 'user_id', 'garment_id'],
  },
};

const PATH_TO_ENTITY = {
  users: ENTITY_INFO.users,
  categories: ENTITY_INFO.categories,
  garments: ENTITY_INFO.garments,
  carts: ENTITY_INFO.carts,
  orders: ENTITY_INFO.orders,
  'order-items': ENTITY_INFO.orderItems,
  address: ENTITY_INFO.address,
  'body-measure': ENTITY_INFO.bodyMeasures,
  reviews: ENTITY_INFO.reviews,
};

const columnCache = new Map();

function asyncRoute(handler) {
  return async (req, res) => {
    try {
      await handler(req, res);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  };
}

function titleize(name) {
  return name
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

async function getColumns(table) {
  if (columnCache.has(table)) {
    return columnCache.get(table);
  }

  const rows = await query(`SHOW COLUMNS FROM ${table}`);
  const columns = rows.map((row, index) => ({
    name: row.Field,
    type: row.Type,
    nullable: row.Null === 'YES',
    key: row.Key,
    defaultValue: row.Default,
    extra: row.Extra,
    index,
    label: titleize(row.Field),
  }));

  columnCache.set(table, columns);
  return columns;
}

async function getColumnNames(table) {
  const columns = await getColumns(table);
  return columns.map((column) => column.name);
}

function inferKeyColumns(columns) {
  const primaryColumns = columns.filter((column) => column.key === 'PRI').map((column) => column.name);
  if (primaryColumns.length) {
    return primaryColumns;
  }

  const idColumns = columns.filter((column) => /(^|_)id$/i.test(column.name)).map((column) => column.name);
  if (idColumns.length) {
    return [idColumns[0]];
  }

  return columns.length ? [columns[0].name] : [];
}

async function getEntitySchema(entity) {
  let columns = await getColumns(entity.table);
  return {
    entity: entity.key,
    label: entity.label,
    table: entity.table,
    columns,
    keyColumns: inferKeyColumns(columns),
  };
}

function sanitizePayload(payload) {
  return Object.fromEntries(
    Object.entries(payload || {}).filter(([, value]) => value !== undefined)
  );
}

function coerceValue(value, column) {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  if (/int|decimal|float|double/i.test(column.type)) {
    const numberValue = Number(value);
    return Number.isNaN(numberValue) ? value : numberValue;
  }

  return value;
}

async function getRecords(entity) {
  const schema = await getEntitySchema(entity);
  const columnNames = schema.columns.map((column) => column.name);
  const sortColumn = entity.sortCandidates.find((candidate) => columnNames.includes(candidate));
  const searchTerm = String(entity.searchTerm || '').trim();

  if (searchTerm) {
    const searchableColumns = columnNames.filter((columnName) => /name|city|state|gender|category/i.test(columnName));
    if (searchableColumns.length) {
      const searchClause = searchableColumns.map((columnName) => `${columnName} LIKE ?`).join(' OR ');
      const params = searchableColumns.map(() => `%${searchTerm}%`);
      const orderClause = sortColumn ? ` ORDER BY ${sortColumn}` : '';
      return query(`SELECT * FROM ${entity.table} WHERE ${searchClause}${orderClause}`, params);
    }
  }

  const orderClause = sortColumn ? ` ORDER BY ${sortColumn}` : '';
  return query(`SELECT * FROM ${entity.table}${orderClause}`);
}

function buildGarmentCatalogWhere(filters = {}) {
  const clauses = [];
  const params = [];

  if (filters.name) {
    clauses.push('g.name LIKE ?');
    params.push(`%${filters.name}%`);
  }

  if (filters.gender) {
    clauses.push('g.gender = ?');
    params.push(filters.gender);
  }

  if (filters.minPrice) {
    clauses.push('COALESCE(price_stats.avg_price, 0) >= ?');
    params.push(Number(filters.minPrice));
  }

  if (filters.maxPrice) {
    clauses.push('COALESCE(price_stats.avg_price, 0) <= ?');
    params.push(Number(filters.maxPrice));
  }

  return {
    clause: clauses.length ? `WHERE ${clauses.join(' AND ')}` : '',
    params,
  };
}

async function getGarmentCatalog(filters = {}) {
  const where = buildGarmentCatalogWhere(filters);
  return query(
    `
    SELECT
      g.garment_id,
      g.cat_id,
      g.name,
      g.gender,
      g.fabric,
      c.cat_name AS category_name,
      ROUND(COALESCE(price_stats.avg_price, 0), 2) AS avg_price,
      ROUND(COALESCE(review_stats.avg_rating, 0), 2) AS avg_rating,
      COALESCE(pop_stats.total_orders, 0) AS total_orders
    FROM ${TABLES.garments} g
    LEFT JOIN ${TABLES.categories} c ON g.cat_id = c.cat_id
    LEFT JOIN (
      SELECT garment_id, AVG(price) AS avg_price
      FROM ${TABLES.orderItems}
      GROUP BY garment_id
    ) price_stats ON g.garment_id = price_stats.garment_id
    LEFT JOIN (
      SELECT garment_id, AVG(rating) AS avg_rating, COUNT(*) AS review_count
      FROM ${TABLES.reviews}
      GROUP BY garment_id
    ) review_stats ON g.garment_id = review_stats.garment_id
    LEFT JOIN (
      SELECT garment_id, SUM(quantity) AS total_orders
      FROM ${TABLES.orderItems}
      GROUP BY garment_id
    ) pop_stats ON g.garment_id = pop_stats.garment_id
    ${where.clause}
    ORDER BY total_orders DESC, avg_rating DESC, g.garment_id DESC
    `,
    where.params
  );
}

async function getPopularGarments(limit = 6) {
  return query(
    `
    SELECT
      g.garment_id,
      g.name,
      g.gender,
      g.fabric,
      c.cat_name AS category_name,
      SUM(oi.quantity) AS total_quantity,
      ROUND(AVG(oi.price), 2) AS avg_price
    FROM ${TABLES.orderItems} oi
    JOIN ${TABLES.garments} g ON oi.garment_id = g.garment_id
    LEFT JOIN ${TABLES.categories} c ON g.cat_id = c.cat_id
    GROUP BY g.garment_id, g.name, g.gender, g.fabric, c.cat_name
    ORDER BY total_quantity DESC, g.name ASC
    LIMIT ?
    `,
    [Number(limit)]
  );
}

async function getCount(table) {
  const rows = await query(`SELECT COUNT(*) AS total FROM ${table}`);
  return rows[0]?.total ?? 0;
}

async function insertRecord(entity, payload) {
  const schema = await getEntitySchema(entity);
  const cleanedPayload = sanitizePayload(payload);
  const entries = schema.columns
    .filter((column) => cleanedPayload[column.name] !== undefined)
    .map((column) => [column.name, coerceValue(cleanedPayload[column.name], column)]);

  const requiredFields = schema.columns
    .filter((column) => !column.nullable && column.defaultValue === null && !/auto_increment/i.test(column.extra))
    .map((column) => column.name);

  const missing = requiredFields.filter((field) => cleanedPayload[field] === undefined || cleanedPayload[field] === '');
  if (missing.length) {
    return {
      ok: false,
      status: 400,
      message: `${missing.join(', ')} ${missing.length > 1 ? 'are' : 'is'} required.`,
    };
  }

  if (!entries.length) {
    return { ok: false, status: 400, message: 'No valid fields were provided.' };
  }

  const fieldList = entries.map(([name]) => name).join(', ');
  const placeholders = entries.map(() => '?').join(', ');
  const values = entries.map(([, value]) => value);

  await query(`INSERT INTO ${entity.table} (${fieldList}) VALUES (${placeholders})`, values);
  return { ok: true };
}

function buildWhereClause(schema, keys) {
  const safeKeys = sanitizePayload(keys);
  const missingKeys = schema.keyColumns.filter((columnName) => safeKeys[columnName] === undefined || safeKeys[columnName] === '');

  if (missingKeys.length) {
    return {
      ok: false,
      status: 400,
      message: `Missing key value for ${missingKeys.join(', ')}.`,
    };
  }

  const clauses = [];
  const values = [];

  schema.keyColumns.forEach((keyName) => {
    const column = schema.columns.find((item) => item.name === keyName);
    clauses.push(`${keyName} = ?`);
    values.push(coerceValue(safeKeys[keyName], column));
  });

  return {
    ok: true,
    clause: clauses.join(' AND '),
    values,
  };
}

async function updateRecord(entity, keys, updates) {
  const schema = await getEntitySchema(entity);
  const where = buildWhereClause(schema, keys);
  if (!where.ok) {
    return where;
  }

  const safeUpdates = sanitizePayload(updates);
  const updateEntries = schema.columns
    .filter((column) => safeUpdates[column.name] !== undefined)
    .map((column) => [column.name, coerceValue(safeUpdates[column.name], column)]);

  if (!updateEntries.length) {
    return { ok: false, status: 400, message: 'No update values were provided.' };
  }

  const setClause = updateEntries.map(([name]) => `${name} = ?`).join(', ');
  const values = updateEntries.map(([, value]) => value);
  const result = await query(
    `UPDATE ${entity.table} SET ${setClause} WHERE ${where.clause}`,
    [...values, ...where.values]
  );

  if (!result.affectedRows) {
    return { ok: false, status: 404, message: 'Record not found.' };
  }

  return { ok: true };
}

async function deleteRecord(entity, keys) {
  const schema = await getEntitySchema(entity);
  const where = buildWhereClause(schema, keys);
  if (!where.ok) {
    return where;
  }

  const result = await query(`DELETE FROM ${entity.table} WHERE ${where.clause}`, where.values);
  if (!result.affectedRows) {
    return { ok: false, status: 404, message: 'Record not found.' };
  }

  return { ok: true };
}

async function getDashboardData() {
  const [users, categories, garments, carts, orders, orderItems, address, bodyMeasures, reviews] = await Promise.all([
    getCount(TABLES.users),
    getCount(TABLES.categories),
    getCount(TABLES.garments),
    getCount(TABLES.carts),
    getCount(TABLES.orders),
    getCount(TABLES.orderItems),
    getCount(TABLES.address),
    getCount(TABLES.bodyMeasures),
    getCount(TABLES.reviews),
  ]);

  const [topGarment] = await query(
    `SELECT name, gender FROM ${TABLES.garments} ORDER BY garment_id DESC LIMIT 1`
  );
  const [topCategory] = await query(
    `SELECT cat_name FROM ${TABLES.categories} ORDER BY cat_id DESC LIMIT 1`
  );
  const [avgOrderValue] = await query(
    `SELECT ROUND(AVG(tot_amt), 2) AS avgAmount FROM ${TABLES.orders}`
  );
  const [avgRating] = await query(
    `SELECT ROUND(AVG(rating), 2) AS avgRating FROM ${TABLES.reviews}`
  );
  const [totalRevenue] = await query(
    `SELECT ROUND(COALESCE(SUM(tot_amt), 0), 2) AS revenue FROM ${TABLES.orders}`
  );
  const [topCity] = await query(
    `SELECT city, COUNT(*) AS total FROM ${TABLES.address} GROUP BY city ORDER BY total DESC, city ASC LIMIT 1`
  );
  const [topUser] = await query(
    `SELECT c.user_id, COUNT(*) AS total
     FROM ${TABLES.orders} o
     JOIN ${TABLES.carts} c ON o.cart_id = c.cart_id
     GROUP BY c.user_id
     ORDER BY total DESC, c.user_id ASC
     LIMIT 1`
  );
  const [quantitySummary] = await query(
    `SELECT COALESCE(SUM(quantity), 0) AS totalQuantity FROM ${TABLES.orderItems}`
  );
  const [popularGarment] = await query(
    `SELECT g.name, SUM(oi.quantity) AS total_quantity
     FROM ${TABLES.orderItems} oi
     JOIN ${TABLES.garments} g ON oi.garment_id = g.garment_id
     GROUP BY g.garment_id, g.name
     ORDER BY total_quantity DESC, g.name ASC
     LIMIT 1`
  );

  const totalRecords = users + categories + garments + carts + orders + orderItems + address + bodyMeasures + reviews;

  return {
    stats: {
      users,
      categories,
      garments,
      carts,
      orders,
      orderItems,
      address,
      bodyMeasures,
      reviews,
      revenue: totalRevenue?.revenue ?? 0,
      totalRecords,
      tableCount: 9,
    },
    insights: [
      {
        title: 'Top Garment',
        value: topGarment ? topGarment.name : 'No garments',
        detail: topGarment ? `${topGarment.gender || 'Unisex'} garment record` : 'Latest garment entry.',
      },
      {
        title: 'Latest Category',
        value: topCategory ? topCategory.cat_name : 'No categories',
        detail: 'Newest category in the category table.',
      },
      {
        title: 'Average Order Value',
        value: avgOrderValue?.avgAmount ?? 0,
        detail: 'Average total amount across orders.',
      },
      {
        title: 'Average Rating',
        value: avgRating?.avgRating ?? 0,
        detail: 'Average rating across all reviews.',
      },
      {
        title: 'Busiest City',
        value: topCity ? topCity.city : 'No city data',
        detail: topCity ? `${topCity.total} address record(s)` : 'Add addresses to see location patterns.',
      },
      {
        title: 'Most Active User',
        value: topUser ? `User ${topUser.user_id}` : 'No orders',
        detail: topUser ? `${topUser.total} order(s)` : 'Orders will power this insight.',
      },
      {
        title: 'Most Popular Garment',
        value: popularGarment ? popularGarment.name : 'No sales yet',
        detail: popularGarment ? `${popularGarment.total_quantity} item(s) ordered` : 'Order history will power this insight.',
      },
    ],
    spotlight: {
      totalQuantity: quantitySummary?.totalQuantity ?? 0,
    },
  };
}

async function ensureOptionalSchema() {
  const garmentColumns = await getColumnNames(TABLES.garments);
  const reviewColumns = await getColumnNames(TABLES.reviews);

  if (!garmentColumns.includes('gender')) {
    await query(`ALTER TABLE ${TABLES.garments} ADD COLUMN gender VARCHAR(20) DEFAULT 'Unisex'`);
  }

  if (!reviewColumns.includes('comment')) {
    await query(`ALTER TABLE ${TABLES.reviews} ADD COLUMN comment VARCHAR(255) NULL`);
  }

  await query(`
    UPDATE ${TABLES.garments}
    SET gender = CASE
      WHEN LOWER(name) IN ('dress', 'kurti', 'saree', 'floral saree', 'silk kurta') THEN 'Women'
      WHEN LOWER(name) IN ('shirt', 'jeans', 'cotton chinos', 'linen shirt', 't-shirt') THEN 'Men'
      ELSE COALESCE(NULLIF(gender, ''), 'Unisex')
    END
    WHERE gender IS NULL OR gender = '' OR gender = 'Unisex'
  `);

  columnCache.clear();
}

app.get('/api/health', asyncRoute(async (req, res) => {
  res.json({
    status: 'ok',
    database: 'sfashionsdb',
  });
}));

app.get('/api/stats', asyncRoute(async (req, res) => {
  const dashboard = await getDashboardData();
  res.json(dashboard.stats);
}));

app.get('/api/dashboard', asyncRoute(async (req, res) => {
  res.json(await getDashboardData());
}));

app.get('/api/meta', asyncRoute(async (req, res) => {
  const entities = await Promise.all(
    Object.values(ENTITY_INFO).map(async (entity) => getEntitySchema(entity))
  );
  res.json({ entities });
}));

app.get('/api/meta/:entity', asyncRoute(async (req, res) => {
  const entity = PATH_TO_ENTITY[req.params.entity];
  if (!entity) {
    res.status(404).json({ error: 'Unknown entity.' });
    return;
  }
  res.json(await getEntitySchema(entity));
}));

app.get('/api/users/search', asyncRoute(async (req, res) => {
  const entity = { ...ENTITY_INFO.users, searchTerm: req.query.q };
  res.json(await getRecords(entity));
}));

app.get('/api/garments/search', asyncRoute(async (req, res) => {
  const entity = { ...ENTITY_INFO.garments, searchTerm: req.query.q };
  res.json(await getRecords(entity));
}));

app.get('/api/garments/catalog', asyncRoute(async (req, res) => {
  res.json(await getGarmentCatalog({
    name: String(req.query.name || '').trim(),
    gender: String(req.query.gender || '').trim(),
    minPrice: req.query.min_price,
    maxPrice: req.query.max_price,
  }));
}));

app.get('/api/recommendations', asyncRoute(async (req, res) => {
  const userId = req.query.user_id ? Number(req.query.user_id) : null;
  const rawGender = String(req.query.gender || '').trim();
  let effectiveGender =
    /^men$/i.test(rawGender) ? 'Male' :
    /^women$/i.test(rawGender) ? 'Female' :
    rawGender;

  if (userId) {
    const [userRow] = await query(`SELECT gender FROM ${TABLES.users} WHERE user_id = ?`, [userId]);
    if (userRow?.gender) {
      effectiveGender = userRow.gender;
    }
  }

  const params = [];
  let whereClause = '';

  if (effectiveGender) {
    whereClause = 'WHERE (g.gender = ? OR g.gender = ?)';
    params.push(effectiveGender, 'Unisex');
  }

  if (userId) {
    whereClause += whereClause ? ' AND ' : 'WHERE ';
    whereClause += `g.garment_id NOT IN (
      SELECT oi.garment_id
      FROM ${TABLES.orders} o
      JOIN ${TABLES.carts} c ON o.cart_id = c.cart_id
      JOIN ${TABLES.orderItems} oi ON oi.order_id = o.order_id
      WHERE c.user_id = ?
    )`;
    params.push(userId);
  }

  const rows = await query(
    `
    SELECT
      g.garment_id,
      g.cat_id,
      g.name,
      g.gender,
      g.fabric,
      c.cat_name AS category_name,
      ROUND(COALESCE(price_stats.avg_price, 0), 2) AS avg_price,
      ROUND(COALESCE(review_stats.avg_rating, 0), 2) AS avg_rating,
      COALESCE(pop_stats.total_orders, 0) AS total_orders,
      CASE
        WHEN pref.cat_id IS NOT NULL THEN 2
        WHEN pref.fabric IS NOT NULL THEN 1
        ELSE 0
      END AS preference_score
    FROM ${TABLES.garments} g
    LEFT JOIN ${TABLES.categories} c ON g.cat_id = c.cat_id
    LEFT JOIN (
      SELECT garment_id, AVG(price) AS avg_price
      FROM ${TABLES.orderItems}
      GROUP BY garment_id
    ) price_stats ON g.garment_id = price_stats.garment_id
    LEFT JOIN (
      SELECT garment_id, AVG(rating) AS avg_rating
      FROM ${TABLES.reviews}
      GROUP BY garment_id
    ) review_stats ON g.garment_id = review_stats.garment_id
    LEFT JOIN (
      SELECT garment_id, SUM(quantity) AS total_orders
      FROM ${TABLES.orderItems}
      GROUP BY garment_id
    ) pop_stats ON g.garment_id = pop_stats.garment_id
    LEFT JOIN (
      SELECT DISTINCT gp.cat_id, gp.fabric
      FROM ${TABLES.orders} o
      JOIN ${TABLES.carts} c ON o.cart_id = c.cart_id
      JOIN ${TABLES.orderItems} oi ON oi.order_id = o.order_id
      JOIN ${TABLES.garments} gp ON gp.garment_id = oi.garment_id
      WHERE c.user_id = ?
    ) pref ON pref.cat_id = g.cat_id OR pref.fabric = g.fabric
    ${whereClause}
    ORDER BY preference_score DESC, total_orders DESC, avg_rating DESC, avg_price ASC, g.garment_id DESC
    LIMIT 8
    `,
    [userId || 0, ...params]
  );

  res.json(rows);
}));

app.get('/api/reviews/summary', asyncRoute(async (req, res) => {
  const [overall] = await query(
    `SELECT ROUND(AVG(rating), 2) AS averageRating, COUNT(*) AS totalReviews FROM ${TABLES.reviews}`
  );
  const topRated = await query(
    `
    SELECT
      g.name,
      ROUND(AVG(r.rating), 2) AS averageRating,
      COUNT(*) AS totalReviews
    FROM ${TABLES.reviews} r
    JOIN ${TABLES.garments} g ON r.garment_id = g.garment_id
    GROUP BY g.garment_id, g.name
    ORDER BY averageRating DESC, totalReviews DESC, g.name ASC
    LIMIT 6
    `
  );

  res.json({
    averageRating: overall?.averageRating ?? 0,
    totalReviews: overall?.totalReviews ?? 0,
    topRated,
  });
}));

app.get('/api/popular-garments', asyncRoute(async (req, res) => {
  res.json(await getPopularGarments(req.query.limit || 6));
}));

app.get('/api/analytics/summary', asyncRoute(async (req, res) => {
  const [users, garments, orders, revenue] = await Promise.all([
    getCount(TABLES.users),
    getCount(TABLES.garments),
    getCount(TABLES.orders),
    query(`SELECT ROUND(COALESCE(SUM(tot_amt), 0), 2) AS revenue FROM ${TABLES.orders}`),
  ]);

  res.json({
    totalUsers: users,
    totalGarments: garments,
    totalOrders: orders,
    totalRevenue: revenue[0]?.revenue ?? 0,
  });
}));

app.get('/api/analytics/orders-per-user', asyncRoute(async (req, res) => {
  const rows = await query(
    `
    SELECT u.name AS user_name, COUNT(o.order_id) AS total_orders
    FROM ${TABLES.users} u
    LEFT JOIN ${TABLES.carts} c ON u.user_id = c.user_id
    LEFT JOIN ${TABLES.orders} o ON c.cart_id = o.cart_id
    GROUP BY u.user_id, u.name
    ORDER BY total_orders DESC, u.name ASC
    `
  );
  res.json(rows);
}));

app.get('/api/analytics/garments-by-category', asyncRoute(async (req, res) => {
  const rows = await query(
    `
    SELECT c.cat_name AS category_name, COUNT(g.garment_id) AS total_garments
    FROM ${TABLES.categories} c
    LEFT JOIN ${TABLES.garments} g ON c.cat_id = g.cat_id
    GROUP BY c.cat_id, c.cat_name
    ORDER BY total_garments DESC, c.cat_name ASC
    `
  );
  res.json(rows);
}));

app.get('/api/analytics/orders-over-time', asyncRoute(async (req, res) => {
  const rows = await query(
    `
    SELECT DATE_FORMAT(o_date, '%Y-%m-%d') AS order_date, COUNT(*) AS total_orders
    FROM ${TABLES.orders}
    GROUP BY DATE_FORMAT(o_date, '%Y-%m-%d')
    ORDER BY order_date ASC
    `
  );
  res.json(rows);
}));

app.get('/api/analytics/totals-chart', asyncRoute(async (req, res) => {
  const rows = [
    { label: 'Users', value: await getCount(TABLES.users) },
    { label: 'Category', value: await getCount(TABLES.categories) },
    { label: 'Garments', value: await getCount(TABLES.garments) },
    { label: 'Cart', value: await getCount(TABLES.carts) },
    { label: 'Orders', value: await getCount(TABLES.orders) },
    { label: 'Order Items', value: await getCount(TABLES.orderItems) },
    { label: 'Address', value: await getCount(TABLES.address) },
    { label: 'Body Measure', value: await getCount(TABLES.bodyMeasures) },
    { label: 'Reviews', value: await getCount(TABLES.reviews) },
  ];
  res.json(rows);
}));

app.get('/api/analytics/revenue-by-date', asyncRoute(async (req, res) => {
  const rows = await query(
    `
    SELECT DATE_FORMAT(o_date, '%Y-%m-%d') AS order_date, ROUND(COALESCE(SUM(tot_amt), 0), 2) AS total_revenue
    FROM ${TABLES.orders}
    GROUP BY DATE_FORMAT(o_date, '%Y-%m-%d')
    ORDER BY order_date ASC
    `
  );
  res.json(rows);
}));

app.get('/api/analytics/users-by-gender', asyncRoute(async (req, res) => {
  const rows = await query(
    `
    SELECT COALESCE(NULLIF(gender, ''), 'Unknown') AS gender_label, COUNT(*) AS total_users
    FROM ${TABLES.users}
    GROUP BY COALESCE(NULLIF(gender, ''), 'Unknown')
    ORDER BY total_users DESC, gender_label ASC
    `
  );
  res.json(rows);
}));

app.get('/api/analytics/revenue-per-user', asyncRoute(async (req, res) => {
  const rows = await query(
    `
    SELECT
      u.name AS user_name,
      ROUND(COALESCE(SUM(o.tot_amt), 0), 2) AS total_revenue
    FROM ${TABLES.users} u
    LEFT JOIN ${TABLES.carts} c ON u.user_id = c.user_id
    LEFT JOIN ${TABLES.orders} o ON c.cart_id = o.cart_id
    GROUP BY u.user_id, u.name
    ORDER BY total_revenue DESC, u.name ASC
    `
  );
  res.json(rows);
}));

app.get('/api/analytics/garments-by-gender', asyncRoute(async (req, res) => {
  const rows = await query(
    `
    SELECT COALESCE(NULLIF(gender, ''), 'Unisex') AS gender_label, COUNT(*) AS total_garments
    FROM ${TABLES.garments}
    GROUP BY COALESCE(NULLIF(gender, ''), 'Unisex')
    ORDER BY total_garments DESC, gender_label ASC
    `
  );
  res.json(rows);
}));

app.get('/api/analytics/revenue-by-category', asyncRoute(async (req, res) => {
  const rows = await query(
    `
    SELECT
      c.cat_name AS category_name,
      ROUND(COALESCE(SUM(oi.price * oi.quantity), 0), 2) AS total_revenue
    FROM ${TABLES.categories} c
    LEFT JOIN ${TABLES.garments} g ON c.cat_id = g.cat_id
    LEFT JOIN ${TABLES.orderItems} oi ON g.garment_id = oi.garment_id
    GROUP BY c.cat_id, c.cat_name
    ORDER BY total_revenue DESC, c.cat_name ASC
    `
  );
  res.json(rows);
}));

app.get('/api/analytics/garment-prices', asyncRoute(async (req, res) => {
  const rows = await query(
    `
    SELECT
      g.name,
      ROUND(COALESCE(AVG(oi.price), 0), 2) AS average_price
    FROM ${TABLES.garments} g
    LEFT JOIN ${TABLES.orderItems} oi ON g.garment_id = oi.garment_id
    GROUP BY g.garment_id, g.name
    ORDER BY average_price DESC, g.name ASC
    `
  );
  res.json(rows);
}));

app.get('/api/analytics/orders-by-status', asyncRoute(async (req, res) => {
  const rows = await query(
    `
    SELECT COALESCE(NULLIF(status, ''), 'Unknown') AS status_label, COUNT(*) AS total_orders
    FROM ${TABLES.orders}
    GROUP BY COALESCE(NULLIF(status, ''), 'Unknown')
    ORDER BY total_orders DESC, status_label ASC
    `
  );
  res.json(rows);
}));

app.get('/api/analytics/top-garments', asyncRoute(async (req, res) => {
  const rows = await query(
    `
    SELECT
      g.name,
      COALESCE(SUM(oi.quantity), 0) AS total_quantity,
      ROUND(COALESCE(SUM(oi.price * oi.quantity), 0), 2) AS total_revenue
    FROM ${TABLES.garments} g
    LEFT JOIN ${TABLES.orderItems} oi ON g.garment_id = oi.garment_id
    GROUP BY g.garment_id, g.name
    ORDER BY total_quantity DESC, g.name ASC
    LIMIT 10
    `
  );
  res.json(rows);
}));

app.get('/api/analytics/ratings-by-garment', asyncRoute(async (req, res) => {
  const rows = await query(
    `
    SELECT
      g.name,
      ROUND(AVG(r.rating), 2) AS average_rating,
      COUNT(r.review_id) AS total_reviews
    FROM ${TABLES.garments} g
    LEFT JOIN ${TABLES.reviews} r ON g.garment_id = r.garment_id
    GROUP BY g.garment_id, g.name
    HAVING COUNT(r.review_id) > 0
    ORDER BY average_rating DESC, total_reviews DESC, g.name ASC
    `
  );
  res.json(rows);
}));

app.get('/api/analytics/review-distribution', asyncRoute(async (req, res) => {
  const rows = await query(
    `
    SELECT rating AS rating_label, COUNT(*) AS total_reviews
    FROM ${TABLES.reviews}
    GROUP BY rating
    ORDER BY rating ASC
    `
  );
  res.json(rows);
}));

Object.entries(PATH_TO_ENTITY).forEach(([pathKey, entity]) => {
  app.get(`/api/${pathKey}`, asyncRoute(async (req, res) => {
    const runtimeEntity = { ...entity, searchTerm: req.query.q };
    res.json(await getRecords(runtimeEntity));
  }));

  app.post(`/api/${pathKey}`, asyncRoute(async (req, res) => {
    const result = await insertRecord(entity, req.body);
    if (!result.ok) {
      res.status(result.status).json({ error: result.message });
      return;
    }
    res.status(201).json({ message: `${entity.label} created.` });
  }));

  app.put(`/api/${pathKey}`, asyncRoute(async (req, res) => {
    const result = await updateRecord(entity, req.body.keys, req.body.updates);
    if (!result.ok) {
      res.status(result.status).json({ error: result.message });
      return;
    }
    res.json({ message: `${entity.label} updated.` });
  }));

  app.delete(`/api/${pathKey}`, asyncRoute(async (req, res) => {
    const result = await deleteRecord(entity, req.body.keys);
    if (!result.ok) {
      res.status(result.status).json({ error: result.message });
      return;
    }
    res.json({ message: `${entity.label} deleted.` });
  }));
});

const legacyRoutes = [
  ['/users', '/api/users'],
  ['/garments', '/api/garments'],
  ['/orders', '/api/orders'],
  ['/order-items', '/api/order-items'],
  ['/address', '/api/address'],
  ['/stats', '/api/stats'],
  ['/health', '/api/health'],
];

legacyRoutes.forEach(([legacyPath, apiPath]) => {
  app.get(legacyPath, (req, res) => res.redirect(307, apiPath));
  app.post(legacyPath, (req, res) => res.redirect(307, apiPath));
  app.put(legacyPath, (req, res) => res.redirect(307, apiPath));
  app.delete(legacyPath, (req, res) => res.redirect(307, apiPath));
});

app.get('/', (req, res) => {
  res.sendFile(path.join(frontendDir, 'index.html'));
});

async function startServer() {
  await ensureOptionalSchema();
  app.listen(PORT, () => {
    console.log(`FashionRec server running at http://localhost:${PORT}`);
  });
}

startServer().catch((error) => {
  console.error('Startup failed:', error.message);
  process.exit(1);
});
