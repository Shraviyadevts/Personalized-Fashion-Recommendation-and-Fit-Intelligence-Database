const API_BASE = window.location.protocol.startsWith('http')
  ? `${window.location.origin}/api`
  : 'http://localhost:3000/api';

const ENTITY_CONFIG = {
  users: { path: 'users', title: 'Users', page: 'users.html' },
  categories: { path: 'categories', title: 'Categories', page: 'categories.html' },
  garments: { path: 'garments', title: 'Garments', page: 'garments.html' },
  carts: { path: 'carts', title: 'Carts', page: 'carts.html' },
  orders: { path: 'orders', title: 'Orders', page: 'orders.html' },
  orderItems: { path: 'order-items', title: 'Order Items', page: 'order_items.html' },
  address: { path: 'address', title: 'Address', page: 'address.html' },
  bodyMeasures: { path: 'body-measure', title: 'Body Measures', page: 'body_measure.html' },
  reviews: { path: 'reviews', title: 'Reviews', page: 'reviews.html' },
};

let currentCrudState = null;
const chartRegistry = {};

function setActiveNav() {
  const page = window.location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('[data-nav]').forEach((link) => {
    link.classList.toggle('active', link.getAttribute('href') === page);
  });
}

function startClock() {
  const clock = document.getElementById('clock');
  if (!clock) {
    return;
  }

  const update = () => {
    clock.textContent = new Date().toLocaleString('en-IN', {
      dateStyle: 'medium',
      timeStyle: 'short',
    });
  };

  update();
  window.setInterval(update, 1000);
}

function ensureToastContainer() {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    container.className = 'toast-container';
    document.body.appendChild(container);
  }
  return container;
}

function toast(message, type = 'success') {
  const container = ensureToastContainer();
  const element = document.createElement('div');
  element.className = `toast ${type}`;
  element.textContent = message;
  container.appendChild(element);

  window.setTimeout(() => {
    element.classList.add('fade-out');
    window.setTimeout(() => element.remove(), 250);
  }, 2600);
}

async function request(endpoint, options = {}) {
  const response = await fetch(`${API_BASE}${endpoint}`, {
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    ...options,
  });

  if (!response.ok) {
    let message = `Request failed with status ${response.status}`;
    try {
      const payload = await response.json();
      if (payload?.error) {
        message = payload.error;
      }
    } catch (error) {
      // Ignore parsing issues and use the default message.
    }
    throw new Error(message);
  }

  if (response.status === 204) {
    return {};
  }

  return response.json();
}

function getAll(endpoint) {
  return request(`/${endpoint}`);
}

