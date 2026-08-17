from flask import Flask, request, jsonify, session, send_from_directory
import os
import sqlite3
import datetime
from database import DB_PATH, get_db_connection

app = Flask(__name__, static_folder='static', static_url_path='')
app.secret_key = 'tracktor-secret-key-998877'

# Helper to convert sqlite3.Row to dict
def dict_from_row(row):
    return dict(row) if row else None

# Helper to check if logged in
def is_logged_in():
    return 'user_id' in session

@app.before_request
def require_login():
    # Allow login, static files, and favicon without authentication
    if request.path.startswith('/api/auth/login') or request.path.startswith('/api/auth/session') or not request.path.startswith('/api/'):
        return
    if not is_logged_in():
        return jsonify({'error': 'Unauthorized', 'message': 'Please log in first.'}), 401

@app.route('/')
def index():
    return send_from_directory('static', 'index.html')

# --- AUTH API ---
@app.route('/api/auth/login', methods=['POST'])
def login():
    data = request.json or {}
    username = data.get('username')
    password = data.get('password')
    
    if not username or not password:
        return jsonify({'error': 'Bad Request', 'message': 'Username and password required'}), 400
        
    conn = get_db_connection()
    user = conn.execute('SELECT * FROM users WHERE username = ? AND password = ?', (username, password)).fetchone()
    conn.close()
    
    if user:
        session['user_id'] = user['id']
        session['username'] = user['username']
        session['name'] = user['name']
        session['role'] = user['role']
        return jsonify({
            'success': True,
            'user': {
                'id': user['id'],
                'username': user['username'],
                'name': user['name'],
                'role': user['role']
            }
        })
    return jsonify({'error': 'Unauthorized', 'message': 'Invalid username or password'}), 401

@app.route('/api/auth/logout', methods=['POST', 'GET'])
def logout():
    session.clear()
    return jsonify({'success': True, 'message': 'Logged out successfully'})

@app.route('/api/auth/session', methods=['GET'])
def get_session():
    if is_logged_in():
        return jsonify({
            'authenticated': True,
            'user': {
                'id': session.get('user_id'),
                'username': session.get('username'),
                'name': session.get('name'),
                'role': session.get('role')
            }
        })
    return jsonify({'authenticated': False})


# --- DASHBOARD STATS & CHARTS API ---
@app.route('/api/dashboard/stats', methods=['GET'])
def get_dashboard_stats():
    conn = get_db_connection()
    today_str = datetime.date.today().strftime("%Y-%m-%d")
    yesterday_str = (datetime.date.today() - datetime.timedelta(days=1)).strftime("%Y-%m-%d")
    current_month_str = datetime.date.today().strftime("%Y-%m")
    
    # 1. Today's Repair Orders & Trend
    today_orders = conn.execute("SELECT COUNT(*) FROM repair_orders WHERE created_at = ?", (today_str,)).fetchone()[0]
    yesterday_orders = conn.execute("SELECT COUNT(*) FROM repair_orders WHERE created_at = ?", (yesterday_str,)).fetchone()[0]
    order_trend = today_orders - yesterday_orders

    # 2. Pending Deliveries
    pending_deliveries = conn.execute("SELECT COUNT(*) FROM repair_orders WHERE status != 'Delivered'").fetchone()[0]

    # 3. Monthly Revenue
    monthly_rev = conn.execute("SELECT SUM(amount) FROM finances WHERE type = 'revenue' AND date LIKE ? AND category != 'Outstanding Dues'", (f"{current_month_str}%",)).fetchone()[0] or 0.0
    
    # 4. Outstanding Payments
    outstanding_payments = conn.execute("SELECT SUM(outstanding) FROM customers").fetchone()[0] or 0.0

    # 5. Active Customers
    active_customers = conn.execute("SELECT COUNT(*) FROM customers").fetchone()[0]

    # 6. Available Mechanics (Present today)
    avail_mechanics = conn.execute("""
        SELECT COUNT(DISTINCT e.id) FROM employees e
        LEFT JOIN attendance a ON e.id = a.employee_id AND a.date = ?
        WHERE e.role IN ('Mechanic', 'Welding Specialist') 
        AND e.status = 'Active' 
        AND (a.status IS NULL OR a.status IN ('Present', 'Half-day'))
    """, (today_str,)).fetchone()[0]

    total_mechanics = conn.execute("SELECT COUNT(*) FROM employees WHERE role IN ('Mechanic', 'Welding Specialist') AND status='Active'").fetchone()[0]

    conn.close()

    return jsonify({
        'todayOrders': today_orders,
        'orderTrend': order_trend,
        'pendingDeliveries': pending_deliveries,
        'monthlyRevenue': monthly_rev,
        'outstandingPayments': outstanding_payments,
        'activeCustomers': active_customers,
        'availableMechanics': f"{avail_mechanics} / {total_mechanics}"
    })

