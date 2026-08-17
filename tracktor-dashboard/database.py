import sqlite3
import datetime
import random

DB_PATH = 'database.db'

def get_db_connection():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_db_connection()
    cursor = conn.cursor()

    # Enable foreign keys
    cursor.execute("PRAGMA foreign_keys = ON;")

    # 1. Users Table (Auth)
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL,
            name TEXT NOT NULL,
            role TEXT NOT NULL
        )
    ''')

    # 2. Customers Table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS customers (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            phone TEXT NOT NULL,
            village TEXT NOT NULL,
            brand TEXT NOT NULL,
            last_visit TEXT,
            total_spend REAL DEFAULT 0,
            outstanding REAL DEFAULT 0,
            notes TEXT
        )
    ''')

    # 3. Employees Table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS employees (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            role TEXT NOT NULL,
            phone TEXT NOT NULL,
            experience TEXT NOT NULL,
            salary REAL NOT NULL,
            joining_date TEXT NOT NULL,
            status TEXT NOT NULL -- 'Active', 'Inactive'
        )
    ''')

    # 4. Repair Orders Table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS repair_orders (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            customer_id INTEGER NOT NULL,
            brand TEXT NOT NULL,
            model TEXT NOT NULL,
            registration TEXT NOT NULL,
            complaint TEXT NOT NULL,
            estimated_cost REAL NOT NULL,
            priority TEXT NOT NULL, -- 'High', 'Medium', 'Low'
            mechanic_id INTEGER,
            delivery_date TEXT,
            status TEXT NOT NULL, -- 'Received', 'Inspection', 'Parts Required', 'Repair In Progress', 'Welding Work', 'Testing', 'Ready for Delivery', 'Delivered'
            work_performed TEXT,
            parts_used TEXT,
            created_at TEXT NOT NULL,
            FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE,
            FOREIGN KEY (mechanic_id) REFERENCES employees(id) ON DELETE SET NULL
        )
    ''')

    # 5. Finances Table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS finances (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            type TEXT NOT NULL, -- 'revenue', 'expense'
            amount REAL NOT NULL,
            category TEXT NOT NULL, -- e.g., 'Repair Services', 'Welding Works', 'Spare Parts', 'Salaries', etc.
            payment_method TEXT, -- 'Cash', 'UPI', 'Bank Transfer', 'Credit / Due'
            date TEXT NOT NULL,
            notes TEXT
        )
    ''')

    # 6. Attendance Table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS attendance (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            employee_id INTEGER NOT NULL,
            date TEXT NOT NULL,
            status TEXT NOT NULL, -- 'Present', 'Absent', 'Half-day'
            check_in TEXT,
            check_out TEXT,
            UNIQUE(employee_id, date),
            FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE
        )
    ''')

    # 7. Candidates Table (Hiring)
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS candidates (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            role TEXT NOT NULL,
            phone TEXT NOT NULL,
            experience TEXT NOT NULL,
            expected_salary REAL NOT NULL,
            status TEXT NOT NULL, -- 'Applied', 'Interview Scheduled', 'Trial Work', 'Selected', 'Rejected'
            notes TEXT
        )
    ''')

    # 8. Inventory Table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS inventory (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            part_name TEXT NOT NULL,
            brand TEXT NOT NULL,
            quantity INTEGER NOT NULL,
            reorder_level INTEGER NOT NULL,
            purchase_price REAL NOT NULL,
            selling_price REAL NOT NULL
        )
    ''')

    conn.commit()

    # Seed Admin User if not exists
    cursor.execute("SELECT COUNT(*) FROM users")
    if cursor.fetchone()[0] == 0:
        cursor.execute('''
            INSERT INTO users (username, password, name, role)
            VALUES (?, ?, ?, ?)
        ''', ('admin', 'tracktor123', 'Workshop Manager', 'Admin'))

    # Seed Employees if not exists
    cursor.execute("SELECT COUNT(*) FROM employees")
    if cursor.fetchone()[0] == 0:
        employees_data = [
            ('Ramesh Kumar', 'Mechanic', '9876543210', '8 Years', 22000, '2022-01-15', 'Active'),
            ('Suresh Singh', 'Mechanic', '9876543211', '6 Years', 20000, '2022-05-10', 'Active'),
            ('Vikram Rathore', 'Welding Specialist', '9876543212', '10 Years', 25000, '2021-03-20', 'Active'),
            ('Amit Sharma', 'Mechanic', '9876543213', '4 Years', 18000, '2023-02-01', 'Active'),
            ('Manoj Yadav', 'Welding Specialist', '9876543214', '5 Years', 19000, '2023-06-15', 'Active'),
            ('Dinesh Patel', 'Helper', '9876543215', '2 Years', 12000, '2024-01-10', 'Active'),
            ('Rajesh Gupta', 'Supervisor', '9876543216', '12 Years', 30000, '2020-08-01', 'Active'),
            ('Sunita Devi', 'Accountant', '9876543217', '5 Years', 18000, '2023-11-20', 'Active')
        ]
        cursor.executemany('''
            INSERT INTO employees (name, role, phone, experience, salary, joining_date, status)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        ''', employees_data)

    # Seed Customers if not exists
    cursor.execute("SELECT COUNT(*) FROM customers")
    if cursor.fetchone()[0] == 0:
        villages = ['Rampur', 'Kalyanpur', 'Fatehpur', 'Shahpur', 'Gopalpur', 'Haripur', 'Pipra', 'Bela', 'Chandpur', 'Sultanpur']
        brands = ['Mahindra', 'Mahindra', 'Mahindra', 'Swaraj', 'Swaraj', 'John Deere', 'Swaraj', 'Escorts'] # Mahindra is primary
        
        # We need exactly 42 active customers
        customers_list = []
        # Let's pre-generate 42 customers with realistic data
        random.seed(42) # For reproducible mock data
        for i in range(1, 43):
            name = f"Farmer {random.choice(['Ram', 'Hari', 'Shiv', 'Krishna', 'Vijay', 'Raj', 'Jagdish', 'Satish', 'Balwan', 'Sukhdev', 'Gurmeet', 'Karan', 'Mahender', 'Subhash', 'Dharam'])} {random.choice(['Singh', 'Yadav', 'Choudhary', 'Kumar', 'Patel', 'Lal', 'Verma', 'Sharma'])}"
            phone = f"9{random.randint(10000000, 99999999)}"
            village = random.choice(villages)
            brand = random.choice(brands)
            
            # Outstanding dues should sum up to ₹23,000 for realistic metric tracking
            # We can hardcode specific dues for a few customers, and set others to 0
            outstanding = 0
            if i == 5: outstanding = 8500
            elif i == 12: outstanding = 4500
            elif i == 23: outstanding = 6000
            elif i == 31: outstanding = 4000
            # Total: 8500 + 4500 + 6000 + 4000 = 23000

            total_spend = random.randint(5, 45) * 1000
            last_visit = (datetime.date.today() - datetime.timedelta(days=random.randint(2, 60))).strftime("%Y-%m-%d")
            notes = f"Owns {brand} tractor. Prefers Ramesh for repairs." if brand == 'Mahindra' else f"Needs servicing for {brand}."

            customers_list.append((name, phone, village, brand, last_visit, total_spend, outstanding, notes))
            
        cursor.executemany('''
            INSERT INTO customers (name, phone, village, brand, last_visit, total_spend, outstanding, notes)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ''', customers_list)

    # Seed Repair Orders if not exists
    cursor.execute("SELECT COUNT(*) FROM repair_orders")
    if cursor.fetchone()[0] == 0:
        # We need 18 repair orders (sample metrics states 18 orders)
        # Let's map them to some seeded customers
        orders = [
            (5, 'Mahindra', 'Arjun 555 DI', 'HR-20-A-4321', 'Hydraulic lift not working & general service', 6500.0, 'High', 1, 'Ready for Delivery', 'Cleaned hydraulic filter, replaced O-rings, changed engine oil.', 'Engine oil, Hydraulic filter, O-rings'),
            (12, 'Swaraj', '744 FE', 'PB-11-F-7890', 'Clutch slippage & welding of front bumper bumper support', 8500.0, 'Medium', 3, 'Repair In Progress', 'Replacing clutch plate and welding front bracket.', 'Clutch plate, Welding rods'),
            (23, 'Mahindra', 'Jivo 225 DI', 'UP-16-T-2468', 'Engine overheating', 7000.0, 'High', 2, 'Welding Work', 'Radiator flush, welding water pump connector joint.', 'Radiator coolant, Connector pipe'),
            (31, 'Mahindra', 'Yuvo 575 DI', 'HR-26-C-9876', 'Electrical failure & headlight issues', 4000.0, 'Low', 4, 'Inspection', '', ''),
            (1, 'Swaraj', '855 FE', 'PB-10-B-1234', 'Brake shoe replacement', 4500.0, 'Medium', 5, 'Received', '', ''),
            (2, 'Mahindra', 'Arjun Novo 605', 'HR-12-D-5678', 'Transmission sound issues', 15000.0, 'High', 1, 'Parts Required', 'Gearbox dismantling. Awaiting transmission gears.', 'Gear assembly'),
            (3, 'John Deere', '5050 D', 'UP-15-E-8901', 'General service & engine tuning', 3500.0, 'Medium', 2, 'Testing', 'Engine oil changed, air filter cleaned, general diesel tuning completed.', 'Engine oil, Fuel filter'),
            (4, 'Swaraj', '744 FE', 'RJ-14-G-4567', 'Welding of rotavator blades & attachment hook repair', 3200.0, 'Medium', 3, 'Ready for Delivery', 'Welded 6 blades and replaced central hook bracket.', 'Welding rods, Steel plates'),
            (6, 'Mahindra', 'Jivo 245', 'HR-10-X-1122', 'Fuel injection pump servicing', 9500.0, 'High', 4, 'Delivered', 'Diesel pump calibration and filter replacement.', 'Fuel filters, pump seal kit'),
            (7, 'Swaraj', '735 FE', 'PB-08-H-3344', 'Welding structural frame & battery charging', 2800.0, 'Low', 5, 'Delivered', 'Welded support frame, battery recharged, electrical terminal cleaned.', 'Battery terminal, welding rods'),
            (8, 'Mahindra', 'Arjun 555 DI', 'UP-80-M-4455', 'Hydraulic fluid leak', 3800.0, 'Medium', 1, 'Delivered', 'Replaced hydraulic line and top up fluid.', 'Hydraulic hose, fluid'),
            (9, 'Mahindra', 'Yuvo 575 DI', 'HR-36-P-8899', 'Starter motor repairs', 4200.0, 'Medium', 2, 'Delivered', 'Starter motor carbon brushes replacement.', 'Carbon brush, self starter relay'),
            (10, 'Swaraj', '963 FE', 'PB-12-K-9900', 'Engine oil leak repair', 5500.0, 'High', 3, 'Delivered', 'Replaced engine head gasket and oil filter.', 'Head gasket, engine oil, oil filter'),
            (11, 'John Deere', '5310', 'UP-14-Z-2233', 'Power steering repair', 8900.0, 'High', 4, 'Delivered', 'Power steering pump sealing and oil change.', 'Steering oil, seal kit'),
            (13, 'Mahindra', 'Arjun Novo 605', 'HR-20-D-1212', 'Welding canopy stand & body patch work', 4500.0, 'Low', 5, 'Delivered', 'Welded canopy frame and patched fender rust.', 'Metal sheets, paint, welding rods'),
            (14, 'Mahindra', 'Jivo 225 DI', 'HR-22-Y-5566', 'Brake pedal adjustment & service', 1800.0, 'Low', 2, 'Delivered', 'Brake linkages lubricated, pedal play adjusted.', 'Lubricants'),
            (15, 'Swaraj', '744 FE', 'PB-11-L-4411', 'Engine service & oil filter', 3200.0, 'Medium', 4, 'Delivered', 'Engine oil and oil filter replaced.', 'Engine oil, filter'),
            (16, 'Mahindra', 'Yuvo 575 DI', 'HR-26-W-7788', 'Differential gear check', 12000.0, 'High', 1, 'Delivered', 'Replaced rear axle shaft and differential oil.', 'Axle shaft, differential oil')
        ]
        
        today = datetime.date.today()
        for idx, item in enumerate(orders):
            cust_id, brand, model, reg, complaint, cost, prio, mech_id, status, work, parts = item
            # Create a spread of creation dates
            days_ago = 20 - idx
            created_date = (today - datetime.timedelta(days=days_ago)).strftime("%Y-%m-%d")
            deliv_date = (today + datetime.timedelta(days=random.randint(1, 5))).strftime("%Y-%m-%d") if status != 'Delivered' else (today - datetime.timedelta(days=random.randint(0, 5))).strftime("%Y-%m-%d")
            
            cursor.execute('''
                INSERT INTO repair_orders (customer_id, brand, model, registration, complaint, estimated_cost, priority, mechanic_id, delivery_date, status, work_performed, parts_used, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ''', (cust_id, brand, model, reg, complaint, cost, prio, mech_id, deliv_date, status, work, parts, created_date))

    # Seed Finances if not exists
    cursor.execute("SELECT COUNT(*) FROM finances")
    if cursor.fetchone()[0] == 0:
        # We need monthly revenue to hover around ₹1,24,500.
        # Let's seed revenue items for the current month and last month.
        today = datetime.date.today()
        current_month = today.strftime("%Y-%m")
        prev_month = (today - datetime.timedelta(days=30)).strftime("%Y-%m")
        
        # Let's add multiple financial records
        finances_data = [
            # Current Month Revenue (Matches around ₹1,24,500 total)
            ('revenue', 45000.0, 'Repair Services', 'UPI', f"{current_month}-05", 'Mahindra major engine repair'),
            ('revenue', 18000.0, 'Welding Works', 'Cash', f"{current_month}-08", 'Welding support frames for local farmers'),
            ('revenue', 32000.0, 'Spare Parts', 'Bank Transfer', f"{current_month}-12", 'Sold tractor tires and battery spares'),
            ('revenue', 29500.0, 'Labour Charges', 'UPI', f"{current_month}-15", 'General workshop labour fees collected'),
            
            # Outstanding dues count towards revenue but not yet paid (these will match the ₹23,000 outstanding)
            ('revenue', 8500.0, 'Repair Services', 'Credit / Due', f"{current_month}-10", 'Farmer Ram Singh - Arjun 555 DI due'),
            ('revenue', 4500.0, 'Spare Parts', 'Credit / Due', f"{current_month}-12", 'Farmer Hari Yadav - 744 FE parts due'),
            ('revenue', 6000.0, 'Welding Works', 'Credit / Due', f"{current_month}-14", 'Farmer Shiv Choudhary - Jivo 225 DI welding due'),
            ('revenue', 4000.0, 'Labour Charges', 'Credit / Due', f"{current_month}-16", 'Farmer Krishna Kumar - Yuvo 575 DI due'),
            
            # Previous Month Revenue
            ('revenue', 38000.0, 'Repair Services', 'UPI', f"{prev_month}-05", 'Swaraj engine service'),
            ('revenue', 12000.0, 'Welding Works', 'Cash', f"{prev_month}-10", 'Welding work on custom harvester'),
            ('revenue', 25000.0, 'Spare Parts', 'Bank Transfer', f"{prev_month}-15", 'Spares sales'),
            ('revenue', 20000.0, 'Labour Charges', 'UPI', f"{prev_month}-20", 'Labour service charges'),

            # Current Month Expenses
            ('expense', 15000.0, 'Spare Parts purchase', 'Bank Transfer', f"{today.strftime('%Y-%m')}-02", 'Bought bulk oil and filters'),
            ('expense', 40000.0, 'Salaries', 'Bank Transfer', f"{today.strftime('%Y-%m')}-05", 'Monthly staff salary payout'),
            ('expense', 4500.0, 'Electricity', 'UPI', f"{today.strftime('%Y-%m')}-06", 'Workshop power bill'),
            ('expense', 12000.0, 'Rent', 'Bank Transfer', f"{today.strftime('%Y-%m')}-01", 'Monthly workshop shed rent'),
            ('expense', 5000.0, 'Tools & equipment', 'UPI', f"{today.strftime('%Y-%m')}-10", 'New welding torch and safety gloves'),
            ('expense', 2500.0, 'Fuel', 'Cash', f"{today.strftime('%Y-%m')}-12", 'Diesel for backup generator'),
            ('expense', 1500.0, 'Miscellaneous', 'Cash', f"{today.strftime('%Y-%m')}-15", 'Tea and refreshment for staff')
        ]
        
        cursor.executemany('''
            INSERT INTO finances (type, amount, category, payment_method, date, notes)
            VALUES (?, ?, ?, ?, ?, ?)
        ''', finances_data)

    # Seed Attendance for the last 5 days for Active Employees
    cursor.execute("SELECT COUNT(*) FROM attendance")
    if cursor.fetchone()[0] == 0:
        cursor.execute("SELECT id FROM employees WHERE status = 'Active'")
        employee_ids = [row[0] for row in cursor.fetchall()]
        today = datetime.date.today()
        
        attendance_records = []
        for i in range(5):
            date_str = (today - datetime.timedelta(days=i)).strftime("%Y-%m-%d")
            for emp_id in employee_ids:
                # Most employees are present, Ramesh took one day off
                if emp_id == 1 and i == 2:
                    status = 'Absent'
                    in_t, out_t = None, None
                elif emp_id == 4 and i == 3:
                    status = 'Half-day'
                    in_t, out_t = '09:00', '13:30'
                else:
                    status = 'Present'
                    in_t, out_t = '08:55', '18:05'
                
                attendance_records.append((emp_id, date_str, status, in_t, out_t))
                
        cursor.executemany('''
            INSERT INTO attendance (employee_id, date, status, check_in, check_out)
            VALUES (?, ?, ?, ?, ?)
        ''', attendance_records)

    # Seed Candidates for hiring module
    cursor.execute("SELECT COUNT(*) FROM candidates")
    if cursor.fetchone()[0] == 0:
        candidates_data = [
            ('Gaurav Verma', 'Tractor Mechanic', '9898989801', '5 Years', 19000.0, 'Interview Scheduled', 'Specialist in Mahindra steering systems.'),
            ('Baldev Singh', 'Welding Technician', '9898989802', '8 Years', 23000.0, 'Trial Work', 'Impressive speed, neat joints. Doing practical welding check today.'),
            ('Jaspal Preet', 'Mahindra Specialist', '9898989803', '12 Years', 28000.0, 'Applied', 'Worked at Mahindra agency workshop for 10 years.'),
            ('Rinku Lal', 'Workshop Helper', '9898989804', '0 Years', 10000.0, 'Selected', 'Eager to learn, joining next Monday.'),
            ('Vikash Yadav', 'Tractor Mechanic', '9898989805', '3 Years', 16000.0, 'Rejected', 'Failed the basic engine diagnosis trial.')
        ]
        cursor.executemany('''
            INSERT INTO candidates (name, role, phone, experience, expected_salary, status, notes)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        ''', candidates_data)

    # Seed Inventory (Spare parts track)
    cursor.execute("SELECT COUNT(*) FROM inventory")
    if cursor.fetchone()[0] == 0:
        inventory_data = [
            ('Engine Oil 15W-40 (5L)', 'Mahindra', 24, 10, 1450.0, 1850.0),
            ('Engine Oil 15W-40 (5L)', 'Swaraj', 15, 10, 1400.0, 1800.0),
            ('Clutch Plate Assembly', 'Mahindra Arjun', 4, 3, 4200.0, 5600.0),
            ('Clutch Plate Assembly', 'Swaraj 744', 2, 3, 3800.0, 5100.0), # Low Stock
            ('Diesel Fuel Filter Set', 'Mahindra', 40, 15, 220.0, 350.0),
            ('Diesel Fuel Filter Set', 'Swaraj', 0, 15, 200.0, 320.0), # Out of Stock
            ('Welding Rods Pack (10G)', 'Tata', 18, 5, 450.0, 600.0),
            ('Hydraulic Oil (20L)', 'Castrol', 8, 5, 3800.0, 4800.0),
            ('Air Filter Outer', 'Mahindra Yuvo', 6, 5, 800.0, 1100.0),
            ('Starter Motor Carbon Brush', 'Lucas TVS', 12, 10, 80.0, 150.0),
            ('Headlight Assembly', 'Mahindra', 1, 3, 1200.0, 1650.0), # Low Stock
            ('Brake Shoe Set', 'Swaraj 855', 5, 2, 1100.0, 1500.0)
        ]
        cursor.executemany('''
            INSERT INTO inventory (part_name, brand, quantity, reorder_level, purchase_price, selling_price)
            VALUES (?, ?, ?, ?, ?, ?)
        ''', inventory_data)

    conn.commit()
    conn.close()
    print("Database initialized successfully with rich mock data!")

if __name__ == '__main__':
    init_db()
