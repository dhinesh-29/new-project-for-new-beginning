// --- GLOBALS & STATE ---
let currentUser = null;
let customersList = [];
let employeesList = [];
let inventoryList = [];
let ordersList = [];
let activeCustomerProfileId = null;
let activeJobCardOrder = null;
let activePayslipEmpId = null;

// ApexCharts Instances
let chartRevenue = null;
let chartBrands = null;
let chartServices = null;

// --- UTILITY: TOAST NOTIFICATIONS ---
function showToast(message, type = 'success') {
  const toast = document.getElementById('toast');
  const msgEl = document.getElementById('toast-message');
  msgEl.innerText = message;
  
  if (type === 'error') {
    toast.classList.remove('bg-green-600');
    toast.classList.add('bg-red-600');
  } else {
    toast.classList.remove('bg-red-600');
    toast.classList.add('bg-green-600');
  }
  
  toast.classList.remove('translate-y-24', 'opacity-0');
  toast.classList.add('translate-y-0', 'opacity-100');
  
  setTimeout(() => {
    toast.classList.remove('translate-y-0', 'opacity-100');
    toast.classList.add('translate-y-24', 'opacity-0');
  }, 3000);
}

// --- INITIALIZE ON PAGE LOAD ---
document.addEventListener('DOMContentLoaded', () => {
  // Check auth session
  checkAuthSession();
  
  // Set up event listeners for modals, forms and routes
  setupAppEventListeners();
  
  // Create icons
  lucide.createIcons();
});

// --- AUTHENTICATION ---
function checkAuthSession() {
  fetch('/api/auth/session')
    .then(res => res.json())
    .then(data => {
      if (data.authenticated) {
        currentUser = data.user;
        document.getElementById('login-overlay').classList.add('hidden');
        document.getElementById('app-container').classList.remove('hidden');
        document.getElementById('user-display-name').innerText = currentUser.name;
        document.getElementById('user-display-role').innerText = currentUser.role + ' / Owner';
        document.getElementById('user-avatar').innerText = currentUser.name.split(' ').map(n => n[0]).join('');
        
        // Initialize App views
        initAppData();
      } else {
        document.getElementById('login-overlay').classList.remove('hidden');
        document.getElementById('app-container').classList.add('hidden');
      }
    })
    .catch(err => {
      console.error("Session check error", err);
      document.getElementById('login-overlay').classList.remove('hidden');
    });
}

function initAppData() {
  // Set default view routing
  if (!window.location.hash) {
    window.location.hash = '#/dashboard';
  } else {
    renderRoute();
  }
  
  // Sync router hash change
  window.addEventListener('hashchange', renderRoute);
}

// --- APP ROUTING & DATA LOADERS ---
function renderRoute() {
  const hash = window.location.hash || '#/dashboard';
  const links = document.querySelectorAll('.sidebar-link');
  const panels = document.querySelectorAll('#view-panels > section');
  let activeView = 'dashboard';
  
  if (hash.startsWith('#/')) {
    activeView = hash.substring(2);
  }
  
  // Update link active state
  links.forEach(l => {
    if (l.getAttribute('data-view') === activeView) {
      l.classList.add('active');
    } else {
      l.classList.remove('active');
    }
  });
  
  // Update view panel visibility
  panels.forEach(p => {
    if (p.id === `view-${activeView}`) {
      p.classList.remove('hidden');
    } else {
      p.classList.add('hidden');
    }
  });
  
  // Update page header title
  const viewTitles = {
    'dashboard': 'Workshop Operations Dashboard',
    'customers': 'Customer Directory & Accounts',
    'repair-orders': 'Repair Order Workflow Board',
    'finance': 'Workshop Financial Ledger & P&L',
    'employees': 'Employee Management & Attendance',
    'hiring': 'Hiring Funnel & Opening Positions',
    'inventory': 'Spare Parts Inventory Stock',
    'reports': 'Workshop Reports Center',
    'settings': 'System Settings'
  };
  document.getElementById('view-title').innerText = viewTitles[activeView] || 'Dashboard';
  
  // Load data for active view
  loadViewData(activeView);
}

function loadViewData(view) {
  // Always fetch common lookups
  fetchEmployees();
  fetchCustomersLookup();

  if (view === 'dashboard') {
    fetchDashboardStats();
    fetchDashboardCharts();
  } else if (view === 'customers') {
    fetchCustomersList();
  } else if (view === 'repair-orders') {
    fetchRepairOrders();
  } else if (view === 'finance') {
    fetchFinanceLedger();
    fetchFinanceReports();
  } else if (view === 'employees') {
    fetchEmployeesList();
    fetchAttendanceToday();
    populatePayrollDropdown();
  } else if (view === 'hiring') {
    fetchCandidatesFunnel();
  } else if (view === 'inventory') {
    fetchInventoryList();
  } else if (view === 'reports') {
    fetchReportsSummaryPreviews();
  }
}

// --- AJAX DATALOADERS & RENDERING FUNCTIONS ---

// Fetch common customer selector items
function fetchCustomersLookup() {
  fetch('/api/customers')
    .then(res => res.json())
    .then(data => {
      customersList = data;
      const select = document.getElementById('order-customer-select');
      if (select) {
        select.innerHTML = '<option value="">-- Choose Customer --</option>' + 
          data.map(c => `<option value="${c.id}">${c.name} (${c.village})</option>`).join('');
      }
    });
}

// Fetch common mechanic selector items
function fetchEmployees() {
  fetch('/api/employees')
    .then(res => res.json())
    .then(data => {
      employeesList = data;
      const mechs = data.filter(e => e.role === 'Mechanic' || e.role === 'Welding Specialist');
      
      const orderMech = document.getElementById('order-mechanic-select');
      if (orderMech) {
        orderMech.innerHTML = '<option value="">-- Assign Mechanic --</option>' + 
          mechs.map(m => `<option value="${m.id}">${m.name} (${m.role})</option>`).join('');
      }
      
      const jcMech = document.getElementById('jc-mechanic-select');
      if (jcMech) {
        jcMech.innerHTML = '<option value="">-- Assign Mechanic --</option>' + 
          mechs.map(m => `<option value="${m.id}">${m.name} (${m.role})</option>`).join('');
      }
    });
}

// --- 1. DASHBOARD MODULE ---
function fetchDashboardStats() {
  fetch('/api/dashboard/stats')
    .then(res => res.json())
    .then(stats => {
      document.getElementById('kpi-today-orders').innerText = stats.todayOrders;
      document.getElementById('kpi-pending-deliveries').innerText = stats.pendingDeliveries;
      document.getElementById('kpi-monthly-revenue').innerText = '₹' + Number(stats.monthlyRevenue).toLocaleString('en-IN');
      document.getElementById('kpi-outstanding-payments').innerText = '₹' + Number(stats.outstandingPayments).toLocaleString('en-IN');
      document.getElementById('kpi-active-customers').innerText = stats.activeCustomers;
      document.getElementById('kpi-available-mechanics').innerText = stats.availableMechanics;
      
      const trendEl = document.getElementById('kpi-orders-trend');
      const trendIcon = document.querySelector('#kpi-orders-trend-container i');
      if (stats.orderTrend > 0) {
        trendEl.innerText = `+${stats.orderTrend} vs yesterday`;
        trendEl.className = "text-green-400 text-xs";
        trendIcon.className = "w-4 h-4 text-green-400";
        trendIcon.setAttribute('data-lucide', 'trending-up');
      } else if (stats.orderTrend < 0) {
        trendEl.innerText = `${stats.orderTrend} vs yesterday`;
        trendEl.className = "text-red-400 text-xs";
        trendIcon.className = "w-4 h-4 text-red-400";
        trendIcon.setAttribute('data-lucide', 'trending-down');
      } else {
        trendEl.innerText = "Same as yesterday";
        trendEl.className = "text-gray-400 text-xs";
        trendIcon.className = "w-4 h-4 text-gray-400";
        trendIcon.setAttribute('data-lucide', 'minus');
      }
      lucide.createIcons();
    });
}