@app.route('/api/dashboard/charts', methods=['GET'])
def get_dashboard_charts():
    conn = get_db_connection()
    
    # 1. Revenue Overview (by Month)
    revenue_rows = conn.execute("""
        SELECT substr(date, 1, 7) as month, SUM(amount) as total
        FROM finances
        WHERE type = 'revenue'
        GROUP BY month
        ORDER BY month ASC
        LIMIT 6
    """).fetchall()
    
    # Convert 'YYYY-MM' to name e.g., 'Jan'
    months_map = {'01':'Jan', '02':'Feb', '03':'Mar', '04':'Apr', '05':'May', '06':'Jun', '07':'Jul', '08':'Aug', '09':'Sep', '10':'Oct', '11':'Nov', '12':'Dec'}
    revenue_chart = []
    for r in revenue_rows:
        m_parts = r['month'].split('-')
        month_name = f"{months_map.get(m_parts[1], m_parts[1])} {m_parts[0][2:]}"
        revenue_chart.append({'month': month_name, 'revenue': r['total']})

    # 2. Orders by Brand
    brand_rows = conn.execute("""
        SELECT brand, COUNT(*) as count
        FROM repair_orders
        GROUP BY brand
    """).fetchall()
    brand_chart = [dict_from_row(b) for b in brand_rows]

    # 3. Service Type Distribution
    # Categorize by scanning keywords in complaints
    orders = conn.execute("SELECT complaint FROM repair_orders").fetchall()
    service_types = {
        'Engine': 0,
        'Transmission': 0,
        'Electrical': 0,
        'Welding': 0,
        'General service': 0
    }
    for o in orders:
        complaint = o['complaint'].lower()
        if 'engine' in complaint or 'overheating' in complaint or 'pump' in complaint or 'gasket' in complaint:
            service_types['Engine'] += 1
        elif 'clutch' in complaint or 'gear' in complaint or 'transmission' in complaint or 'differential' in complaint or 'axle' in complaint:
            service_types['Transmission'] += 1
        elif 'electrical' in complaint or 'battery' in complaint or 'light' in complaint or 'starter' in complaint:
            service_types['Electrical'] += 1
        elif 'welding' in complaint or 'weld' in complaint or 'blade' in complaint or 'bumper' in complaint:
            service_types['Welding'] += 1
        else:
            service_types['General service'] += 1

    service_chart = [{'type': k, 'count': v} for k, v in service_types.items()]
    conn.close()

    return jsonify({
        'revenueOverview': revenue_chart,
        'ordersByBrand': brand_chart,
        'serviceTypeDistribution': service_chart
    })


# --- CUSTOMER MANAGEMENT API ---
@app.route('/api/customers', methods=['GET', 'POST'])
def handle_customers():
    conn = get_db_connection()
    if request.method == 'GET':
        rows = conn.execute('SELECT * FROM customers ORDER BY name ASC').fetchall()
        customers = [dict_from_row(r) for r in rows]
        conn.close()
        return jsonify(customers)
    
    elif request.method == 'POST':
        data = request.json or {}
        name = data.get('name')
        phone = data.get('phone')
        village = data.get('village')
        brand = data.get('brand')
        notes = data.get('notes', '')
        
        if not name or not phone or not village or not brand:
            return jsonify({'error': 'Bad Request', 'message': 'Missing required fields'}), 400
            
        cursor = conn.cursor()
        cursor.execute('''
            INSERT INTO customers (name, phone, village, brand, last_visit, total_spend, outstanding, notes)
            VALUES (?, ?, ?, ?, ?, 0.0, 0.0, ?)
        ''', (name, phone, village, brand, datetime.date.today().strftime("%Y-%m-%d"), notes))
        new_id = cursor.lastrowid
        conn.commit()
        cust = conn.execute('SELECT * FROM customers WHERE id = ?', (new_id,)).fetchone()
        conn.close()
        return jsonify(dict_from_row(cust)), 201