function postData(endpoint, body) {
  return request(`/${endpoint}`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

function putData(endpoint, body) {
  return request(`/${endpoint}`, {
    method: 'PUT',
    body: JSON.stringify(body),
  });
}

function deleteData(endpoint, body) {
  return request(`/${endpoint}`, {
    method: 'DELETE',
    body: JSON.stringify(body),
  });
}

function getStats() {
  return request('/stats');
}

function getHealth() {
  return request('/health');
}

function getDashboard() {
  return request('/dashboard');
}

function getMeta(entityPath) {
  return request(`/meta/${entityPath}`);
}

function getAnalyticsSummary() {
  return request('/analytics/summary');
}

function getOrdersPerUser() {
  return request('/analytics/orders-per-user');
}

function getGarmentsByCategory() {
  return request('/analytics/garments-by-category');
}

function getOrdersOverTime() {
  return request('/analytics/orders-over-time');
}

function getTotalsChart() {
  return request('/analytics/totals-chart');
}

function getRevenueByDate() {
  return request('/analytics/revenue-by-date');
}

function getUsersByGender() {
  return request('/analytics/users-by-gender');
}

function getRevenuePerUser() {
  return request('/analytics/revenue-per-user');
}

function getGarmentsByGender() {
  return request('/analytics/garments-by-gender');
}

function getRevenueByCategory() {
  return request('/analytics/revenue-by-category');
}

function getGarmentPrices() {
  return request('/analytics/garment-prices');
}

function getOrdersByStatus() {
  return request('/analytics/orders-by-status');
}

function getTopGarmentsChart() {
  return request('/analytics/top-garments');
}

function getRatingsByGarment() {
  return request('/analytics/ratings-by-garment');
}

function getReviewDistribution() {
  return request('/analytics/review-distribution');
}

function getReviewsSummary() {
  return request('/reviews/summary');
}

function getPopularGarments() {
  return request('/popular-garments');
}

function formatPrice(value) {
  const amount = Number(value || 0);
  return `Rs ${amount.toLocaleString('en-IN', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })}`;
}

function showLoading(containerId, message = 'Loading data...') {
  const container = document.getElementById(containerId);
  if (!container) {
    return;
  }

  container.innerHTML = `
    <div class="status-card">
      <div class="spinner"></div>
      <p>${message}</p>
    </div>
  `;
}

function showEmpty(containerId, title, detail = '') {
  const container = document.getElementById(containerId);
  if (!container) {
    return;
  }

  container.innerHTML = `
    <div class="status-card empty">
      <h3>${title}</h3>
      <p>${detail}</p>
    </div>
  `;
}

function setText(id, value) {
  const element = document.getElementById(id);
  if (element) {
    element.textContent = value;
  }
}

function prettifyLabel(value) {
  return String(value)
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function renderCell(value, column) {
  if (value === null || value === undefined || value === '') {
    return '<span class="muted">-</span>';
  }

  if (/price/i.test(column.name)) {
    return formatPrice(value);
  }

  if (column.key === 'PRI' || /_id$/i.test(column.name)) {
    return `<span class="tag">${value}</span>`;
  }

  return `${value}`;
}

function getInputType(column) {
  if (/^date$/i.test(column.type)) {
    return 'date';
  }
  if (/datetime|timestamp/i.test(column.type)) {
    return 'datetime-local';
  }
  if (/int|decimal|float|double/i.test(column.type)) {
    return 'number';
  }
  return 'text';
}

function formatInputValue(column, value) {
  if (value === null || value === undefined) {
    return '';
  }

  const stringValue = String(value);
  if (/^date$/i.test(column.type)) {
    return stringValue.slice(0, 10);
  }

  if (/datetime|timestamp/i.test(column.type)) {
    const date = new Date(stringValue);
    if (Number.isNaN(date.getTime())) {
      return stringValue.slice(0, 16);
    }
    const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
    return local.toISOString().slice(0, 16);
  }

  return stringValue;
}

function normalizeValue(column, value) {
  if (value === '') {
    return null;
  }
  if (/^date$/i.test(column.type)) {
    return String(value).slice(0, 10);
  }
  if (/datetime|timestamp/i.test(column.type)) {
    return String(value).replace('T', ' ').slice(0, 19);
  }
  if (/int|decimal|float|double/i.test(column.type)) {
    return Number(value);
  }
  return value;
}

function buildFormFields(schema, mode, record = {}) {
  return schema.columns
  .filter((column) => !(mode === 'create' && /auto_increment/i.test(column.extra)))
  .map((column) => {
    const keyField = schema.keyColumns.includes(column.name);
    const disabled = mode === 'view-keys' && keyField;
    const value = formatInputValue(column, record[column.name]);
    const step = /decimal|float|double/i.test(column.type) ? 'any' : '1';

    return `
      <div class="field">
        <label for="field-${column.name}">
          ${column.label}${keyField ? ' *' : ''}
        </label>
        <input
          id="field-${column.name}"
          data-field="${column.name}"
          data-type="${column.type}"
          type="${getInputType(column)}"
          value="${String(value).replace(/"/g, '&quot;')}"
          ${getInputType(column) === 'number' ? `step="${step}"` : ''}
          ${disabled ? 'disabled' : ''}
        />
      </div>
    `;
  }).join('');
}

function collectFormData(form) {
  const values = {};
  form.querySelectorAll('[data-field]').forEach((input) => {
    values[input.dataset.field] = input.value;
  });
  return values;
}

function filterRows(rows, queryText) {
  if (!queryText) {
    return rows;
  }

  const queryLower = queryText.toLowerCase();
  return rows.filter((row) =>
    Object.values(row).some((value) => String(value ?? '').toLowerCase().includes(queryLower))
  );
}

function renderCrudTable(containerId, schema, rows, entityPath, displayColumns = null) {
  const container = document.getElementById(containerId);
  if (!container) {
    return;
  }

  const columns = displayColumns || schema.columns;
  const headers = columns.map((column) => `<th>${column.label}</th>`).join('');
  const body = rows.map((row) => {
    const rowCells = columns.map((column) => {
      const columnName = column.name || column.key;
      const rawValue = row[columnName];
      const content = column.render ? column.render(rawValue, row) : renderCell(rawValue, column);
      return `<td>${content}</td>`;
    }).join('');
    const rowPayload = encodeURIComponent(JSON.stringify(row));

    return `
      <tr>
        ${rowCells}
        <td class="action-cell">
          <button class="mini-btn" onclick="openEditModal('${entityPath}', '${rowPayload}')">Update</button>
          <button class="mini-btn danger" onclick="removeRecord('${entityPath}', '${rowPayload}')">Delete</button>
        </td>
      </tr>
    `;
  }).join('');

  container.innerHTML = `
    <div class="table-shell">
      <table>
        <thead>
          <tr>${headers}<th>Actions</th></tr>
        </thead>
        <tbody>${body}</tbody>
      </table>
    </div>
  `;
}

function ensureModal() {
  let modal = document.getElementById('edit-modal');
  if (modal) {
    return modal;
  }

  modal = document.createElement('div');
  modal.id = 'edit-modal';
  modal.className = 'modal-shell hidden';
  modal.innerHTML = `
    <div class="modal-card">
      <div class="modal-header">
        <div>
          <h3 id="modal-title">Update record</h3>
          <p id="modal-subtitle" class="muted"></p>
        </div>
        <button class="icon-btn" onclick="closeEditModal()">Close</button>
      </div>
      <form id="edit-form" class="form-grid"></form>
      <div class="actions modal-actions">
        <button class="btn btn-secondary" type="button" onclick="closeEditModal()">Cancel</button>
        <button class="btn btn-primary" type="button" onclick="submitEditModal()">Save changes</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
  return modal;
}

function closeEditModal() {
  const modal = document.getElementById('edit-modal');
  if (modal) {
    modal.classList.add('hidden');
  }
  currentCrudState = currentCrudState ? { ...currentCrudState, editing: null } : null;
}

async function openEditModal(entityPath, encodedRow) {
  if (!currentCrudState || currentCrudState.entityPath !== entityPath) {
    return;
  }

  const row = JSON.parse(decodeURIComponent(encodedRow));
  currentCrudState.editing = row;

  const modal = ensureModal();
  setText('modal-title', `Update ${currentCrudState.schema.label}`);
  setText('modal-subtitle', `Keys: ${currentCrudState.schema.keyColumns.join(', ')}`);
  document.getElementById('edit-form').innerHTML = buildFormFields(currentCrudState.schema, 'edit', row);
  modal.classList.remove('hidden');
}

async function submitEditModal() {
  if (!currentCrudState?.editing) {
    return;
  }

  const form = document.getElementById('edit-form');
  const rawValues = collectFormData(form);
  const updates = {};

  currentCrudState.schema.columns.forEach((column) => {
    updates[column.name] = normalizeValue(column, rawValues[column.name]);
  });

  const keys = {};
  currentCrudState.schema.keyColumns.forEach((keyName) => {
    const column = currentCrudState.schema.columns.find((item) => item.name === keyName);
    keys[keyName] = normalizeValue(column, currentCrudState.editing[keyName]);
  });

  try {
    await putData(currentCrudState.entityPath, { keys, updates });
    toast('Record updated.');
    closeEditModal();
    await loadCrudPage(currentCrudState.pageKey, true);
  } catch (error) {
    toast(error.message, 'error');
  }
}

async function removeRecord(entityPath, encodedRow) {
  if (!currentCrudState || currentCrudState.entityPath !== entityPath) {
    return;
  }

  const row = JSON.parse(decodeURIComponent(encodedRow));
  const keys = {};
  currentCrudState.schema.keyColumns.forEach((keyName) => {
    const column = currentCrudState.schema.columns.find((item) => item.name === keyName);
    keys[keyName] = normalizeValue(column, row[keyName]);
  });

  const confirmed = window.confirm('Delete this record?');
  if (!confirmed) {
    return;
  }

  try {
    await deleteData(entityPath, { keys });
    toast('Record deleted.');
    await loadCrudPage(currentCrudState.pageKey, true);
  } catch (error) {
    toast(error.message, 'error');
  }
}

function renderCreateForm(schema, targetId) {
  const container = document.getElementById(targetId);
  if (!container) {
    return;
  }

  container.innerHTML = buildFormFields(schema, 'create');
}

async function loadCrudPage(pageKey, preserveSearch = false) {
  const config = ENTITY_CONFIG[pageKey];
  if (!config) {
    return;
  }

  const tableContainerId = 'records-table';
  const countId = 'record-count';
  const formId = 'create-form-grid';
  const searchInput = document.getElementById('table-search');
  const activeQuery = preserveSearch && searchInput ? searchInput.value.trim() : '';

  showLoading(tableContainerId);

  try {
    let rowsEndpoint = `/${config.path}`;
    let displayColumns = null;

    if (pageKey === 'garments') {
      const name = document.getElementById('garment-name-filter')?.value.trim() || '';
      const gender = document.getElementById('garment-gender-filter')?.value.trim() || '';
      const minPrice = document.getElementById('garment-min-price')?.value.trim() || '';
      const maxPrice = document.getElementById('garment-max-price')?.value.trim() || '';
      const params = new URLSearchParams();
      if (name || activeQuery) params.set('name', name || activeQuery);
      if (gender) params.set('gender', gender);
      if (minPrice) params.set('min_price', minPrice);
      if (maxPrice) params.set('max_price', maxPrice);
      rowsEndpoint = `/garments/catalog${params.toString() ? `?${params}` : ''}`;
      displayColumns = [
        { name: 'garment_id', label: 'Garment ID' },
        { name: 'name', label: 'Name' },
        { name: 'category_name', label: 'Category' },
        { name: 'gender', label: 'Gender' },
        { name: 'fabric', label: 'Fabric' },
        { name: 'avg_price', label: 'Price', render: (value) => formatPrice(value) },
        { name: 'avg_rating', label: 'Avg Rating' },
        { name: 'total_orders', label: 'Popularity' },
      ];
    } else {
      const searchQuery = activeQuery && ['users'].includes(pageKey) ? `?q=${encodeURIComponent(activeQuery)}` : '';
      rowsEndpoint = `/${config.path}${searchQuery}`;
    }

    const [schema, rows] = await Promise.all([getMeta(config.path), request(rowsEndpoint)]);
    currentCrudState = {
      pageKey,
      entityPath: config.path,
      schema,
      rows,
      editing: null,
      displayColumns,
    };

    renderCreateForm(schema, formId);
    const filteredRows = ['users', 'garments'].includes(pageKey) ? rows : filterRows(rows, activeQuery);

    setText(countId, `${filteredRows.length} record${filteredRows.length === 1 ? '' : 's'}`);
    renderCrudTable(tableContainerId, schema, filteredRows, config.path, displayColumns);
    setText('page-title', config.title);
    setText('page-kicker', schema.table);
    setText('key-info', `Keys: ${schema.keyColumns.join(', ')}`);

    if (searchInput) {
      searchInput.value = activeQuery;
    }

    await loadModuleAnalytics(pageKey);
  } catch (error) {
    setText(countId, '0 records');
    showEmpty(tableContainerId, 'Unable to load records', error.message);
  }
}

async function createRecord() {
  if (!currentCrudState) {
    return;
  }

  const formGrid = document.getElementById('create-form-grid');
  const rawValues = collectFormData(formGrid);
  const payload = {};

  currentCrudState.schema.columns.forEach((column) => {
    const value = normalizeValue(column, rawValues[column.name]);
    if (value !== null && value !== '') {
      payload[column.name] = value;
    }
  });

  try {
    await postData(currentCrudState.entityPath, payload);
    toast('Record added.');
    await loadCrudPage(currentCrudState.pageKey);
  } catch (error) {
    toast(error.message, 'error');
  }
}

function applySearch() {
  if (!currentCrudState) {
    return;
  }

  const query = document.getElementById('table-search')?.value.trim() || '';
  if (['users', 'garments'].includes(currentCrudState.pageKey)) {
    loadCrudPage(currentCrudState.pageKey, true);
    return;
  }
  const filteredRows = filterRows(currentCrudState.rows, query);
  setText('record-count', `${filteredRows.length} record${filteredRows.length === 1 ? '' : 's'}`);
  renderCrudTable('records-table', currentCrudState.schema, filteredRows, currentCrudState.entityPath, currentCrudState.displayColumns);
}

async function loadRecommendations() {
  const gender = document.getElementById('recommendation-gender')?.value || '';
  const userId = document.getElementById('recommendation-user')?.value || '';
  const container = document.getElementById('recommendation-list');
  if (!container) {
    return;
  }

  showLoading('recommendation-list', 'Loading recommendations...');
  try {
    const params = new URLSearchParams();
    if (gender) params.set('gender', gender);
    if (userId) params.set('user_id', userId);
    const rows = await request(`/recommendations${params.toString() ? `?${params}` : ''}`);
    if (!rows.length) {
      showEmpty('recommendation-list', 'No recommendations', 'Try another gender filter.');
      return;
    }

    container.innerHTML = rows.map((row) => `
      <div class="inventory-card">
        <div>
          <strong>${row.name}</strong>
          <span>${row.category_name || `Category ${row.cat_id ?? '-'}`} • ${row.gender || 'Unisex'} • ${row.fabric || 'Fabric not set'}</span>
        </div>
        <b>${formatPrice(row.avg_price || 0)}</b>
      </div>
    `).join('');
  } catch (error) {
    showEmpty('recommendation-list', 'Recommendations unavailable', error.message);
  }
}

async function loadPopularGarments() {
  const container = document.getElementById('popular-garments');
  if (!container) {
    return;
  }

  showLoading('popular-garments', 'Loading popular garments...');
  try {
    const rows = await getPopularGarments();
    container.innerHTML = rows.map((row) => `
      <div class="inventory-card">
        <div>
          <strong>${row.name}</strong>
          <span>${row.category_name || 'Category not set'} • ${row.gender || 'Unisex'} • ${row.fabric || 'Fabric not set'}</span>
        </div>
        <b>${row.total_quantity}</b>
      </div>
    `).join('');
  } catch (error) {
    showEmpty('popular-garments', 'Popular garments unavailable', error.message);
  }
}

function destroyChart(id) {
  if (chartRegistry[id]) {
    chartRegistry[id].destroy();
  }
}

function buildAxisOptions(xTitle, yTitle, beginAtZero = true) {
  return {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        labels: {
          color: '#f2f7f5',
        },
      },
      tooltip: {
        enabled: true,
      },
    },
    scales: {
      x: {
        ticks: {
          color: '#c6d8d4',
          maxRotation: 45,
          minRotation: 0,
        },
        grid: {
          color: 'rgba(255,255,255,0.06)',
        },
        title: {
          display: true,
          text: xTitle,
          color: '#99b3b2',
        },
      },
      y: {
        beginAtZero,
        ticks: {
          color: '#c6d8d4',
        },
        grid: {
          color: 'rgba(255,255,255,0.08)',
        },
        title: {
          display: true,
          text: yTitle,
          color: '#99b3b2',
        },
      },
    },
  };
}

function createBarChart(canvasId, labels, data, datasetLabel, xTitle, yTitle, colors = []) {
  createChart(canvasId, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: datasetLabel,
        data,
        backgroundColor: colors.length ? colors : 'rgba(255, 186, 73, 0.78)',
        borderColor: '#ffba49',
        borderWidth: 1,
        borderRadius: 8,
      }],
    },
    options: buildAxisOptions(xTitle, yTitle),
  });
}

function createLineChart(canvasId, labels, data, datasetLabel, xTitle, yTitle) {
  createChart(canvasId, {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label: datasetLabel,
        data,
        borderColor: '#65dec5',
        backgroundColor: 'rgba(101, 222, 197, 0.18)',
        pointBackgroundColor: '#ffba49',
        pointBorderColor: '#ffba49',
        fill: true,
        tension: 0.3,
      }],
    },
    options: buildAxisOptions(xTitle, yTitle),
  });
}

function createPieChart(canvasId, labels, data, datasetLabel) {
  createChart(canvasId, {
    type: 'pie',
    data: {
      labels,
      datasets: [{
        label: datasetLabel,
        data,
        backgroundColor: ['#ffba49', '#65dec5', '#ff845d', '#8aa3ff', '#ffd386', '#63b6ff', '#9bde7e', '#ff9fd2', '#9c88ff', '#ffa78c'],
        borderColor: 'rgba(6, 16, 23, 0.95)',
        borderWidth: 2,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'bottom',
          labels: {
            color: '#f2f7f5',
          },
        },
      },
    },
  });
}

function hasMeaningfulVariation(values) {
  if (!values.length) {
    return false;
  }
  const normalized = values.map((value) => Number(value || 0));
  return new Set(normalized).size > 1;
}

function createChart(canvasId, config) {
  const canvas = document.getElementById(canvasId);
  if (!canvas || typeof Chart === 'undefined') {
    return;
  }
  destroyChart(canvasId);
  chartRegistry[canvasId] = new Chart(canvas, config);
}

async function loadDashboardCharts() {
  const [revenueByDate, revenueByCategory, topGarments, totalsChart] = await Promise.all([
    getRevenueByDate(),
    getRevenueByCategory(),
    getTopGarmentsChart(),
    getTotalsChart(),
  ]);

  const topGarmentQuantities = topGarments.map((row) => Number(row.total_quantity));
  const useQuantityView = hasMeaningfulVariation(topGarmentQuantities);

  createBarChart(
    'ordersPerUserChart',
    topGarments.map((row) => row.name || 'Unknown'),
    topGarments.map((row) => Number(useQuantityView ? row.total_quantity : row.total_revenue)),
    useQuantityView ? 'Quantity' : 'Revenue',
    'Garments',
    useQuantityView ? 'Ordered Quantity' : 'Revenue'
  );

  createPieChart(
    'garmentsByCategoryChart',
    revenueByCategory.map((row) => row.category_name || 'Unknown'),
    revenueByCategory.map((row) => Number(row.total_revenue)),
    'Revenue'
  );

  createLineChart(
    'ordersOverTimeChart',
    revenueByDate.map((row) => row.order_date),
    revenueByDate.map((row) => Number(row.total_revenue)),
    'Revenue',
    'Order Date',
    'Revenue'
  );

  createBarChart(
    'totalsChart',
    totalsChart.map((row) => row.label),
    totalsChart.map((row) => Number(row.value)),
    'Total',
    'Tables',
    'Count',
    ['#ffba49', '#65dec5', '#ff845d']
  );
}

const MODULE_CHARTS = {
  users: [
    {
      id: 'usersRevenueChart',
      title: 'Revenue Per User',
      subtitle: '',
      type: 'bar',
      loader: getRevenuePerUser,
      labelKey: 'user_name',
      valueKey: 'total_revenue',
      datasetLabel: 'Revenue',
      xTitle: 'Users',
      yTitle: 'Revenue',
    },
    {
      id: 'usersGenderChart',
      title: 'Users By Gender',
      subtitle: '',
      type: 'pie',
      loader: getUsersByGender,
      labelKey: 'gender_label',
      valueKey: 'total_users',
      datasetLabel: 'Users',
    },
  ],
  categories: [
    {
      id: 'categoriesRevenueChart',
      title: 'Revenue By Category',
      subtitle: '',
      type: 'bar',
      loader: getRevenueByCategory,
      labelKey: 'category_name',
      valueKey: 'total_revenue',
      datasetLabel: 'Revenue',
      xTitle: 'Category',
      yTitle: 'Revenue',
    },
  ],
  garments: [
    {
      id: 'garmentPriceChart',
      title: 'Average Price By Garment',
      subtitle: '',
      type: 'bar',
      loader: getGarmentPrices,
      labelKey: 'name',
      valueKey: 'average_price',
      datasetLabel: 'Average Price',
      xTitle: 'Garment',
      yTitle: 'Average Price',
    },
    {
      id: 'garmentGenderChart',
      title: 'Garments By Gender',
      subtitle: '',
      type: 'pie',
      loader: getGarmentsByGender,
      labelKey: 'gender_label',
      valueKey: 'total_garments',
      datasetLabel: 'Garments',
    },
    {
      id: 'garmentPopularityChart',
      title: 'Most Popular Garments',
      subtitle: '',
      type: 'bar',
      loader: getTopGarmentsChart,
      labelKey: 'name',
      valueKey: 'total_quantity',
      dynamicValueKey: 'total_revenue',
      datasetLabel: 'Ordered Quantity',
      dynamicDatasetLabel: 'Revenue',
      xTitle: 'Garment',
      yTitle: 'Quantity',
      dynamicYTitle: 'Revenue',
    },
  ],
  orders: [
    {
      id: 'ordersRevenueChart',
      title: 'Revenue Over Time',
      subtitle: '',
      type: 'line',
      loader: getRevenueByDate,
      labelKey: 'order_date',
      valueKey: 'total_revenue',
      datasetLabel: 'Revenue',
      xTitle: 'Order Date',
      yTitle: 'Revenue',
    },
    {
      id: 'ordersStatusChart',
      title: 'Orders By Status',
      subtitle: '',
      type: 'pie',
      loader: getOrdersByStatus,
      labelKey: 'status_label',
      valueKey: 'total_orders',
      datasetLabel: 'Orders',
    },
  ],
  reviews: [
    {
      id: 'reviewsRatingChart',
      title: 'Average Rating By Garment',
      subtitle: '',
      type: 'bar',
      loader: getRatingsByGarment,
      labelKey: 'name',
      valueKey: 'average_rating',
      datasetLabel: 'Average Rating',
      xTitle: 'Garment',
      yTitle: 'Rating',
    },
    {
      id: 'reviewsDistributionChart',
      title: 'Review Distribution',
      subtitle: '',
      type: 'pie',
      loader: getReviewDistribution,
      labelKey: 'rating_label',
      valueKey: 'total_reviews',
      datasetLabel: 'Reviews',
    },
  ],
};

function ensureModuleAnalyticsSection(pageKey) {
  const main = document.querySelector('.content');
  const grid = document.querySelector('.content .panel-grid');
  if (!main || !grid) {
    return null;
  }

  const existing = document.getElementById('module-analytics');
  const chartItems = MODULE_CHARTS[pageKey] || [];
  if (!chartItems.length) {
    if (existing) {
      existing.remove();
    }
    return null;
  }

  const section = existing || document.createElement('section');
  section.id = 'module-analytics';
  section.className = 'panel-grid module-analytics';
  section.innerHTML = chartItems.map((item) => `
    <article class="panel ${item.type === 'pie' || chartItems.length === 1 ? 'span-12' : 'span-6'}">
      <div class="panel-header">
        <div>
          <h2 class="panel-title">${item.title}</h2>
          ${item.subtitle ? `<p class="panel-subtitle">${item.subtitle}</p>` : ''}
        </div>
      </div>
      <div class="chart-card${item.type === 'line' || item.type === 'pie' ? ' wide' : ''}">
        <canvas id="${item.id}"></canvas>
      </div>
    </article>
  `).join('');

  if (!existing) {
    grid.insertAdjacentElement('afterend', section);
  }
  return section;
}

async function loadModuleAnalytics(pageKey) {
  const chartItems = MODULE_CHARTS[pageKey] || [];
  if (!chartItems.length) {
    return;
  }

  ensureModuleAnalyticsSection(pageKey);

  for (const item of chartItems) {
    const rows = await item.loader();
    const labels = rows.map((row) => row[item.labelKey] || 'Unknown');
    const valueKey = item.dynamicValueKey && !hasMeaningfulVariation(rows.map((row) => row[item.valueKey]))
      ? item.dynamicValueKey
      : item.valueKey;
    const values = rows.map((row) => Number(row[valueKey] || 0));
    const datasetLabel = valueKey === item.valueKey ? item.datasetLabel : (item.dynamicDatasetLabel || item.datasetLabel);
    const yTitle = valueKey === item.valueKey ? item.yTitle : (item.dynamicYTitle || item.yTitle);

    if (item.type === 'pie') {
      createPieChart(item.id, labels, values, datasetLabel);
    } else if (item.type === 'line') {
      createLineChart(item.id, labels, values, datasetLabel, item.xTitle, yTitle);
    } else {
      createBarChart(item.id, labels, values, datasetLabel, item.xTitle, yTitle);
    }
  }
}

async function loadDashboardPage() {
  try {
    const [dashboard, meta, analyticsSummary, reviewsSummary] = await Promise.all([
      getDashboard(),
      request('/meta'),
      getAnalyticsSummary(),
      getReviewsSummary(),
    ]);

    setText('hero-title', 'Welcome to Fashion Recommendation System');
    setText('stat-users', dashboard.stats.users);
    setText('stat-categories', dashboard.stats.categories);
    setText('stat-garments', dashboard.stats.garments);
    setText('stat-carts', dashboard.stats.carts);
    setText('stat-orders', dashboard.stats.orders);
    setText('stat-items', dashboard.stats.orderItems);
    setText('stat-address', dashboard.stats.address);
    setText('stat-measures', dashboard.stats.bodyMeasures);
    setText('stat-reviews', dashboard.stats.reviews);
    setText('stat-revenue', formatPrice(analyticsSummary.totalRevenue));
    setText('stat-total', dashboard.stats.totalRecords);
    setText('pulse-value', dashboard.spotlight.totalQuantity);
    setText('pulse-tables', dashboard.stats.tableCount);
    setText('pulse-rating', reviewsSummary.averageRating || 0);

    const tableMap = {
      users: dashboard.stats.users,
      categories: dashboard.stats.categories,
      garments: dashboard.stats.garments,
      carts: dashboard.stats.carts,
      orders: dashboard.stats.orders,
      orderItems: dashboard.stats.orderItems,
      address: dashboard.stats.address,
      bodyMeasures: dashboard.stats.bodyMeasures,
      reviews: dashboard.stats.reviews,
    };

    const inventory = document.getElementById('table-inventory');
    if (inventory) {
      inventory.innerHTML = meta.entities.map((entity) => `
        <div class="inventory-card">
          <div>
            <strong>${entity.label}</strong>
            <span>${entity.columns.map((column) => column.label).join(', ')}</span>
          </div>
          <b>${tableMap[entity.entity] ?? 0}</b>
        </div>
      `).join('');
    }

    const insights = document.getElementById('insight-grid');
    if (insights) {
      insights.innerHTML = dashboard.insights.map((item) => `
        <div class="insight-card">
          <small>${item.title}</small>
          <strong>${item.value}</strong>
          <span>${item.detail}</span>
        </div>
      `).join('');
    }

    const sparkline = document.getElementById('sparkline-bars');
    if (sparkline) {
      const values = [
        dashboard.stats.users,
        dashboard.stats.categories,
        dashboard.stats.garments,
        dashboard.stats.carts,
        dashboard.stats.orders,
        dashboard.stats.orderItems,
        dashboard.stats.address,
        dashboard.stats.bodyMeasures,
        dashboard.stats.reviews,
      ];
      const max = Math.max(...values, 1);
      sparkline.innerHTML = values.map((value, index) => `
        <div class="spark-col">
          <strong class="spark-value">${value}</strong>
          <div class="spark-bar" style="height:${Math.max(18, (value / max) * 140)}px"></div>
          <label>${['US', 'CT', 'GA', 'CA', 'OR', 'OI', 'AD', 'BM', 'RV'][index]}</label>
        </div>
      `).join('');
    }

    await loadRecommendations();
    await loadPopularGarments();
    await loadDashboardCharts();
  } catch (error) {
    ['stat-users', 'stat-categories', 'stat-garments', 'stat-carts', 'stat-orders', 'stat-items', 'stat-address', 'stat-measures', 'stat-reviews', 'stat-revenue', 'stat-total', 'pulse-value', 'pulse-tables', 'pulse-rating'].forEach((id) => setText(id, 'ERR'));
  }
}

document.addEventListener('DOMContentLoaded', () => {
  setActiveNav();
  startClock();

  const pageKey = document.body.dataset.page;
  if (pageKey && pageKey !== 'dashboard') {
    loadCrudPage(pageKey);
    window.setInterval(() => {
      loadModuleAnalytics(pageKey).catch(() => {});
    }, 30000);
  }

  if (pageKey === 'dashboard') {
    loadDashboardPage();
    window.setInterval(() => {
      loadDashboardPage().catch(() => {});
    }, 30000);
  }
});

window.toast = toast;
window.getAll = getAll;
window.postData = postData;
window.putData = putData;
window.deleteData = deleteData;
window.getStats = getStats;
window.getHealth = getHealth;
window.getDashboard = getDashboard;
window.getMeta = getMeta;
window.getAnalyticsSummary = getAnalyticsSummary;
window.getReviewsSummary = getReviewsSummary;
window.formatPrice = formatPrice;
window.showLoading = showLoading;
window.showEmpty = showEmpty;
window.setText = setText;
window.createRecord = createRecord;
window.applySearch = applySearch;
window.loadCrudPage = loadCrudPage;
window.openEditModal = openEditModal;
window.closeEditModal = closeEditModal;
window.submitEditModal = submitEditModal;
window.removeRecord = removeRecord;
window.loadRecommendations = loadRecommendations;
window.loadPopularGarments = loadPopularGarments;