function fetchDashboardCharts() {
  fetch('/api/dashboard/charts')
    .then(res => res.json())
    .then(charts => {
      // Line/Area Chart for monthly revenue
      const revData = charts.revenueOverview;
      const revOptions = {
        series: [{
          name: 'Revenue',
          data: revData.map(d => d.revenue)
        }],
        chart: {
          type: 'area',
          height: 250,
          background: 'transparent',
          toolbar: { show: false }
        },
        colors: ['#3F4EFF'],
        stroke: { curve: 'smooth', width: 3 },
        dataLabels: { enabled: false },
        fill: {
          type: 'gradient',
          gradient: {
            shadeIntensity: 1,
            opacityFrom: 0.45,
            opacityTo: 0.05,
            stops: [0, 100]
          }
        },
        theme: { mode: 'dark' },
        xaxis: {
          categories: revData.map(d => d.month),
          labels: { style: { colors: '#9CA3AF' } },
          axisBorder: { show: false }
        },
        yaxis: {
          labels: {
            style: { colors: '#9CA3AF' },
            formatter: (val) => '₹' + val.toLocaleString('en-IN')
          }
        },
        grid: { borderColor: '#1F2937', strokeDashArray: 4 }
      };

      if (chartRevenue) { chartRevenue.destroy(); }
      chartRevenue = new ApexCharts(document.querySelector("#chart-revenue"), revOptions);
      chartRevenue.render();

      // Donut Chart for Brands
      const brandData = charts.ordersByBrand;
      const brandOptions = {
        series: brandData.map(b => b.count),
        labels: brandData.map(b => b.brand),
        chart: {
          type: 'donut',
          height: 250,
          background: 'transparent'
        },
        colors: ['#3F4EFF', '#F59E0B', '#10B981', '#EC4899', '#8B5CF6'],
        theme: { mode: 'dark' },
        stroke: { colors: ['#0B0B0F'] },
        legend: { position: 'bottom', labels: { colors: '#9CA3AF' } },
        dataLabels: { enabled: false }
      };

      if (chartBrands) { chartBrands.destroy(); }
      chartBrands = new ApexCharts(document.querySelector("#chart-brands"), brandOptions);
      chartBrands.render();

      // Bar Chart for Service Types
      const svcData = charts.serviceTypeDistribution;
      const svcOptions = {
        series: [{
          name: 'Repairs Count',
          data: svcData.map(s => s.count)
        }],
        chart: {
          type: 'bar',
          height: 250,
          background: 'transparent',
          toolbar: { show: false }
        },
        colors: ['#3F4EFF'],
        plotOptions: {
          bar: {
            borderRadius: 6,
            columnWidth: '40%',
            distributed: false
          }
        },
        theme: { mode: 'dark' },
        dataLabels: { enabled: false },
        xaxis: {
          categories: svcData.map(s => s.type),
          labels: { style: { colors: '#9CA3AF' } }
        },
        yaxis: {
          labels: { style: { colors: '#9CA3AF' } }
        },
        grid: { borderColor: '#1F2937', strokeDashArray: 4 }
      };

      if (chartServices) { chartServices.destroy(); }
      chartServices = new ApexCharts(document.querySelector("#chart-services"), svcOptions);
      chartServices.render();
    });
}

// --- 2. CUSTOMERS MANAGEMENT MODULE ---
function fetchCustomersList() {
  fetch('/api/customers')
    .then(res => res.json())
    .then(data => {
      customersList = data;
      renderCustomersTable(data);
    });
}

function renderCustomersTable(data) {
  const tbody = document.getElementById('customers-table-body');
  
  if (data.length === 0) {
    tbody.innerHTML = `<tr><td colspan="9" class="p-8 text-center text-gray-500">No customers registered in database.</td></tr>`;
    return;
  }
  
  tbody.innerHTML = data.map(c => `
    <tr class="hover:bg-white hover:bg-opacity-5 transition cursor-pointer" onclick="viewCustomerProfile(${c.id})">
      <td class="p-4 font-mono text-xs">CUST-${String(c.id).padStart(4, '0')}</td>
      <td class="p-4 font-semibold text-gray-200">${c.name}</td>
      <td class="p-4">${c.phone}</td>
      <td class="p-4">${c.village}</td>
      <td class="p-4">
        <span class="px-2 py-0.5 rounded text-xs font-semibold ${
          c.brand === 'Mahindra' ? 'bg-red-500 bg-opacity-25 text-red-400 border border-red-500 border-opacity-20' : 
          c.brand === 'Swaraj' ? 'bg-orange-500 bg-opacity-25 text-orange-400 border border-orange-500 border-opacity-20' : 
          'bg-gray-800 text-gray-400'
        }">${c.brand}</span>
      </td>
      <td class="p-4 text-xs text-gray-400">${c.last_visit || 'N/A'}</td>
      <td class="p-4 font-semibold text-green-400">₹${c.total_spend.toLocaleString('en-IN')}</td>
      <td class="p-4 font-semibold ${c.outstanding > 0 ? 'text-red-400' : 'text-gray-400'}">₹${c.outstanding.toLocaleString('en-IN')}</td>
      <td class="p-4" onclick="event.stopPropagation()">
        <div class="flex gap-2">
          <button class="px-2 py-1 bg-white bg-opacity-5 hover:bg-opacity-10 rounded border border-gray-700 text-xs" onclick="viewCustomerProfile(${c.id})">View Profile</button>
          <button class="px-2 py-1 bg-green-500 bg-opacity-10 hover:bg-opacity-20 rounded border border-green-500 border-opacity-20 text-xs text-green-400" onclick="triggerRecordPayment(${c.id}, '${c.name}', ${c.outstanding})">Record Pay</button>
        </div>
      </td>
    </tr>
  `).join('');
}

function viewCustomerProfile(id) {
  fetch(`/api/customers/${id}`)
    .then(res => res.json())
    .then(c => {
      activeCustomerProfileId = id;
      document.getElementById('prof-name').innerText = c.name;
      document.getElementById('prof-id').innerText = `#CUST-${String(c.id).padStart(4, '0')}`;
      document.getElementById('prof-phone').innerText = c.phone;
      document.getElementById('prof-village').innerText = c.village;
      document.getElementById('prof-brand').innerText = c.brand;
      document.getElementById('prof-total-spend').innerText = '₹' + c.total_spend.toLocaleString('en-IN');
      document.getElementById('prof-outstanding').innerText = '₹' + c.outstanding.toLocaleString('en-IN');
      document.getElementById('prof-notes').innerText = c.notes || 'No notes saved.';
      
      // WhatsApp link format
      const waText = encodeURIComponent(`Hello ${c.name},\n\nThis is a friendly reminder from Tracktor Works and Repairs regarding your outstanding balance of ₹${c.outstanding}. Please proceed with payment via UPI or visit our workshop.\n\nThank you!`);
      document.getElementById('btn-prof-whatsapp').href = `https://wa.me/91${c.phone}?text=${waText}`;
      
      // Render History
      const histBody = document.getElementById('prof-history-table');
      if (c.history.length === 0) {
        histBody.innerHTML = `<tr><td colspan="6" class="p-3 text-center text-gray-500">No repair orders logged.</td></tr>`;
      } else {
        histBody.innerHTML = c.history.map(h => `
          <tr class="hover:bg-white hover:bg-opacity-5">
            <td class="p-3 font-mono">ORD-${String(h.id).padStart(4, '0')}</td>
            <td class="p-3 font-semibold">${h.model}</td>
            <td class="p-3 truncate max-w-[200px]" title="${h.complaint}">${h.complaint}</td>
            <td class="p-3">₹${h.estimated_cost}</td>
            <td class="p-3 font-semibold text-brand">${h.status}</td>
            <td class="p-3 text-gray-400">${h.created_at}</td>
          </tr>
        `).join('');
      }

      // Render Payments
      const payBody = document.getElementById('prof-payments-table');
      if (c.payments.length === 0) {
        payBody.innerHTML = `<tr><td colspan="4" class="p-3 text-center text-gray-500">No payment transactions registered.</td></tr>`;
      } else {
        payBody.innerHTML = c.payments.map(p => `
          <tr class="hover:bg-white hover:bg-opacity-5">
            <td class="p-3">${p.date}</td>
            <td class="p-3 text-green-400 font-bold">₹${p.amount}</td>
            <td class="p-3"><span class="px-1.5 py-0.5 rounded bg-gray-800 text-[10px]">${p.payment_method}</span></td>
            <td class="p-3 text-gray-400 truncate max-w-[200px]" title="${p.notes}">${p.notes}</td>
          </tr>
        `).join('');
      }
      
      document.getElementById('customer-profile-section').classList.remove('hidden');
      document.getElementById('customer-profile-section').scrollIntoView({ behavior: 'smooth' });
    });
}