@app.route('/api/customers/<int:cust_id>', methods=['GET', 'PUT', 'DELETE'])
def handle_single_customer(cust_id):
    conn = get_db_connection()
    customer = conn.execute('SELECT * FROM customers WHERE id = ?', (cust_id,)).fetchone()
    if not customer:
        conn.close()
        return jsonify({'error': 'Not Found', 'message': 'Customer not found'}), 404
        
    if request.method == 'GET':
        # Return customer, plus their repair history and finance/payment history
        orders = conn.execute('SELECT * FROM repair_orders WHERE customer_id = ? ORDER BY created_at DESC', (cust_id,)).fetchall()
        payments = conn.execute("SELECT * FROM finances WHERE type = 'revenue' AND notes LIKE ? ORDER BY date DESC", (f"%Farmer %",)).fetchall()
        # Filter payments specifically for this customer name
        cust_payments = []
        cust_name = customer['name']
        for p in payments:
            if cust_name.split()[0] in p['notes'] or cust_name in p['notes']:
                cust_payments.append(dict_from_row(p))
                
        res = dict_from_row(customer)
        res['history'] = [dict_from_row(o) for o in orders]
        res['payments'] = cust_payments
        conn.close()
        return jsonify(res)
        
    elif request.method == 'PUT':
        data = request.json or {}
        name = data.get('name', customer['name'])
        phone = data.get('phone', customer['phone'])
        village = data.get('village', customer['village'])
        brand = data.get('brand', customer['brand'])
        outstanding = data.get('outstanding', customer['outstanding'])
        notes = data.get('notes', customer['notes'])
        
        conn.execute('''
            UPDATE customers
            SET name = ?, phone = ?, village = ?, brand = ?, outstanding = ?, notes = ?
            WHERE id = ?
        ''', (name, phone, village, brand, outstanding, notes, cust_id))
        conn.commit()
        updated = conn.execute('SELECT * FROM customers WHERE id = ?', (cust_id,)).fetchone()
        conn.close()
        return jsonify(dict_from_row(updated))
        
    elif request.method == 'DELETE':
        conn.execute('DELETE FROM customers WHERE id = ?', (cust_id,))
        conn.commit()
        conn.close()
        return jsonify({'success': True, 'message': 'Customer deleted successfully'})

@app.route('/api/customers/<int:cust_id>/payment', methods=['POST'])
def record_customer_payment(cust_id):
    conn = get_db_connection()
    customer = conn.execute('SELECT * FROM customers WHERE id = ?', (cust_id,)).fetchone()
    if not customer:
        conn.close()
        return jsonify({'error': 'Not Found', 'message': 'Customer not found'}), 404
        
    data = request.json or {}
    amount = float(data.get('amount', 0))
    payment_method = data.get('payment_method', 'UPI')
    notes = data.get('notes', '')
    
    if amount <= 0:
        return jsonify({'error': 'Bad Request', 'message': 'Amount must be greater than 0'}), 400
        
    new_outstanding = max(0.0, customer['outstanding'] - amount)
    new_total_spend = customer['total_spend'] + amount
    
    # 1. Update Customer
    conn.execute('''
        UPDATE customers
        SET outstanding = ?, total_spend = ?, last_visit = ?
        WHERE id = ?
    ''', (new_outstanding, new_total_spend, datetime.date.today().strftime("%Y-%m-%d"), cust_id))
    
    # 2. Insert Finance Revenue Record
    conn.execute('''
        INSERT INTO finances (type, amount, category, payment_method, date, notes)
        VALUES (?, ?, ?, ?, ?, ?)
    ''', ('revenue', amount, 'Repair Services', payment_method, datetime.date.today().strftime("%Y-%m-%d"), 
          f"Payment received from {customer['name']} (Phone: {customer['phone']}). {notes}"))
          
    conn.commit()
    updated = conn.execute('SELECT * FROM customers WHERE id = ?', (cust_id,)).fetchone()
    conn.close()
    return jsonify({
        'success': True,
        'message': 'Payment recorded successfully',
        'customer': dict_from_row(updated)
    })


# --- REPAIR ORDERS API ---
@app.route('/api/repair_orders', methods=['GET', 'POST'])
def handle_repair_orders():
    conn = get_db_connection()
    if request.method == 'GET':
        rows = conn.execute('''
            SELECT ro.*, c.name as customer_name, c.phone as customer_phone, e.name as mechanic_name 
            FROM repair_orders ro
            JOIN customers c ON ro.customer_id = c.id
            LEFT JOIN employees e ON ro.mechanic_id = e.id
            ORDER BY ro.id DESC
        ''').fetchall()
        orders = [dict_from_row(r) for r in rows]
        conn.close()
        return jsonify(orders)
        
    elif request.method == 'POST':
        data = request.json or {}
        customer_id = data.get('customer_id')
        brand = data.get('brand')
        model = data.get('model')
        registration = data.get('registration')
        complaint = data.get('complaint')
        estimated_cost = float(data.get('estimated_cost', 0))
        priority = data.get('priority', 'Medium')
        mechanic_id = data.get('mechanic_id')
        delivery_date = data.get('delivery_date')
        status = data.get('status', 'Received')
        
        if not customer_id or not brand or not model or not registration or not complaint:
            return jsonify({'error': 'Bad Request', 'message': 'Missing required fields'}), 400
            
        cursor = conn.cursor()
        cursor.execute('''
            INSERT INTO repair_orders (customer_id, brand, model, registration, complaint, estimated_cost, priority, mechanic_id, delivery_date, status, work_performed, parts_used, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, '', '', ?)
        ''', (customer_id, brand, model, registration, complaint, estimated_cost, priority, mechanic_id, delivery_date, status, datetime.date.today().strftime("%Y-%m-%d")))
        new_id = cursor.lastrowid
        
        # If status is Ready for Delivery/Delivered and there is no outstanding, we can adjust payments
        # Actually, let's keep outstanding logic separate or let the customer page manage it.
        # But if they add a repair order, we can add to customer outstanding balance if it is not immediately paid
        customer = conn.execute('SELECT * FROM customers WHERE id = ?', (customer_id,)).fetchone()
        if customer:
            new_outstanding = customer['outstanding'] + estimated_cost
            conn.execute('UPDATE customers SET outstanding = ? WHERE id = ?', (new_outstanding, customer_id))
            # Create a pending revenue record with status "Credit / Due"
            conn.execute('''
                INSERT INTO finances (type, amount, category, payment_method, date, notes)
                VALUES (?, ?, ?, ?, ?, ?)
            ''', ('revenue', estimated_cost, 'Repair Services', 'Credit / Due', datetime.date.today().strftime("%Y-%m-%d"), 
                  f"Repair Order #{new_id} booked for {customer['name']} - {brand} {model}"))
                  
        conn.commit()
        order = conn.execute('SELECT * FROM repair_orders WHERE id = ?', (new_id,)).fetchone()
        conn.close()
        return jsonify(dict_from_row(order)), 201

