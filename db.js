const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const bcrypt = require('bcryptjs');

const dbPath = path.resolve(__dirname, 'library.db');
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Could not connect to database', err);
  } else {
    console.log('Connected to SQLite database at:', dbPath);
  }
});

// Promise-based wrappers
const run = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) reject(err);
      else resolve({ id: this.lastID, changes: this.changes });
    });
  });
};

const get = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
};

const all = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
};

// Initialize schema and seed data
async function initDatabase() {
  // 1. Users Table
  await run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL CHECK(role IN ('admin', 'librarian')),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  // Backward-compatible account recovery fields for existing databases.
  const userColumns = await all('PRAGMA table_info(users)');
  if (!userColumns.some(column => column.name === 'phone')) {
    await run('ALTER TABLE users ADD COLUMN phone TEXT');
  }
  if (!userColumns.some(column => column.name === 'email')) {
    await run('ALTER TABLE users ADD COLUMN email TEXT');
  }
  if (!userColumns.some(column => column.name === 'phone_verified')) {
    await run('ALTER TABLE users ADD COLUMN phone_verified INTEGER NOT NULL DEFAULT 1');
  }

  // 2. Books Table
  await run(`CREATE TABLE IF NOT EXISTS books (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    author TEXT NOT NULL,
    isbn TEXT UNIQUE NOT NULL,
    category TEXT NOT NULL,
    publisher TEXT NOT NULL,
    year_published INTEGER NOT NULL,
    total_copies INTEGER NOT NULL DEFAULT 1,
    available_copies INTEGER NOT NULL DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  // 3. Members Table
  await run(`CREATE TABLE IF NOT EXISTS members (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    member_code TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    phone TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'suspended')),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  // 4. Borrow Records Table
  await run(`CREATE TABLE IF NOT EXISTS borrow_records (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    book_id INTEGER NOT NULL,
    member_id INTEGER NOT NULL,
    issue_date DATETIME DEFAULT CURRENT_TIMESTAMP,
    due_date DATETIME NOT NULL,
    return_date DATETIME,
    status TEXT NOT NULL DEFAULT 'issued' CHECK(status IN ('issued', 'returned')),
    renewed_count INTEGER NOT NULL DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(book_id) REFERENCES books(id),
    FOREIGN KEY(member_id) REFERENCES members(id)
  )`);

  // 5. Fines Table
  await run(`CREATE TABLE IF NOT EXISTS fines (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    borrow_record_id INTEGER NOT NULL,
    amount REAL NOT NULL,
    paid INTEGER NOT NULL DEFAULT 0 CHECK(paid IN (0, 1)),
    paid_date DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(borrow_record_id) REFERENCES borrow_records(id)
  )`);

  // 6. Settings Table
  await run(`CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  // Seed settings (initial fine rate GHS 2.00)
  const fineRateSetting = await get("SELECT * FROM settings WHERE key = 'fine_rate'");
  if (!fineRateSetting) {
    await run("INSERT INTO settings (key, value) VALUES ('fine_rate', '2.00')");
    console.log("Seeded default fine rate setting (GHS 2.00/day)");
  }

  // Seed default admin and librarian
  const adminUser = await get("SELECT * FROM users WHERE username = 'admin'");
  if (!adminUser) {
    const adminHash = bcrypt.hashSync('admin123', 10);
    await run(
      "INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)",
      ['admin', adminHash, 'admin']
    );
    console.log("Seeded default admin account (username: admin, password: admin123)");
  }

  const librarianUser = await get("SELECT * FROM users WHERE username = 'librarian'");
  if (!librarianUser) {
    const librarianHash = bcrypt.hashSync('lib123', 10);
    await run(
      "INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)",
      ['librarian', librarianHash, 'librarian']
    );
    console.log("Seeded default librarian account (username: librarian, password: lib123)");
  }

  // Seed default books catalog
  const booksCount = await get("SELECT COUNT(*) as count FROM books");
  if (booksCount.count === 0) {
    const defaultBooks = [
      ['Introduction to Algorithms', 'Thomas H. Cormen', '9780262033848', 'Computer Science', 'MIT Press', 2009, 5, 5],
      ['A Brief History of Time', 'Stephen Hawking', '9780553380163', 'Science', 'Bantam Books', 1998, 3, 3],
      ['Calculus', 'Michael Spivak', '9780914098911', 'Mathematics', 'Publish or Perish', 2008, 2, 2],
      ['To Kill a Mockingbird', 'Harper Lee', '9780446310789', 'Literature', 'Grand Central Publishing', 1988, 4, 4]
    ];
    for (const b of defaultBooks) {
      await run(
        "INSERT INTO books (title, author, isbn, category, publisher, year_published, total_copies, available_copies) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        b
      );
    }
    console.log("Seeded default books catalog.");
  }

  // Seed default library members
  const membersCount = await get("SELECT COUNT(*) as count FROM members");
  if (membersCount.count === 0) {
    const defaultMembers = [
      ['MEM001', 'Kofi Mensah', 'kofi@example.com', '+233241234567', 'active'],
      ['MEM002', 'Ama Serwaa', 'ama@example.com', '+233247654321', 'active'],
      ['MEM003', 'Kwame Boateng', 'kwame@example.com', '+233249998887', 'active']
    ];
    for (const m of defaultMembers) {
      await run(
        "INSERT INTO members (member_code, name, email, phone, status) VALUES (?, ?, ?, ?, ?)",
        m
      );
    }
    console.log("Seeded default library members.");
  }
}

module.exports = {
  db,
  run,
  get,
  all,
  initDatabase
};