function triggerRecordPayment(id, name, outstanding) {
  document.getElementById('payment-cust-id').value = id;
  document.getElementById('payment-cust-name').value = name;
  document.getElementById('payment-cust-dues').value = '₹' + outstanding;
  document.getElementById('payment-amount').value = outstanding;
  document.getElementById('modal-record-payment').classList.remove('hidden');
}


// --- 3. REPAIR ORDERS MODULE (KANBAN BOARD) ---
function fetchRepairOrders() {
  fetch('/api/repair_orders')
    .then(res => res.json())
    .then(data => {
      ordersList = data;
      renderKanbanBoard(data);
    });
}

function renderKanbanBoard(orders) {
  // Define statuses
  const statuses = [
    'Received', 'Inspection', 'Parts Required', 
    'Repair In Progress', 'Welding Work', 
    'Testing', 'Ready for Delivery', 'Delivered'
  ];
  
  // Clear columns
  const columns = {
    'Received': document.getElementById('column-received'),
    'Inspection': document.getElementById('column-inspection'),
    'Parts Required': document.getElementById('column-parts-req'),
    'Repair In Progress': document.getElementById('column-progress'),
    'Welding Work': document.getElementById('column-welding'),
    'Testing': document.getElementById('column-testing'),
    'Ready for Delivery': document.getElementById('column-ready'),
    'Delivered': document.getElementById('column-delivered')
  };
  
  Object.keys(columns).forEach(key => {
    if (columns[key]) columns[key].innerHTML = '';
  });
  
  // Group and count
  const counts = { Received:0, Inspection:0, 'Parts Required':0, 'Repair In Progress':0, 'Welding Work':0, Testing:0, 'Ready for Delivery':0, Delivered:0 };
  
  orders.forEach(o => {
    if (counts.hasOwnProperty(o.status)) counts[o.status]++;
    
    const card = document.createElement('div');
    card.className = `p-4 rounded-xl border border-gray-800 bg-white bg-opacity-5 shadow hover:border-gray-700 transition cursor-grab kanban-card flex flex-col space-y-2`;
    card.setAttribute('draggable', 'true');
    card.setAttribute('id', `order-card-${o.id}`);
    card.addEventListener('dragstart', (e) => {
      e.dataTransfer.setData('text/plain', o.id);
      card.classList.add('opacity-55');
    });
    card.addEventListener('dragend', () => {
      card.classList.remove('opacity-55');
    });
    
    card.addEventListener('click', () => {
      openJobCardModal(o.id);
    });
    
    card.innerHTML = `
      <div class="flex justify-between items-center">
        <span class="font-mono text-[10px] text-gray-500">ORD-${String(o.id).padStart(4, '0')}</span>
        <span class="px-1.5 py-0.5 rounded text-[9px] font-bold ${
          o.priority === 'High' ? 'bg-red-500 bg-opacity-20 text-red-400' :
          o.priority === 'Medium' ? 'bg-yellow-500 bg-opacity-20 text-yellow-400' :
          'bg-gray-800 text-gray-400'
        }">${o.priority}</span>
      </div>
      <div class="font-semibold text-xs text-gray-200">${o.customer_name}</div>
      <div class="text-[10px] text-brand font-bold">${o.brand} ${o.model}</div>
      <div class="text-[10px] text-gray-400 truncate">${o.complaint}</div>
      <div class="pt-2 border-t border-gray-800 flex justify-between items-center text-[10px] text-gray-500">
        <span>Mech: ${o.mechanic_name || 'Unassigned'}</span>
        <span class="font-bold text-green-400">₹${o.estimated_cost}</span>
      </div>
    `;
    
    if (columns[o.status]) {
      columns[o.status].appendChild(card);
    }
  });
  
  // Render column badges
  Object.keys(counts).forEach(status => {
    // Find badge for this status
    let columnHeader = document.querySelector(`[data-status="${status}"] .count-badge`);
    if (columnHeader) {
      columnHeader.innerText = counts[status];
    }
  });
}

// Drag & drop logic
function allowDrop(ev) {
  ev.preventDefault();
  ev.currentTarget.classList.add('drag-over');
}

document.querySelectorAll('.kanban-column').forEach(col => {
  col.addEventListener('dragleave', (e) => {
    col.classList.remove('drag-over');
  });
});

function drop(ev, targetStatus) {
  ev.preventDefault();
  ev.currentTarget.classList.remove('drag-over');
  const orderId = ev.dataTransfer.getData('text/plain');
  
  // API Call to Update Status
  fetch(`/api/repair_orders/${orderId}/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status: targetStatus })
  })
  .then(res => res.json())
  .then(data => {
    if (data.success) {
      showToast(`Order status updated to ${targetStatus}`);
      fetchRepairOrders();
    }
  });
}

function openJobCardModal(orderId) {
  fetch(`/api/repair_orders/${orderId}`)
    .then(res => res.json())
    .then(o => {
      activeJobCardOrder = o;
      document.getElementById('jc-order-id').value = o.id;
      document.getElementById('jc-work-performed').value = o.work_performed || '';
      document.getElementById('jc-parts-used').value = o.parts_used || '';
      document.getElementById('jc-actual-cost').value = o.estimated_cost;
      document.getElementById('jc-mechanic-select').value = o.mechanic_id || '';
      
      // Update Active Status styling on workflow buttons
      document.querySelectorAll('.btn-status-set').forEach(btn => {
        if (btn.getAttribute('data-val') === o.status) {
          btn.className = "px-2 py-1 text-[10px] rounded border border-brand bg-brand text-white btn-status-set";
        } else {
          btn.className = "px-2 py-1 text-[10px] rounded border border-gray-700 bg-gray-800 text-gray-300 btn-status-set";
        }
      });
      
      document.getElementById('modal-job-card').classList.remove('hidden');
    });
}

// --- 4. FINANCE MANAGEMENT MODULE ---
function fetchFinanceLedger() {
  fetch('/api/finances')
    .then(res => res.json())
    .then(data => {
      const tbody = document.getElementById('finance-ledger-body');
      if (data.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" class="p-4 text-center text-gray-500">No finance logs found.</td></tr>`;
        return;
      }
      
      tbody.innerHTML = data.map(r => `
        <tr class="hover:bg-white hover:bg-opacity-5">
          <td class="p-3 text-gray-400">${r.date}</td>
          <td class="p-3 font-semibold uppercase">
            <span class="px-2 py-0.5 rounded text-[10px] ${
              r.type === 'revenue' ? 'bg-green-500 bg-opacity-20 text-green-400' : 'bg-red-500 bg-opacity-20 text-red-400'
            }">${r.type}</span>
          </td>
          <td class="p-3 font-semibold">${r.category}</td>
          <td class="p-3 font-bold ${r.type === 'revenue' ? 'text-green-400' : 'text-red-400'}">
            ${r.type === 'revenue' ? '+' : '-'} ₹${Number(r.amount).toLocaleString('en-IN')}
          </td>
          <td class="p-3"><span class="px-1.5 py-0.5 rounded bg-gray-800 text-[10px]">${r.payment_method || 'N/A'}</span></td>
          <td class="p-3 text-gray-400 truncate max-w-[200px]" title="${r.notes}">${r.notes || '-'}</td>
        </tr>
      `).join('');
    });
}