@app.route('/api/repair_orders/<int:order_id>', methods=['GET', 'PUT', 'DELETE'])
def handle_single_repair_order(order_id):
    conn = get_db_connection()
    order = conn.execute('''
        SELECT ro.*, c.name as customer_name, c.phone as customer_phone, c.village as customer_village, e.name as mechanic_name
        FROM repair_orders ro
        JOIN customers c ON ro.customer_id = c.id
        LEFT JOIN employees e ON ro.mechanic_id = e.id
        WHERE ro.id = ?
    ''', (order_id,)).fetchone()
    
    if not order:
        conn.close()
        return jsonify({'error': 'Not Found', 'message': 'Repair order not found'}), 404
        
    if request.method == 'GET':
        res = dict_from_row(order)
        conn.close()
        return jsonify(res)
        
    elif request.method == 'PUT':
        data = request.json or {}
        status = data.get('status', order['status'])
        mechanic_id = data.get('mechanic_id', order['mechanic_id'])
        delivery_date = data.get('delivery_date', order['delivery_date'])
        work_performed = data.get('work_performed', order['work_performed'])
        parts_used = data.get('parts_used', order['parts_used'])
        estimated_cost = float(data.get('estimated_cost', order['estimated_cost']))
        priority = data.get('priority', order['priority'])
        complaint = data.get('complaint', order['complaint'])
        
        # Check if status has transitioned to Delivered
        old_status = order['status']
        if status == 'Delivered' and old_status != 'Delivered':
            # Complete the order
            pass
            
        conn.execute('''
            UPDATE repair_orders
            SET status = ?, mechanic_id = ?, delivery_date = ?, work_performed = ?, parts_used = ?, estimated_cost = ?, priority = ?, complaint = ?
            WHERE id = ?
        ''', (status, mechanic_id, delivery_date, work_performed, parts_used, estimated_cost, priority, complaint, order_id))
        conn.commit()
        updated = conn.execute('SELECT * FROM repair_orders WHERE id = ?', (order_id,)).fetchone()
        conn.close()
        return jsonify(dict_from_row(updated))
        
    elif request.method == 'DELETE':
        conn.execute('DELETE FROM repair_orders WHERE id = ?', (order_id,))
        conn.commit()
        conn.close()
        return jsonify({'success': True, 'message': 'Order deleted successfully'})

@app.route('/api/repair_orders/<int:order_id>/status', methods=['PATCH'])
def update_repair_order_status(order_id):
    conn = get_db_connection()
    order = conn.execute('SELECT * FROM repair_orders WHERE id = ?', (order_id,)).fetchone()
    if not order:
        conn.close()
        return jsonify({'error': 'Not Found', 'message': 'Repair order not found'}), 404
        
    data = request.json or {}
    status = data.get('status')
    if not status:
        return jsonify({'error': 'Bad Request', 'message': 'Status required'}), 400
        
    conn.execute('UPDATE repair_orders SET status = ? WHERE id = ?', (status, order_id))
    conn.commit()
    conn.close()
    return jsonify({'success': True, 'message': 'Status updated successfully'})


# --- FINANCE MANAGEMENT API ---
@app.route('/api/finances', methods=['GET', 'POST'])
def handle_finances():
    conn = get_db_connection()
    if request.method == 'GET':
        rows = conn.execute('SELECT * FROM finances ORDER BY date DESC, id DESC').fetchall()
        records = [dict_from_row(r) for r in rows]
        conn.close()
        return jsonify(records)
        
    elif request.method == 'POST':
        data = request.json or {}
        type_ = data.get('type')
        amount = float(data.get('amount', 0))
        category = data.get('category')
        payment_method = data.get('payment_method')
        notes = data.get('notes', '')
        date = data.get('date') or datetime.date.today().strftime("%Y-%m-%d")
        
        if not type_ or amount <= 0 or not category or not payment_method:
            return jsonify({'error': 'Bad Request', 'message': 'Missing or invalid fields'}), 400
            
        cursor = conn.cursor()
        cursor.execute('''
            INSERT INTO finances (type, amount, category, payment_method, date, notes)
            VALUES (?, ?, ?, ?, ?, ?)
        ''', (type_, amount, category, payment_method, date, notes))
        new_id = cursor.lastrowid
        conn.commit()
        record = conn.execute('SELECT * FROM finances WHERE id = ?', (new_id,)).fetchone()
        conn.close()
        return jsonify(dict_from_row(record)), 201

@app.route('/api/finances/report', methods=['GET'])
def get_finances_report():
    conn = get_db_connection()
    # Profit & Loss
    revenue = conn.execute("SELECT SUM(amount) FROM finances WHERE type = 'revenue' AND category != 'Outstanding Dues'").fetchone()[0] or 0.0
    expenses = conn.execute("SELECT SUM(amount) FROM finances WHERE type = 'expense'").fetchone()[0] or 0.0
    net_profit = revenue - expenses
    
    # Revenue Breakdown
    rev_breakdown_rows = conn.execute("""
        SELECT category, SUM(amount) as total
        FROM finances
        WHERE type = 'revenue'
        GROUP BY category
    """).fetchall()
    revenue_breakdown = {r['category']: r['total'] for r in rev_breakdown_rows}

    # Expense Breakdown
    exp_breakdown_rows = conn.execute("""
        SELECT category, SUM(amount) as total
        FROM finances
        WHERE type = 'expense'
        GROUP BY category
    """).fetchall()
    expense_breakdown = {r['category']: r['total'] for r in exp_breakdown_rows}
    
    # Mechanic Productivity (Delivered orders estimate cost serviced by mechanic)
    prod_rows = conn.execute("""
        SELECT e.name, COUNT(ro.id) as orders_count, SUM(ro.estimated_cost) as total_value
        FROM employees e
        JOIN repair_orders ro ON e.id = ro.mechanic_id
        WHERE ro.status = 'Delivered'
        GROUP BY e.name
        ORDER BY total_value DESC
    """).fetchall()
    productivity = [dict_from_row(p) for p in prod_rows]

    conn.close()
    return jsonify({
        'totalRevenue': revenue,
        'totalExpense': expenses,
        'netProfit': net_profit,
        'revenueBreakdown': revenue_breakdown,
        'expenseBreakdown': expense_breakdown,
        'mechanicProductivity': productivity
    })


# --- EMPLOYEE DIRECTORY API ---
@app.route('/api/employees', methods=['GET', 'POST'])
def handle_employees():
    conn = get_db_connection()
    if request.method == 'GET':
        rows = conn.execute('SELECT * FROM employees ORDER BY name ASC').fetchall()
        employees = [dict_from_row(r) for r in rows]
        conn.close()
        return jsonify(employees)
        
    elif request.method == 'POST':
        data = request.json or {}
        name = data.get('name')
        role = data.get('role')
        phone = data.get('phone')
        experience = data.get('experience')
        salary = float(data.get('salary', 0))
        joining_date = data.get('joining_date') or datetime.date.today().strftime("%Y-%m-%d")
        status = data.get('status', 'Active')
        
        if not name or not role or not phone or salary <= 0:
            return jsonify({'error': 'Bad Request', 'message': 'Missing required fields'}), 400
            
        cursor = conn.cursor()
        cursor.execute('''
            INSERT INTO employees (name, role, phone, experience, salary, joining_date, status)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        ''', (name, role, phone, experience, salary, joining_date, status))
        new_id = cursor.lastrowid
        conn.commit()
        emp = conn.execute('SELECT * FROM employees WHERE id = ?', (new_id,)).fetchone()
        conn.close()
        return jsonify(dict_from_row(emp)), 201

@app.route('/api/employees/<int:emp_id>', methods=['GET', 'PUT', 'DELETE'])
def handle_single_employee(emp_id):
    conn = get_db_connection()
    emp = conn.execute('SELECT * FROM employees WHERE id = ?', (emp_id,)).fetchone()
    if not emp:
        conn.close()
        return jsonify({'error': 'Not Found', 'message': 'Employee not found'}), 404
        
    if request.method == 'GET':
        res = dict_from_row(emp)
        conn.close()
        return jsonify(res)
        
    elif request.method == 'PUT':
        data = request.json or {}
        name = data.get('name', emp['name'])
        role = data.get('role', emp['role'])
        phone = data.get('phone', emp['phone'])
        experience = data.get('experience', emp['experience'])
        salary = float(data.get('salary', emp['salary']))
        status = data.get('status', emp['status'])
        
        conn.execute('''
            UPDATE employees
            SET name = ?, role = ?, phone = ?, experience = ?, salary = ?, status = ?
            WHERE id = ?
        ''', (name, role, phone, experience, salary, status, emp_id))
        conn.commit()
        updated = conn.execute('SELECT * FROM employees WHERE id = ?', (emp_id,)).fetchone()
        conn.close()
        return jsonify(dict_from_row(updated))
        
    elif request.method == 'DELETE':
        conn.execute('DELETE FROM employees WHERE id = ?', (emp_id,))
        conn.commit()
        conn.close()
        return jsonify({'success': True, 'message': 'Employee deleted successfully'})