function fetchFinanceReports() {
  fetch('/api/finances/report')
    .then(res => res.json())
    .then(rep => {
      document.getElementById('fin-net-profit').innerText = '₹' + Number(rep.netProfit).toLocaleString('en-IN');
      document.getElementById('fin-total-revenue').innerText = 'Rev: ₹' + Number(rep.totalRevenue).toLocaleString('en-IN');
      document.getElementById('fin-total-expense').innerText = 'Exp: ₹' + Number(rep.totalExpense).toLocaleString('en-IN');
      
      if (rep.netProfit >= 0) {
        document.getElementById('fin-net-profit').className = "text-2xl font-bold text-green-400";
      } else {
        document.getElementById('fin-net-profit').className = "text-2xl font-bold text-red-400";
      }

      // Render Mechanic Productivity
      const prodList = document.getElementById('mechanic-productivity-list');
      if (rep.mechanicProductivity.length === 0) {
        prodList.innerHTML = `<div class="text-xs text-gray-500 text-center">No delivered job stats available.</div>`;
      } else {
        prodList.innerHTML = rep.mechanicProductivity.map(p => `
          <div class="flex items-center justify-between p-3 rounded-lg bg-white bg-opacity-5 border border-gray-800 text-xs">
            <div>
              <div class="font-bold text-gray-200">${p.name}</div>
              <div class="text-[10px] text-gray-400">${p.orders_count} orders completed</div>
            </div>
            <div class="font-bold text-green-400">₹${Number(p.total_value).toLocaleString('en-IN')}</div>
          </div>
        `).join('');
      }
    });
}

// --- 5. EMPLOYEES MANAGEMENT MODULE ---
function fetchEmployeesList() {
  fetch('/api/employees')
    .then(res => res.json())
    .then(data => {
      employeesList = data;
      const grid = document.getElementById('employee-cards-grid');
      if (data.length === 0) {
        grid.innerHTML = `<div class="p-8 text-center text-gray-500 col-span-2">No employees registered.</div>`;
        return;
      }
      
      grid.innerHTML = data.map(e => `
        <div class="p-4 rounded-xl border border-gray-800 bg-white bg-opacity-5 flex flex-col justify-between space-y-4">
          <div class="flex justify-between items-start">
            <div>
              <h5 class="font-bold text-sm text-gray-200">${e.name}</h5>
              <span class="px-2 py-0.5 rounded bg-brand bg-opacity-20 text-[10px] font-semibold text-brand">${e.role}</span>
            </div>
            <span class="text-[10px] font-mono text-gray-500">ID-${String(e.id).padStart(3, '0')}</span>
          </div>
          
          <div class="text-xs text-gray-400 space-y-1">
            <div>Phone: <span class="text-gray-200">${e.phone}</span></div>
            <div>Exp: <span class="text-gray-200">${e.experience}</span></div>
            <div>Salary: <span class="text-green-400 font-semibold">₹${e.salary.toLocaleString('en-IN')}/mo</span></div>
          </div>

          <div class="pt-2 border-t border-gray-800 flex justify-between gap-2">
            <span class="text-[10px] text-gray-400 flex items-center gap-1">
              <span class="w-2 h-2 rounded-full ${e.status === 'Active' ? 'bg-green-500' : 'bg-red-500'}"></span>
              ${e.status}
            </span>
            <button class="px-2 py-0.5 bg-brand bg-opacity-10 hover:bg-opacity-20 border border-brand border-opacity-20 text-[10px] text-brand rounded" onclick="triggerSalaryCalc(${e.id})">Payslip</button>
          </div>
        </div>
      `).join('');
    });
}

function fetchAttendanceToday() {
  const dateVal = document.getElementById('attendance-date-selector').value || new Date().toISOString().split('T')[0];
  document.getElementById('attendance-date-selector').value = dateVal;
  
  fetch(`/api/attendance?date=${dateVal}`)
    .then(res => res.json())
    .then(data => {
      const container = document.getElementById('attendance-list-container');
      if (data.length === 0) {
        container.innerHTML = `<div class="text-xs text-gray-500 text-center">No active employees to track.</div>`;
        return;
      }
      
      container.innerHTML = data.map(a => `
        <div class="flex items-center justify-between p-2 rounded-lg bg-white bg-opacity-5 border border-gray-800 text-xs">
          <div>
            <div class="font-bold text-gray-200">${a.name}</div>
            <div class="text-[9px] text-gray-400">${a.role}</div>
          </div>
          <div class="flex items-center gap-2">
            <select class="glass-input text-[10px] p-1 h-7 border-none bg-opacity-10 bg-white" onchange="logAttendance(${a.employee_id}, '${dateVal}', this.value)">
              <option value="Present" ${a.status === 'Present' ? 'selected' : ''}>Present</option>
              <option value="Absent" ${a.status === 'Absent' ? 'selected' : ''}>Absent</option>
              <option value="Half-day" ${a.status === 'Half-day' ? 'selected' : ''}>Half-day</option>
            </select>
          </div>
        </div>
      `).join('');
    });
}

function logAttendance(empId, date, statusVal) {
  fetch('/api/attendance', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      employee_id: empId,
      date: date,
      status: statusVal
    })
  })
  .then(res => res.json())
  .then(data => {
    if (data.success) {
      showToast("Attendance updated successfully!");
      fetchAttendanceToday();
    }
  });
}

function populatePayrollDropdown() {
  const select = document.getElementById('payroll-month-selector');
  const d = new Date();
  
  // generate last 3 months
  let options = '';
  for (let i = 0; i < 3; i++) {
    const tempDate = new Date(d.getFullYear(), d.getMonth() - i, 1);
    const y = tempDate.getFullYear();
    const m = String(tempDate.getMonth() + 1).padStart(2, '0');
    const val = `${y}-${m}`;
    const name = tempDate.toLocaleString('default', { month: 'long', year: 'numeric' });
    options += `<option value="${val}">${name}</option>`;
  }
  select.innerHTML = options;
}

function triggerSalaryCalc(empId) {
  activePayslipEmpId = empId;
  const month = document.getElementById('payroll-month-selector').value;
  
  fetch(`/api/employees/${empId}/salary?month=${month}`)
    .then(res => res.json())
    .then(sal => {
      document.getElementById('salary-breakdown-details').innerHTML = `
        <div class="flex justify-between border-b border-gray-800 pb-2">
          <div>
            <h5 class="font-bold text-base text-gray-200">${sal.employeeName}</h5>
            <span class="text-xs text-gray-400">${sal.role}</span>
          </div>
          <span class="text-xs font-semibold text-brand">${sal.month}</span>
        </div>
        <div class="space-y-2 text-xs text-gray-300 pt-2">
          <div class="flex justify-between"><span>Base Salary:</span> <span class="font-semibold text-gray-100">₹${sal.baseSalary.toLocaleString('en-IN')}</span></div>
          <div class="flex justify-between"><span>Present Days:</span> <span>${sal.presents} days</span></div>
          <div class="flex justify-between"><span>Half Days:</span> <span>${sal.halfDays} days</span></div>
          <div class="flex justify-between"><span>Absent Days:</span> <span>${sal.absents} days</span></div>
          <div class="flex justify-between border-t border-gray-800 pt-2 text-red-400"><span>Missed Work Deductions:</span> <span>- ₹${sal.deductions.toLocaleString('en-IN')}</span></div>
          <div class="flex justify-between text-red-400"><span>Salary Advances Paid:</span> <span>- ₹${sal.advances.toLocaleString('en-IN')}</span></div>
          <div class="flex justify-between border-t border-gray-800 pt-2 font-bold text-green-400 text-sm"><span>Net Payout Salary:</span> <span>₹${sal.netSalary.toLocaleString('en-IN')}</span></div>
        </div>
      `;
      
      document.getElementById('modal-salary-payslip').classList.remove('hidden');
    });
}

// --- 6. HIRING MODULE ---
function fetchCandidatesFunnel() {
  fetch('/api/candidates')
    .then(res => res.json())
    .then(data => {
      const container = document.getElementById('candidate-columns-container');
      const stages = ['Applied', 'Interview Scheduled', 'Trial Work', 'Selected', 'Rejected'];
      
      let html = '';
      stages.forEach(stage => {
        const stageCands = data.filter(c => c.status === stage);
        
        html += `
          <div class="p-3 rounded-xl bg-white bg-opacity-5 border border-gray-850 space-y-3 flex flex-col min-h-[300px]">
            <div class="flex justify-between items-center border-b border-gray-850 pb-1.5">
              <span class="text-[11px] font-bold text-gray-300 uppercase">${stage}</span>
              <span class="text-[9px] px-1.5 py-0.5 rounded-full bg-gray-800 text-gray-400">${stageCands.length}</span>
            </div>
            
            <div class="space-y-2 flex-1">
              ${stageCands.map(c => `
                <div class="p-3 rounded-lg border border-gray-800 bg-white bg-opacity-[0.02] hover:border-gray-700 transition text-[11px] space-y-2">
                  <div class="font-bold text-gray-200">${c.name}</div>
                  <div class="text-[9px] text-brand font-semibold">${c.role}</div>
                  <div class="text-gray-400">${c.experience} Exp</div>
                  <div class="text-gray-400 font-semibold text-green-400">₹${c.expected_salary.toLocaleString('en-IN')}/mo</div>
                  
                  <div class="pt-1.5 border-t border-gray-850 flex gap-1.5">
                    ${stage !== 'Selected' && stage !== 'Rejected' ? `
                      <button onclick="moveCandidate(${c.id}, '${stages[stages.indexOf(stage) + 1]}')" class="flex-1 py-0.5 rounded bg-brand bg-opacity-15 hover:bg-opacity-25 border border-brand border-opacity-20 text-[9px] text-brand font-bold text-center">Advance</button>
                    ` : ''}
                    <button onclick="deleteCandidate(${c.id})" class="text-red-500 hover:text-red-400 font-bold px-1 text-[9px]">Remove</button>
                  </div>
                </div>
              `).join('')}
            </div>
          </div>
        `;
      });
      
      container.innerHTML = html;
    });
}