# --- ATTENDANCE API ---
@app.route('/api/attendance', methods=['GET', 'POST'])
def handle_attendance():
    conn = get_db_connection()
    today_str = datetime.date.today().strftime("%Y-%m-%d")
    
    if request.method == 'GET':
        date = request.args.get('date', today_str)
        rows = conn.execute('''
            SELECT e.id as employee_id, e.name, e.role, a.status, a.check_in, a.check_out, a.id as attendance_id
            FROM employees e
            LEFT JOIN attendance a ON e.id = a.employee_id AND a.date = ?
            WHERE e.status = 'Active'
            ORDER BY e.name ASC
        ''', (date,)).fetchall()
        attendance = [dict_from_row(r) for r in rows]
        conn.close()
        return jsonify(attendance)
        
    elif request.method == 'POST':
        data = request.json or {}
        employee_id = data.get('employee_id')
        date = data.get('date', today_str)
        status = data.get('status', 'Present') # 'Present', 'Absent', 'Half-day'
        check_in = data.get('check_in', '09:00' if status != 'Absent' else None)
        check_out = data.get('check_out', '18:00' if status != 'Absent' else None)
        
        if not employee_id:
            return jsonify({'error': 'Bad Request', 'message': 'Employee ID required'}), 400
            
        cursor = conn.cursor()
        cursor.execute('''
            INSERT INTO attendance (employee_id, date, status, check_in, check_out)
            VALUES (?, ?, ?, ?, ?)
            ON CONFLICT(employee_id, date) DO UPDATE SET
                status = excluded.status,
                check_in = excluded.check_in,
                check_out = excluded.check_out
        ''', (employee_id, date, status, check_in, check_out))
        conn.commit()
        conn.close()
        return jsonify({'success': True, 'message': 'Attendance updated successfully'})

@app.route('/api/attendance/report', methods=['GET'])
def get_attendance_report():
    conn = get_db_connection()
    # Monthly aggregate attendance for employees
    month = request.args.get('month', datetime.date.today().strftime("%Y-%m"))
    rows = conn.execute('''
        SELECT e.name, e.role, 
               SUM(CASE WHEN a.status = 'Present' THEN 1 ELSE 0 END) as presents,
               SUM(CASE WHEN a.status = 'Absent' THEN 1 ELSE 0 END) as absents,
               SUM(CASE WHEN a.status = 'Half-day' THEN 1 ELSE 0 END) as half_days
        FROM employees e
        LEFT JOIN attendance a ON e.id = a.employee_id AND a.date LIKE ?
        WHERE e.status = 'Active'
        GROUP BY e.id
        ORDER BY e.name ASC
    ''', (f"{month}%",)).fetchall()
    report = [dict_from_row(r) for r in rows]
    conn.close()
    return jsonify(report)


# --- SALARY MANAGEMENT API ---
@app.route('/api/employees/<int:emp_id>/salary', methods=['GET', 'POST'])
def calculate_employee_salary(emp_id):
    conn = get_db_connection()
    emp = conn.execute('SELECT * FROM employees WHERE id = ?', (emp_id,)).fetchone()
    if not emp:
        conn.close()
        return jsonify({'error': 'Not Found', 'message': 'Employee not found'}), 404
        
    month = request.args.get('month', datetime.date.today().strftime("%Y-%m"))
    
    # Calculate attendance counts
    att = conn.execute('''
        SELECT 
            SUM(CASE WHEN status = 'Present' THEN 1 ELSE 0 END) as presents,
            SUM(CASE WHEN status = 'Absent' THEN 1 ELSE 0 END) as absents,
            SUM(CASE WHEN status = 'Half-day' THEN 1 ELSE 0 END) as half_days
        FROM attendance
        WHERE employee_id = ? AND date LIKE ?
    ''', (emp_id, f"{month}%")).fetchone()
    
    presents = att['presents'] or 0
    absents = att['absents'] or 0
    half_days = att['half_days'] or 0
    
    # Basic math: assume 26 working days in a month.
    # Daily rate = base salary / 26
    base_salary = emp['salary']
    daily_rate = base_salary / 26.0
    
    # Work days = presents + (0.5 * half_days)
    effective_days = presents + (0.5 * half_days)
    
    # Advance check
    advance_row = conn.execute('''
        SELECT SUM(amount) FROM finances 
        WHERE type = 'expense' AND category = 'Salaries' 
        AND notes LIKE ? AND date LIKE ?
    ''', (f"Advance to {emp['name']}%", f"{month}%")).fetchone()
    advances = advance_row[0] or 0.0
    
    # Deductions: for days missed (if effective_days < 26)
    missed_days = max(0.0, 26.0 - effective_days)
    deductions = missed_days * daily_rate
    
    net_salary = max(0.0, base_salary - deductions - advances)
    
    if request.method == 'GET':
        conn.close()
        return jsonify({
            'employeeName': emp['name'],
            'role': emp['role'],
            'baseSalary': base_salary,
            'presents': presents,
            'absents': absents,
            'halfDays': half_days,
            'advances': advances,
            'deductions': round(deductions, 2),
            'netSalary': round(net_salary, 2),
            'month': month
        })
        
    elif request.method == 'POST':
        # Record Salary Expense
        data = request.json or {}
        paid_amount = float(data.get('amount', net_salary))
        payment_method = data.get('payment_method', 'Bank Transfer')
        notes = data.get('notes', f"Salary payout for {month}")
        
        cursor = conn.cursor()
        cursor.execute('''
            INSERT INTO finances (type, amount, category, payment_method, date, notes)
            VALUES (?, ?, ?, ?, ?, ?)
        ''', ('expense', paid_amount, 'Salaries', payment_method, datetime.date.today().strftime("%Y-%m-%d"), 
              f"Salary to {emp['name']} for {month}. {notes}"))
              
        conn.commit()
        conn.close()
        return jsonify({'success': True, 'message': 'Salary payout recorded successfully'})