function moveCandidate(id, nextStage) {
  fetch(`/api/candidates/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status: nextStage })
  })
  .then(res => res.json())
  .then(data => {
    showToast(`Candidate moved to ${nextStage}`);
    fetchCandidatesFunnel();
    fetchEmployeesList(); // Refresh employee cards if selected
  });
}

function deleteCandidate(id) {
  if (confirm("Are you sure you want to remove this candidate?")) {
    fetch(`/api/candidates/${id}`, {
      method: 'DELETE'
    })
    .then(res => res.json())
    .then(data => {
      showToast("Candidate removed.");
      fetchCandidatesFunnel();
    });
  }
}

// --- 7. INVENTORY MANAGEMENT MODULE ---
function fetchInventoryList() {
  fetch('/api/inventory')
    .then(res => res.json())
    .then(data => {
      inventoryList = data;
      renderInventoryTable(data);
    });
}

function renderInventoryTable(data) {
  const tbody = document.getElementById('inventory-table-body');
  
  if (data.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8" class="p-4 text-center text-gray-500">No parts in stock inventory.</td></tr>`;
    return;
  }
  
  tbody.innerHTML = data.map(item => {
    let stockAlertBadge = '';
    if (item.quantity === 0) {
      stockAlertBadge = '<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-red-500 bg-opacity-20 text-red-400">Out of Stock</span>';
    } else if (item.quantity <= item.reorder_level) {
      stockAlertBadge = '<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-yellow-500 bg-opacity-20 text-yellow-400">Low Stock</span>';
    } else {
      stockAlertBadge = '<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-green-500 bg-opacity-20 text-green-400">Good</span>';
    }
    
    return `
      <tr class="hover:bg-white hover:bg-opacity-5">
        <td class="p-4 font-semibold text-gray-200">${item.part_name}</td>
        <td class="p-4 font-semibold text-brand">${item.brand}</td>
        <td class="p-4 font-mono font-bold">${item.quantity}</td>
        <td class="p-4 font-mono text-gray-400">${item.reorder_level}</td>
        <td class="p-4">₹${item.purchase_price}</td>
        <td class="p-4">₹${item.selling_price}</td>
        <td class="p-4">${stockAlertBadge}</td>
        <td class="p-4">
          <div class="flex gap-2">
            <button class="px-2 py-1 bg-white bg-opacity-5 hover:bg-opacity-10 border border-gray-700 rounded text-xs" onclick="adjustStock(${item.id}, ${item.quantity + 5})">+5 Stock</button>
            <button class="px-2 py-1 bg-red-500 bg-opacity-10 hover:bg-opacity-20 border border-red-500 border-opacity-20 rounded text-xs text-red-400" onclick="deleteInventory(${item.id})">Delete</button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

function adjustStock(id, newQty) {
  fetch(`/api/inventory/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ quantity: newQty })
  })
  .then(res => res.json())
  .then(data => {
    showToast("Stock updated.");
    fetchInventoryList();
  });
}

function deleteInventory(id) {
  if (confirm("Are you sure you want to delete this part item?")) {
    fetch(`/api/inventory/${id}`, {
      method: 'DELETE'
    })
    .then(res => res.json())
    .then(data => {
      showToast("Inventory item deleted.");
      fetchInventoryList();
    });
  }
}

// --- 8. REPORTS MODULE ---
function fetchReportsSummaryPreviews() {
  // Daily Summary preview
  fetch('/api/reports/daily')
    .then(res => res.json())
    .then(rep => {
      document.getElementById('report-daily-preview').innerHTML = `
        <div class="flex justify-between"><span>Date:</span> <span class="font-bold">${rep.date}</span></div>
        <div class="flex justify-between"><span>Tractors Booked:</span> <span>${rep.ordersReceived}</span></div>
        <div class="flex justify-between"><span>Jobs Completed:</span> <span>${rep.ordersCompleted}</span></div>
        <div class="flex justify-between text-green-400 font-bold"><span>Total Cash Collected:</span> <span>₹${rep.revenueCollected.toLocaleString('en-IN')}</span></div>
        <div class="flex justify-between"><span>Jobs In Workshop:</span> <span>${rep.pendingJobs} pending</span></div>
      `;
    });
    
  // Monthly Summary preview
  fetch('/api/reports/monthly')
    .then(res => res.json())
    .then(rep => {
      document.getElementById('report-monthly-preview').innerHTML = `
        <div class="flex justify-between"><span>Billing Month:</span> <span class="font-bold">${rep.month}</span></div>
        <div class="flex justify-between text-green-400 font-bold"><span>Total Gross revenue:</span> <span>₹${rep.totalRevenue.toLocaleString('en-IN')}</span></div>
        <div class="flex justify-between text-red-400"><span>Operating Expenses:</span> <span>- ₹${rep.totalExpenses.toLocaleString('en-IN')}</span></div>
        <div class="flex justify-between border-t border-gray-800 pt-1 text-green-400 font-bold"><span>Net Profit Margin:</span> <span>₹${rep.netProfit.toLocaleString('en-IN')}</span></div>
        <div class="pt-2 border-t border-gray-800 text-[10px] text-gray-400">
          <span class="block font-semibold mb-1">Top Spend Customer:</span>
          ${rep.topCustomers[0] ? `${rep.topCustomers[0].name} (₹${rep.topCustomers[0].total_spend.toLocaleString('en-IN')})` : 'None'}
        </div>
      `;
    });
}


// --- 9. JOB CARD & INVOICE PRINTING HELPERS ---
function triggerPrintJobCard() {
  const o = activeJobCardOrder;
  if (!o) return;
  
  const printContainer = document.getElementById('print-view-container');
  printContainer.innerHTML = `
    <div class="printable-card">
      <div class="text-center pb-4 border-b-2 border-black">
        <h1 class="text-xl font-bold uppercase">Tracktor Works and Repairs</h1>
        <p class="text-xs">Mahindra Specialists & Agricultural Welding Repairs</p>
        <p class="text-[10px]">Workshop Road, Kalyanpur • Phone: 9876543216</p>
      </div>

      <div class="my-4 text-xs grid grid-cols-2 gap-4">
        <div>
          <strong>Job Card No:</strong> JC-ORD-${String(o.id).padStart(4, '0')}<br>
          <strong>Tractor Brand:</strong> ${o.brand}<br>
          <strong>Model:</strong> ${o.model}<br>
          <strong>Reg Number:</strong> ${o.registration}
        </div>
        <div class="text-right">
          <strong>Date Received:</strong> ${o.created_at}<br>
          <strong>Customer Name:</strong> ${o.customer_name}<br>
          <strong>Mobile:</strong> ${o.customer_phone}<br>
          <strong>Assigned Mechanic:</strong> ${o.mechanic_name || 'Unassigned'}
        </div>
      </div>

      <div class="border-t border-black pt-2 text-xs">
        <h3 class="font-bold uppercase mb-1">Customer Complaint / Demands</h3>
        <p class="p-2 border border-black">${o.complaint}</p>
      </div>

      <div class="mt-4 border-t border-black pt-2 text-xs">
        <h3 class="font-bold uppercase mb-1">Mechanical Work Done & Welding Repairs</h3>
        <p class="p-2 border border-black min-h-[60px]">${o.work_performed || 'Inspection pending / diagnostics under progress.'}</p>
      </div>

      <div class="mt-4 border-t border-black pt-2 text-xs">
        <h3 class="font-bold uppercase mb-1">Spare Parts Installed</h3>
        <p class="p-2 border border-black min-h-[30px]">${o.parts_used || 'None.'}</p>
      </div>

      <div class="mt-8 pt-8 grid grid-cols-2 gap-8 text-xs">
        <div class="border-t border-black text-center pt-2">Mechanic Signature</div>
        <div class="border-t border-black text-center pt-2">Customer Acceptance Signature</div>
      </div>
    </div>
  `;
  
  window.print();
}

function triggerPrintInvoice() {
  const o = activeJobCardOrder;
  if (!o) return;
  
  const printContainer = document.getElementById('print-view-container');
  printContainer.innerHTML = `
    <div class="printable-card">
      <div class="text-center pb-4 border-b-2 border-black">
        <h1 class="text-xl font-bold uppercase">Tracktor Works and Repairs</h1>
        <p class="text-xs">Mahindra Specialists & Agricultural Welding Repairs</p>
        <p class="text-[10px]">Workshop Road, Kalyanpur • Phone: 9876543216</p>
      </div>

      <h2 class="text-center text-sm font-bold uppercase my-3 decoration-clone">Tax Invoice / Bill Receipt</h2>

      <div class="my-4 text-xs grid grid-cols-2 gap-4">
        <div>
          <strong>Invoice No:</strong> INVC-${String(o.id).padStart(4, '0')}<br>
          <strong>Tractor model:</strong> ${o.brand} ${o.model}<br>
          <strong>Reg Number:</strong> ${o.registration}
        </div>
        <div class="text-right">
          <strong>Invoice Date:</strong> ${new Date().toISOString().split('T')[0]}<br>
          <strong>Customer Name:</strong> ${o.customer_name}<br>
          <strong>Village:</strong> ${o.customer_village || 'N/A'}<br>
          <strong>Contact:</strong> ${o.customer_phone}
        </div>
      </div>

      <table>
        <thead>
          <tr>
            <th>Description of Services & Parts</th>
            <th class="text-right">Charges / Cost (₹)</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>
              <strong>Mechanical Labour Service:</strong><br>
              ${o.complaint}
            </td>
            <td class="text-right font-bold">₹${o.estimated_cost.toLocaleString('en-IN')}</td>
          </tr>
          ${o.parts_used ? `
            <tr>
              <td>
                <strong>Parts installed:</strong><br>
                ${o.parts_used}
              </td>
              <td class="text-right text-gray-500">Included in service package</td>
            </tr>
          ` : ''}
          <tr class="font-bold border-t-2 border-black">
            <td class="text-right pt-2">Grand Total Sum:</td>
            <td class="text-right pt-2 font-bold text-lg">₹${o.estimated_cost.toLocaleString('en-IN')}</td>
          </tr>
        </tbody>
      </table>

      <div class="mt-8 pt-8 flex justify-between text-[10px]">
        <div>
          <strong>Payment Terms:</strong><br>
          UPI / Cash paid on tractor delivery.<br>
          * Mahindra engines are guaranteed for 6 months workshop warranty.
        </div>
        <div class="text-right pt-4">
          <strong>Authorized Signatory:</strong><br><br><br>
          Tracktor Works & Repairs
        </div>
      </div>
    </div>
  `;
  
  window.print();
}

function triggerPrintPayslip() {
  if (!activePayslipEmpId) return;
  const month = document.getElementById('payroll-month-selector').value;
  
  fetch(`/api/employees/${activePayslipEmpId}/salary?month=${month}`)
    .then(res => res.json())
    .then(sal => {
      const printContainer = document.getElementById('print-view-container');
      printContainer.innerHTML = `
        <div class="printable-card">
          <div class="text-center pb-4 border-b-2 border-black">
            <h1 class="text-xl font-bold uppercase">Tracktor Works and Repairs</h1>
            <p class="text-xs">Employee Payslip Summary Receipt</p>
            <p class="text-[10px]">Month: ${sal.month}</p>
          </div>

          <div class="my-4 text-xs grid grid-cols-2 gap-4">
            <div>
              <strong>Employee Name:</strong> ${sal.employeeName}<br>
              <strong>Job Role:</strong> ${sal.role}<br>
              <strong>Status:</strong> Active Duty
            </div>
            <div class="text-right">
              <strong>Base Pay Grade:</strong> ₹${sal.baseSalary.toLocaleString('en-IN')}/mo<br>
              <strong>Payslip Date:</strong> ${new Date().toISOString().split('T')[0]}
            </div>
          </div>

          <table>
            <thead>
              <tr>
                <th>Salary Ledger Item</th>
                <th class="text-right">Total Amount (₹)</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Monthly Base Salary Pay</td>
                <td class="text-right font-bold text-green-700">+ ₹${sal.baseSalary.toLocaleString('en-IN')}</td>
              </tr>
              <tr>
                <td>Deductions (Absences: ${sal.absents} days, Half Days: ${sal.halfDays} days)</td>
                <td class="text-right text-red-700">- ₹${sal.deductions.toLocaleString('en-IN')}</td>
              </tr>
              <tr>
                <td>Salary Advances Collected</td>
                <td class="text-right text-red-700">- ₹${sal.advances.toLocaleString('en-IN')}</td>
              </tr>
              <tr class="font-bold border-t-2 border-black bg-gray-100">
                <td class="text-right pt-2 text-sm">Net Payable Salary Payout:</td>
                <td class="text-right pt-2 text-lg text-green-700 font-bold">₹${sal.netSalary.toLocaleString('en-IN')}</td>
              </tr>
            </tbody>
          </table>

          <div class="mt-8 pt-8 grid grid-cols-2 gap-8 text-xs">
            <div class="border-t border-black text-center pt-2">Authorized Signatory Signature</div>
            <div class="border-t border-black text-center pt-2">Employee Recipient Signature</div>
          </div>
        </div>
      `;
      
      window.print();
    });
}