# --- HIRING MODULE API ---
@app.route('/api/candidates', methods=['GET', 'POST'])
def handle_candidates():
    conn = get_db_connection()
    if request.method == 'GET':
        rows = conn.execute('SELECT * FROM candidates ORDER BY id DESC').fetchall()
        candidates = [dict_from_row(r) for r in rows]
        conn.close()
        return jsonify(candidates)
        
    elif request.method == 'POST':
        data = request.json or {}
        name = data.get('name')
        role = data.get('role')
        phone = data.get('phone')
        experience = data.get('experience')
        expected_salary = float(data.get('expected_salary', 0))
        status = data.get('status', 'Applied')
        notes = data.get('notes', '')
        
        if not name or not role or not phone:
            return jsonify({'error': 'Bad Request', 'message': 'Name, role and phone required'}), 400
            
        cursor = conn.cursor()
        cursor.execute('''
            INSERT INTO candidates (name, role, phone, experience, expected_salary, status, notes)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        ''', (name, role, phone, experience, expected_salary, status, notes))
        new_id = cursor.lastrowid
        conn.commit()
        candidate = conn.execute('SELECT * FROM candidates WHERE id = ?', (new_id,)).fetchone()
        conn.close()
        return jsonify(dict_from_row(candidate)), 201

@app.route('/api/candidates/<int:cand_id>', methods=['PUT', 'DELETE'])
def handle_single_candidate(cand_id):
    conn = get_db_connection()
    cand = conn.execute('SELECT * FROM candidates WHERE id = ?', (cand_id,)).fetchone()
    if not cand:
        conn.close()
        return jsonify({'error': 'Not Found', 'message': 'Candidate not found'}), 404
        
    if request.method == 'PUT':
        data = request.json or {}
        status = data.get('status', cand['status'])
        notes = data.get('notes', cand['notes'])
        expected_salary = float(data.get('expected_salary', cand['expected_salary']))
        
        # If transitioning to Selected, we can automatically add to Employees
        if status == 'Selected' and cand['status'] != 'Selected':
            cursor = conn.cursor()
            cursor.execute('''
                INSERT INTO employees (name, role, phone, experience, salary, joining_date, status)
                VALUES (?, ?, ?, ?, ?, ?, 'Active')
            ''', (cand['name'], cand['role'], cand['phone'], cand['experience'], expected_salary or 15000.0, datetime.date.today().strftime("%Y-%m-%d")))
            
        conn.execute('UPDATE candidates SET status = ?, notes = ?, expected_salary = ? WHERE id = ?', (status, notes, expected_salary, cand_id))
        conn.commit()
        updated = conn.execute('SELECT * FROM candidates WHERE id = ?', (cand_id,)).fetchone()
        conn.close()
        return jsonify(dict_from_row(updated))
        
    elif request.method == 'DELETE':
        conn.execute('DELETE FROM candidates WHERE id = ?', (cand_id,))
        conn.commit()
        conn.close()
        return jsonify({'success': True, 'message': 'Candidate deleted successfully'})