// --- 10. EXPORT DATA FILE (CSV) ---
function exportCustomersToCSV() {
  if (customersList.length === 0) {
    showToast("No customers list to export.", "error");
    return;
  }
  
  let csvContent = "data:text/csv;charset=utf-8,";
  csvContent += "Customer ID,Name,Mobile,Village,Tractor Brand,Last Visit,Total Spend,Outstanding\n";
  
  customersList.forEach(c => {
    const row = [
      c.id,
      `"${c.name}"`,
      c.phone,
      `"${c.village}"`,
      c.brand,
      c.last_visit || '',
      c.total_spend,
      c.outstanding
    ].join(",");
    csvContent += row + "\n";
  });
  
  const encodedUri = encodeURI(csvContent);
  const link = document.createElement("a");
  link.setAttribute("href", encodedUri);
  link.setAttribute("download", `tracktor_customers_export_${new Date().toISOString().split('T')[0]}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  showToast("CSV file downloaded successfully!");
}


// --- 11. EVENT LISTENERS AND FORM SUBMISSIONS ---
function setupAppEventListeners() {
  
  // Login Form submit
  document.getElementById('login-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const u = document.getElementById('login-username').value;
    const p = document.getElementById('login-password').value;
    
    fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: u, password: p })
    })
    .then(res => {
      if (res.status === 200) return res.json();
      throw new Error();
    })
    .then(data => {
      showToast("Logged in successfully!");
      checkAuthSession();
    })
    .catch(() => {
      document.getElementById('login-error').classList.remove('hidden');
    });
  });

  // Logout button click
  document.getElementById('logout-btn').addEventListener('click', () => {
    fetch('/api/auth/logout')
      .then(() => {
        showToast("Logged out successfully.");
        checkAuthSession();
      });
  });

  // Collapsible Operational Guidelines panel toggle
  document.getElementById('toggle-guidelines').addEventListener('click', () => {
    const content = document.getElementById('guidelines-content');
    const label = document.querySelector('#toggle-guidelines span');
    const icon = document.querySelector('#toggle-guidelines i');
    
    if (content.classList.contains('hidden')) {
      content.classList.remove('hidden');
      label.innerText = 'Collapse';
      icon.setAttribute('data-lucide', 'chevron-up');
    } else {
      content.classList.add('hidden');
      label.innerText = 'Expand';
      icon.setAttribute('data-lucide', 'chevron-down');
    }
    lucide.createIcons();
  });

  // General closeModal button hooks
  document.querySelectorAll('.close-modal').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.fixed.inset-0.z-50').forEach(modal => {
        if (modal.id !== 'login-overlay') modal.classList.add('hidden');
      });
    });
  });

  // Search input filters for top search
  document.getElementById('top-search').addEventListener('input', (e) => {
    const q = e.target.value.toLowerCase();
    
    // If active view is customers, filter table
    const hash = window.location.hash || '#/dashboard';
    if (hash === '#/customers') {
      const filtered = customersList.filter(c => 
        c.name.toLowerCase().includes(q) || 
        c.phone.includes(q) || 
        c.village.toLowerCase().includes(q)
      );
      renderCustomersTable(filtered);
    } else if (hash === '#/repair-orders') {
      // filter kanban cards locally
      document.querySelectorAll('.kanban-card').forEach(card => {
        const text = card.innerText.toLowerCase();
        if (text.includes(q)) {
          card.classList.remove('hidden');
        } else {
          card.classList.add('hidden');
        }
      });
    }
  });

  // Customers: Specific page search/filter listeners
  const filterCust = () => {
    const q = document.getElementById('cust-search').value.toLowerCase();
    const brand = document.getElementById('cust-filter-brand').value;
    const village = document.getElementById('cust-filter-village').value.toLowerCase();
    
    const filtered = customersList.filter(c => {
      const matchQ = c.name.toLowerCase().includes(q) || c.phone.includes(q) || c.village.toLowerCase().includes(q);
      const matchBrand = brand === "" ? true : c.brand === brand;
      const matchVillage = village === "" ? true : c.village.toLowerCase().includes(village);
      return matchQ && matchBrand && matchVillage;
    });
    renderCustomersTable(filtered);
  };
  
  document.getElementById('cust-search').addEventListener('input', filterCust);
  document.getElementById('cust-filter-brand').addEventListener('change', filterCust);
  document.getElementById('cust-filter-village').addEventListener('input', filterCust);
  document.getElementById('btn-export-customers').addEventListener('click', exportCustomersToCSV);

  // Trigger Add Customer Modal
  document.getElementById('btn-add-customer-modal').addEventListener('click', () => {
    document.getElementById('modal-add-customer').classList.remove('hidden');
  });

  // Form submit Add Customer
  document.getElementById('form-add-customer').addEventListener('submit', (e) => {
    e.preventDefault();
    fetch('/api/customers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: document.getElementById('cust-name-input').value,
        phone: document.getElementById('cust-phone-input').value,
        village: document.getElementById('cust-village-input').value,
        brand: document.getElementById('cust-brand-input').value,
        notes: document.getElementById('cust-notes-input').value
      })
    })
    .then(res => res.json())
    .then(data => {
      showToast("Customer registered successfully!");
      document.getElementById('modal-add-customer').classList.add('hidden');
      document.getElementById('form-add-customer').reset();
      fetchCustomersList();
    });
  });

  // Trigger Add Repair Order Modal
  document.getElementById('btn-add-order-modal').addEventListener('click', () => {
    document.getElementById('modal-add-order').classList.remove('hidden');
  });
  
  document.getElementById('btn-prof-add-order').addEventListener('click', () => {
    document.getElementById('order-customer-select').value = activeCustomerProfileId;
    document.getElementById('modal-add-order').classList.remove('hidden');
  });

  // Form submit Add Repair Order
  document.getElementById('form-add-order').addEventListener('submit', (e) => {
    e.preventDefault();
    fetch('/api/repair_orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customer_id: document.getElementById('order-customer-select').value,
        model: document.getElementById('order-model-input').value,
        brand: document.getElementById('order-brand-select').value,
        registration: document.getElementById('order-reg-input').value,
        priority: document.getElementById('order-priority-select').value,
        complaint: document.getElementById('order-complaint-input').value,
        estimated_cost: document.getElementById('order-cost-input').value,
        mechanic_id: document.getElementById('order-mechanic-select').value || null,
        delivery_date: document.getElementById('order-delivery-input').value
      })
    })
    .then(res => res.json())
    .then(data => {
      showToast("Repair order booked successfully!");
      document.getElementById('modal-add-order').classList.add('hidden');
      document.getElementById('form-add-order').reset();
      fetchRepairOrders();
      if (activeCustomerProfileId) viewCustomerProfile(activeCustomerProfileId);
    });
  });

  // Close Customer Profile details block
  document.getElementById('btn-close-profile').addEventListener('click', () => {
    document.getElementById('customer-profile-section').classList.add('hidden');
  });

  // Record payment from Customer Profile view trigger
  document.getElementById('btn-prof-record-payment').addEventListener('click', () => {
    const cardName = document.getElementById('prof-name').innerText;
    const balance = parseFloat(document.getElementById('prof-outstanding').innerText.replace(/[^\d.]/g, ''));
    triggerRecordPayment(activeCustomerProfileId, cardName, balance);
  });

  // Form submit Record Payment
  document.getElementById('form-record-payment').addEventListener('submit', (e) => {
    e.preventDefault();
    const id = document.getElementById('payment-cust-id').value;
    fetch(`/api/customers/${id}/payment`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        amount: document.getElementById('payment-amount').value,
        payment_method: document.getElementById('payment-method-select').value,
        notes: document.getElementById('payment-notes').value
      })
    })
    .then(res => res.json())
    .then(data => {
      showToast("Payment transaction recorded!");
      document.getElementById('modal-record-payment').classList.add('hidden');
      document.getElementById('form-record-payment').reset();
      
      // Update UI panels
      fetchCustomersList();
      if (activeCustomerProfileId === Number(id)) {
        viewCustomerProfile(id);
      }
    });
  });

  // Save Job Card status updates click handlers
  document.querySelectorAll('.btn-status-set').forEach(btn => {
    btn.addEventListener('click', () => {
      const val = btn.getAttribute('data-val');
      const orderId = document.getElementById('jc-order-id').value;
      
      fetch(`/api/repair_orders/${orderId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: val })
      })
      .then(res => res.json())
      .then(() => {
        showToast(`Workflow status set to ${val}`);
        openJobCardModal(orderId);
        fetchRepairOrders();
      });
    });
  });

  // Form submit Update Job Card work details
  document.getElementById('form-update-job-details').addEventListener('submit', (e) => {
    e.preventDefault();
    const orderId = document.getElementById('jc-order-id').value;
    fetch(`/api/repair_orders/${orderId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        work_performed: document.getElementById('jc-work-performed').value,
        parts_used: document.getElementById('jc-parts-used').value,
        estimated_cost: document.getElementById('jc-actual-cost').value,
        mechanic_id: document.getElementById('jc-mechanic-select').value || null
      })
    })
    .then(res => res.json())
    .then(() => {
      showToast("Job card progress saved!");
      document.getElementById('modal-job-card').classList.add('hidden');
      fetchRepairOrders();
    });
  });

  // Print buttons inside Job Card Modal
  document.getElementById('btn-print-job-card').addEventListener('click', triggerPrintJobCard);
  document.getElementById('btn-print-invoice').addEventListener('click', triggerPrintInvoice);

  // Form submit Log Finance Ledger Transaction
  document.getElementById('finance-log-form').addEventListener('submit', (e) => {
    e.preventDefault();
    fetch('/api/finances', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: document.getElementById('fin-log-type').value,
        amount: document.getElementById('fin-log-amount').value,
        category: document.getElementById('fin-log-category').value,
        payment_method: document.getElementById('fin-log-method').value,
        notes: "Manual ledger entry"
      })
    })
    .then(res => res.json())
    .then(() => {
      showToast("Transaction registered successfully!");
      document.getElementById('finance-log-form').reset();
      fetchFinanceLedger();
      fetchFinanceReports();
    });
  });

  // Trigger Add Employee Modal
  document.getElementById('btn-add-employee-modal').addEventListener('click', () => {
    document.getElementById('modal-add-employee').classList.remove('hidden');
  });

  // Form submit Add Employee
  document.getElementById('form-add-employee').addEventListener('submit', (e) => {
    e.preventDefault();
    fetch('/api/employees', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: document.getElementById('emp-name').value,
        role: document.getElementById('emp-role').value,
        phone: document.getElementById('emp-phone').value,
        experience: document.getElementById('emp-exp').value,
        salary: document.getElementById('emp-salary').value
      })
    })
    .then(res => res.json())
    .then(() => {
      showToast("Workshop employee added!");
      document.getElementById('modal-add-employee').classList.add('hidden');
      document.getElementById('form-add-employee').reset();
      fetchEmployeesList();
      fetchAttendanceToday();
    });
  });

  // Attendance Date Change listener
  document.getElementById('attendance-date-selector').addEventListener('change', fetchAttendanceToday);

  // Compute Salary action button click
  document.getElementById('btn-calculate-payroll').addEventListener('click', () => {
    const listContainer = document.getElementById('payroll-results-container');
    const month = document.getElementById('payroll-month-selector').value;
    
    // Loop employees and display list
    let html = '';
    employeesList.forEach(e => {
      html += `
        <div class="flex items-center justify-between p-2 rounded bg-white bg-opacity-5 hover:bg-opacity-10 transition">
          <div>
            <span class="font-bold text-gray-200">${e.name}</span>
            <span class="text-[10px] text-gray-400 block">${e.role}</span>
          </div>
          <button onclick="triggerSalaryCalc(${e.id})" class="px-2 py-0.5 rounded bg-brand bg-opacity-25 text-brand font-semibold text-[10px]">Compute & Print Payslip</button>
        </div>
      `;
    });
    listContainer.innerHTML = html;
  });

  // Record Salary Payout inside Payslip Modal
  document.getElementById('btn-payout-salary').addEventListener('click', () => {
    const month = document.getElementById('payroll-month-selector').value;
    
    fetch(`/api/employees/${activePayslipEmpId}/salary?month=${month}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    })
    .then(res => res.json())
    .then(() => {
      showToast("Salary payout recorded as expense.");
      document.getElementById('modal-salary-payslip').classList.add('hidden');
      fetchFinanceLedger();
      fetchFinanceReports();
    });
  });

  document.getElementById('btn-print-payslip').addEventListener('click', triggerPrintPayslip);

  // Trigger Add Candidate Modal
  document.getElementById('btn-add-candidate-modal').addEventListener('click', () => {
    document.getElementById('modal-add-candidate').classList.remove('hidden');
  });

  // Form submit Add Candidate
  document.getElementById('form-add-candidate').addEventListener('submit', (e) => {
    e.preventDefault();
    fetch('/api/candidates', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: document.getElementById('cand-name').value,
        role: document.getElementById('cand-role').value,
        phone: document.getElementById('cand-phone').value,
        experience: document.getElementById('cand-exp').value,
        expected_salary: document.getElementById('cand-salary').value,
        notes: document.getElementById('cand-notes').value
      })
    })
    .then(res => res.json())
    .then(() => {
      showToast("Candidate applied!");
      document.getElementById('modal-add-candidate').classList.add('hidden');
      document.getElementById('form-add-candidate').reset();
      fetchCandidatesFunnel();
    });
  });

  // Trigger Add Inventory Modal
  document.getElementById('btn-add-inventory-modal').addEventListener('click', () => {
    document.getElementById('modal-add-inventory').classList.remove('hidden');
  });

  // Form submit Add Inventory
  document.getElementById('form-add-inventory').addEventListener('submit', (e) => {
    e.preventDefault();
    fetch('/api/inventory', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        part_name: document.getElementById('inv-part-name').value,
        brand: document.getElementById('inv-brand').value,
        quantity: document.getElementById('inv-quantity').value,
        reorder_level: document.getElementById('inv-reorder').value,
        purchase_price: document.getElementById('inv-purchase').value,
        selling_price: document.getElementById('inv-selling').value
      })
    })
    .then(res => res.json())
    .then(() => {
      showToast("Inventory item added!");
      document.getElementById('modal-add-inventory').classList.add('hidden');
      document.getElementById('form-add-inventory').reset();
      fetchInventoryList();
    });
  });

  // Download PDF Daily Report summary trigger
  document.getElementById('btn-download-daily-report').addEventListener('click', () => {
    fetch('/api/reports/daily')
      .then(res => res.json())
      .then(rep => {
        const printContainer = document.getElementById('print-view-container');
        printContainer.innerHTML = `
          <div class="printable-card">
            <div class="text-center pb-4 border-b-2 border-black">
              <h1 class="text-xl font-bold uppercase">Tracktor Works and Repairs</h1>
              <p class="text-xs">Daily Workshop Operations Summary Report</p>
              <p class="text-[10px]">Date: ${rep.date}</p>
            </div>

            <div class="my-6 text-xs space-y-4">
              <div class="flex justify-between border-b pb-1"><span>Total Tractor Repair Bookings:</span> <strong>${rep.ordersReceived} orders</strong></div>
              <div class="flex justify-between border-b pb-1"><span>Tractors Cleared & Delivered:</span> <strong>${rep.ordersCompleted} orders</strong></div>
              <div class="flex justify-between border-b pb-1 text-green-700"><span>Daily Revenue Collected:</span> <strong>₹${rep.revenueCollected.toLocaleString('en-IN')}</strong></div>
              <div class="flex justify-between border-b pb-1"><span>Total Active Jobs Remaining:</span> <strong>${rep.pendingJobs} tractors in shop</strong></div>
            </div>

            <div class="mt-12 text-[10px] text-gray-500 text-center">
              Generated by Tracktor Operations Management System • End of Day Report
            </div>
          </div>
        `;
        window.print();
      });
  });

  // Download Monthly Business Report summary trigger
  document.getElementById('btn-download-monthly-report').addEventListener('click', () => {
    fetch('/api/reports/monthly')
      .then(res => res.json())
      .then(rep => {
        const printContainer = document.getElementById('print-view-container');
        printContainer.innerHTML = `
          <div class="printable-card">
            <div class="text-center pb-4 border-b-2 border-black">
              <h1 class="text-xl font-bold uppercase">Tracktor Works and Repairs</h1>
              <p class="text-xs">Monthly Business Performance Report</p>
              <p class="text-[10px]">Billing Cycle Month: ${rep.month}</p>
            </div>

            <div class="my-6 text-xs space-y-4">
              <div class="flex justify-between border-b pb-1 text-green-700"><span>Total Gross Billing Revenue:</span> <strong>₹${rep.totalRevenue.toLocaleString('en-IN')}</strong></div>
              <div class="flex justify-between border-b pb-1 text-red-700"><span>Total Workshop Expenses:</span> <strong>- ₹${rep.totalExpenses.toLocaleString('en-IN')}</strong></div>
              <div class="flex justify-between border-b-2 border-black pb-1 font-bold text-green-800 text-sm"><span>Net Workshop Profit:</span> <strong>₹${rep.netProfit.toLocaleString('en-IN')}</strong></div>
            </div>

            <div class="my-4 text-xs">
              <h3 class="font-bold uppercase mb-1">Top Spending Customer Accounts</h3>
              <table>
                <thead>
                  <tr>
                    <th>Customer Name</th>
                    <th>Mobile</th>
                    <th>Total Spend</th>
                    <th>Outstanding Dues</th>
                  </tr>
                </thead>
                <tbody>
                  ${rep.topCustomers.map(c => `
                    <tr>
                      <td>${c.name}</td>
                      <td>${c.phone}</td>
                      <td>₹${c.total_spend.toLocaleString('en-IN')}</td>
                      <td>₹${c.outstanding.toLocaleString('en-IN')}</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>

            <div class="my-4 text-xs">
              <h3 class="font-bold uppercase mb-1">Top Repairs Booked</h3>
              <table>
                <thead>
                  <tr>
                    <th>Complaint / Repair Service</th>
                    <th>Occurrences</th>
                  </tr>
                </thead>
                <tbody>
                  ${rep.commonRepairs.map(r => `
                    <tr>
                      <td>${r.complaint}</td>
                      <td>${r.count} times</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
            
            <div class="mt-12 text-[10px] text-gray-500 text-center">
              Generated by Tracktor Operations Management System • Monthly Summary Report
            </div>
          </div>
        `;
        window.print();
      });
  });
}