# --- INVENTORY MANAGEMENT API ---
@app.route('/api/inventory', methods=['GET', 'POST'])
def handle_inventory():
    conn = get_db_connection()
    if request.method == 'GET':
        rows = conn.execute('SELECT * FROM inventory ORDER BY part_name ASC').fetchall()
        parts = [dict_from_row(r) for r in rows]
        conn.close()
        return jsonify(parts)
        
    elif request.method == 'POST':
        data = request.json or {}
        part_name = data.get('part_name')
        brand = data.get('brand')
        quantity = int(data.get('quantity', 0))
        reorder_level = int(data.get('reorder_level', 5))
        purchase_price = float(data.get('purchase_price', 0))
        selling_price = float(data.get('selling_price', 0))
        
        if not part_name or not brand or quantity < 0 or purchase_price < 0 or selling_price < 0:
            return jsonify({'error': 'Bad Request', 'message': 'Invalid input details'}), 400
            
        cursor = conn.cursor()
        cursor.execute('''
            INSERT INTO inventory (part_name, brand, quantity, reorder_level, purchase_price, selling_price)
            VALUES (?, ?, ?, ?, ?, ?)
        ''', (part_name, brand, quantity, reorder_level, purchase_price, selling_price))
        new_id = cursor.lastrowid
        conn.commit()
        part = conn.execute('SELECT * FROM inventory WHERE id = ?', (new_id,)).fetchone()
        conn.close()
        return jsonify(dict_from_row(part)), 201

@app.route('/api/inventory/<int:part_id>', methods=['PUT', 'DELETE'])
def handle_single_inventory(part_id):
    conn = get_db_connection()
    part = conn.execute('SELECT * FROM inventory WHERE id = ?', (part_id,)).fetchone()
    if not part:
        conn.close()
        return jsonify({'error': 'Not Found', 'message': 'Part not found'}), 404
        
    if request.method == 'PUT':
        data = request.json or {}
        quantity = int(data.get('quantity', part['quantity']))
        reorder_level = int(data.get('reorder_level', part['reorder_level']))
        purchase_price = float(data.get('purchase_price', part['purchase_price']))
        selling_price = float(data.get('selling_price', part['selling_price']))
        
        conn.execute('''
            UPDATE inventory
            SET quantity = ?, reorder_level = ?, purchase_price = ?, selling_price = ?
            WHERE id = ?
        ''', (quantity, reorder_level, purchase_price, selling_price, part_id))
        conn.commit()
        updated = conn.execute('SELECT * FROM inventory WHERE id = ?', (part_id,)).fetchone()
        conn.close()
        return jsonify(dict_from_row(updated))
        
    elif request.method == 'DELETE':
        conn.execute('DELETE FROM inventory WHERE id = ?', (part_id,))
        conn.commit()
        conn.close()
        return jsonify({'success': True, 'message': 'Inventory part deleted successfully'})


# --- REPORTS EXPORT API ---
@app.route('/api/reports/daily', methods=['GET'])
def get_daily_report():
    conn = get_db_connection()
    today_str = datetime.date.today().strftime("%Y-%m-%d")
    
    orders_received = conn.execute("SELECT COUNT(*) FROM repair_orders WHERE created_at = ?", (today_str,)).fetchone()[0]
    orders_completed = conn.execute("SELECT COUNT(*) FROM repair_orders WHERE status = 'Delivered' AND delivery_date = ?", (today_str,)).fetchone()[0]
    revenue_collected = conn.execute("SELECT SUM(amount) FROM finances WHERE type = 'revenue' AND date = ?", (today_str,)).fetchone()[0] or 0.0
    pending_jobs = conn.execute("SELECT COUNT(*) FROM repair_orders WHERE status != 'Delivered'").fetchone()[0]
    
    conn.close()
    return jsonify({
        'date': today_str,
        'ordersReceived': orders_received,
        'ordersCompleted': orders_completed,
        'revenueCollected': revenue_collected,
        'pendingJobs': pending_jobs
    })

@app.route('/api/reports/monthly', methods=['GET'])
def get_monthly_report():
    conn = get_db_connection()
    month_str = datetime.date.today().strftime("%Y-%m")
    
    total_rev = conn.execute("SELECT SUM(amount) FROM finances WHERE type = 'revenue' AND date LIKE ? AND category != 'Outstanding Dues'", (f"{month_str}%",)).fetchone()[0] or 0.0
    total_exp = conn.execute("SELECT SUM(amount) FROM finances WHERE type = 'expense' AND date LIKE ?", (f"{month_str}%",)).fetchone()[0] or 0.0
    net_profit = total_rev - total_exp
    
    top_cust_rows = conn.execute("""
        SELECT name, phone, total_spend, outstanding 
        FROM customers 
        ORDER BY total_spend DESC 
        LIMIT 5
    """).fetchall()
    top_customers = [dict_from_row(c) for c in top_cust_rows]
    
    # Common repairs
    common_repairs = conn.execute("""
        SELECT complaint, COUNT(*) as count 
        FROM repair_orders 
        GROUP BY complaint 
        ORDER BY count DESC 
        LIMIT 5
    """).fetchall()
    common_repairs_list = [dict_from_row(r) for r in common_repairs]

    conn.close()
    return jsonify({
        'month': month_str,
        'totalRevenue': total_rev,
        'totalExpenses': total_exp,
        'netProfit': net_profit,
        'topCustomers': top_customers,
        'commonRepairs': common_repairs_list
    })

if __name__ == '__main__':
    # Make sure static directory exists
    os.makedirs('static', exist_ok=True)
    app.run(debug=True, port=5000)
