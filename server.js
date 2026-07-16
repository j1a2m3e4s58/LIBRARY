const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const path = require('path');
const db = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = 'super_secret_library_key';

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Date helper functions
function getLocalDateString(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function addDays(dateStr, days) {
  const date = new Date(dateStr + 'T00:00:00');
  date.setDate(date.getDate() + days);
  return getLocalDateString(date);
}

function getDaysDiff(date1Str, date2Str) {
  const d1 = new Date(date1Str + 'T00:00:00');
  const d2 = new Date(date2Str + 'T00:00:00');
  const diff = d2.getTime() - d1.getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

// Authentication Middleware
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid or expired token' });
    }
    req.user = user;
    next();
  });
}

// Admin only middleware
function requireAdmin(req, res, next) {
  if (req.user && req.user.role === 'admin') {
    next();
  } else {
    res.status(403).json({ error: 'Admin privileges required' });
  }
}

function requireStaff(req, res, next) {
  if (req.user && ['admin', 'librarian'].includes(req.user.role)) return next();
  res.status(403).json({ error: 'Library staff access required' });
}

// --- AUTH ROUTES ---

app.post('/api/auth/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Email or username and password are required' });
  }

  try {
    const user = await db.get('SELECT * FROM users WHERE LOWER(username) = LOWER(?) OR LOWER(email) = LOWER(?)', [username, username]);
    if (!user) {
      return res.status(400).json({ error: 'Invalid username or password' });
    }

    const isPasswordValid = bcrypt.compareSync(password, user.password_hash);
    if (!isPasswordValid) {
      return res.status(400).json({ error: 'Invalid username or password' });
    }
    if (user.phone_verified === 0) {
      return res.status(403).json({ error: 'Please verify your telephone number before signing in.', verificationRequired: true, username: user.username });
    }

    const sessionRole = (user.email || '').toLowerCase().endsWith('.edu.gh') || user.username.toLowerCase() === 'student' ? 'student' : user.role;
    const token = jwt.sign(
      { id: user.id, username: user.username, role: sessionRole },
      JWT_SECRET,
      { expiresIn: '8h' }
    );

    res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        role: sessionRole
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error during login' });
  }
});

// Public staff sign-up. New accounts receive librarian privileges only;
// administrator access remains controlled by an existing administrator.
app.post('/api/auth/signup', async (req, res) => {
  const username = String(req.body.username || '').trim();
  const email = String(req.body.email || '').trim().toLowerCase();
  const password = String(req.body.password || '');
  if (username.length < 3 || password.length < 6 || !/^[^\s@]+@[^\s@]+\.edu\.gh$/i.test(email)) {
    return res.status(400).json({ error: 'Student registration requires a valid .edu.gh academic email, a username, and a 6-character password.' });
  }
  try {
    const existing = await db.get('SELECT id FROM users WHERE LOWER(username) = LOWER(?) OR LOWER(email) = LOWER(?)', [username, email]);
    if (existing) return res.status(409).json({ error: 'That username is already in use.' });
    const passwordHash = bcrypt.hashSync(password, 10);
    const result = await db.run('INSERT INTO users (username, email, password_hash, role, phone_verified) VALUES (?, ?, ?, ?, 0)', [username, email, passwordHash, 'librarian']);
    res.status(201).json({ id: result.id, username, email, role: 'student' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not create the account.' });
  }
});

app.post('/api/auth/phone/start', async (req, res) => {
  const username = String(req.body.username || '').trim();
  const phone = String(req.body.phone || '').replace(/\s+/g, '');
  if (!/^\+?[0-9]{9,15}$/.test(phone)) return res.status(400).json({ error: 'Enter a valid telephone number.' });
  try {
    const user = await db.get('SELECT id FROM users WHERE LOWER(username) = LOWER(?)', [username]);
    if (!user) return res.status(404).json({ error: 'Account not found.' });
    const used = await db.get('SELECT id FROM users WHERE phone = ? AND id != ?', [phone, user.id]);
    if (used) return res.status(409).json({ error: 'That telephone number is already registered.' });
    await db.run('UPDATE users SET phone = ?, phone_verified = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [phone, user.id]);
    res.json({ message: 'Verification code sent.', demoCode: '1234' });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Could not save the telephone number.' }); }
});

app.post('/api/auth/phone/confirm', async (req, res) => {
  const username = String(req.body.username || '').trim();
  if (String(req.body.token || '') !== '1234') return res.status(400).json({ error: 'Incorrect verification code.' });
  const result = await db.run('UPDATE users SET phone_verified = 1, updated_at = CURRENT_TIMESTAMP WHERE LOWER(username) = LOWER(?) AND phone IS NOT NULL', [username]);
  if (!result.changes) return res.status(404).json({ error: 'Account or telephone number not found.' });
  res.json({ message: 'Telephone number verified.' });
});

app.post('/api/auth/password/request', async (req, res) => {
  const phone = String(req.body.phone || '').replace(/\s+/g, '');
  const user = await db.get('SELECT id FROM users WHERE phone = ? AND phone_verified = 1', [phone]);
  if (!user) return res.status(404).json({ error: 'No verified account uses that telephone number.' });
  res.json({ message: 'Reset code sent.', demoCode: '1234' });
});

app.post('/api/auth/password/reset', async (req, res) => {
  const phone = String(req.body.phone || '').replace(/\s+/g, '');
  const password = String(req.body.password || '');
  if (String(req.body.token || '') !== '1234') return res.status(400).json({ error: 'Incorrect reset code.' });
  if (password.length < 6) return res.status(400).json({ error: 'Password must contain at least 6 characters.' });
  const passwordHash = bcrypt.hashSync(password, 10);
  const result = await db.run('UPDATE users SET password_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE phone = ? AND phone_verified = 1', [passwordHash, phone]);
  if (!result.changes) return res.status(404).json({ error: 'Verified account not found.' });
  res.json({ message: 'Password reset successfully.' });
});

app.get('/api/auth/me', authenticateToken, async (req, res) => {
  try {
    const user = await db.get('SELECT id, username, role FROM users WHERE id = ?', [req.user.id]);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json(user);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error fetching session user' });
  }
});

app.post('/api/auth/register-librarian', authenticateToken, requireAdmin, async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required' });
  }

  try {
    const existing = await db.get('SELECT id FROM users WHERE username = ?', [username]);
    if (existing) {
      return res.status(400).json({ error: 'Username is already taken' });
    }

    const passwordHash = bcrypt.hashSync(password, 10);
    await db.run(
      'INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)',
      [username, passwordHash, 'librarian']
    );

    res.status(201).json({ message: 'Librarian account created successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error registering librarian' });
  }
});

// --- BOOK ROUTES ---

app.get('/api/books', authenticateToken, async (req, res) => {
  const search = req.query.search;
  try {
    let query = 'SELECT * FROM books';
    let params = [];

    if (search) {
      query += ' WHERE title LIKE ? OR author LIKE ? OR isbn LIKE ? OR category LIKE ?';
      const searchParam = `%${search}%`;
      params = [searchParam, searchParam, searchParam, searchParam];
    }

    const books = await db.all(query, params);
    res.json(books);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to retrieve books' });
  }
});

app.post('/api/books', authenticateToken, requireStaff, async (req, res) => {
  const { title, author, isbn, category, publisher, year_published, total_copies } = req.body;

  if (!title || !author || !isbn || !category || !publisher || !year_published || total_copies === undefined) {
    return res.status(400).json({ error: 'All fields are required' });
  }

  const copies = parseInt(total_copies);
  const year = parseInt(year_published);

  if (isNaN(copies) || copies <= 0) {
    return res.status(400).json({ error: 'Total copies must be a positive number' });
  }
  if (isNaN(year) || year <= 0) {
    return res.status(400).json({ error: 'Year published must be a valid year' });
  }

  try {
    const existing = await db.get('SELECT id FROM books WHERE isbn = ?', [isbn]);
    if (existing) {
      return res.status(400).json({ error: 'A book with this ISBN already exists' });
    }

    await db.run(
      `INSERT INTO books (title, author, isbn, category, publisher, year_published, total_copies, available_copies)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [title, author, isbn, category, publisher, year, copies, copies]
    );

    res.status(201).json({ message: 'Book added successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to add book' });
  }
});

app.put('/api/books/:id', authenticateToken, requireStaff, async (req, res) => {
  const bookId = req.params.id;
  const { title, author, isbn, category, publisher, year_published, total_copies } = req.body;

  if (!title || !author || !isbn || !category || !publisher || !year_published || total_copies === undefined) {
    return res.status(400).json({ error: 'All fields are required' });
  }

  const copies = parseInt(total_copies);
  const year = parseInt(year_published);

  if (isNaN(copies) || copies <= 0) {
    return res.status(400).json({ error: 'Total copies must be a positive number' });
  }
  if (isNaN(year) || year <= 0) {
    return res.status(400).json({ error: 'Year published must be a valid year' });
  }

  try {
    const book = await db.get('SELECT * FROM books WHERE id = ?', [bookId]);
    if (!book) {
      return res.status(404).json({ error: 'Book not found' });
    }

    const existingIsbn = await db.get('SELECT id FROM books WHERE isbn = ? AND id != ?', [isbn, bookId]);
    if (existingIsbn) {
      return res.status(400).json({ error: 'A book with this ISBN already exists' });
    }

    const borrowedCopies = book.total_copies - book.available_copies;
    if (copies < borrowedCopies) {
      return res.status(400).json({
        error: `Cannot reduce total copies below currently borrowed copies (${borrowedCopies} currently borrowed)`
      });
    }

    const newAvailable = copies - borrowedCopies;

    await db.run(
      `UPDATE books SET title = ?, author = ?, isbn = ?, category = ?, publisher = ?, year_published = ?, total_copies = ?, available_copies = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [title, author, isbn, category, publisher, year, copies, newAvailable, bookId]
    );

    res.json({ message: 'Book updated successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update book' });
  }
});

app.delete('/api/books/:id', authenticateToken, requireStaff, async (req, res) => {
  const bookId = req.params.id;
  try {
    const book = await db.get('SELECT * FROM books WHERE id = ?', [bookId]);
    if (!book) {
      return res.status(404).json({ error: 'Book not found' });
    }

    if (book.available_copies < book.total_copies) {
      return res.status(400).json({ error: 'Cannot delete book: some copies are currently issued to members' });
    }

    await db.run('DELETE FROM books WHERE id = ?', [bookId]);
    res.json({ message: 'Book deleted successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete book' });
  }
});

// --- MEMBER ROUTES ---

app.get('/api/members', authenticateToken, async (req, res) => {
  const search = req.query.search;
  try {
    let query = 'SELECT * FROM members';
    let params = [];

    if (search) {
      query += ' WHERE name LIKE ? OR member_code LIKE ? OR email LIKE ?';
      const searchParam = `%${search}%`;
      params = [searchParam, searchParam, searchParam];
    }

    const members = await db.all(query, params);
    res.json(members);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to retrieve members' });
  }
});

app.post('/api/members', authenticateToken, requireStaff, async (req, res) => {
  const { name, email, phone, member_code } = req.body;

  if (!name || !email || !phone || !member_code) {
    return res.status(400).json({ error: 'All fields are required' });
  }

  try {
    const existingCode = await db.get('SELECT id FROM members WHERE member_code = ?', [member_code]);
    if (existingCode) {
      return res.status(400).json({ error: 'A member with this Code/ID already exists' });
    }

    const existingEmail = await db.get('SELECT id FROM members WHERE email = ?', [email]);
    if (existingEmail) {
      return res.status(400).json({ error: 'A member with this email already exists' });
    }

    await db.run(
      'INSERT INTO members (name, email, phone, member_code, status) VALUES (?, ?, ?, ?, ?)',
      [name, email, phone, member_code, 'active']
    );

    res.status(201).json({ message: 'Member registered successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to register member' });
  }
});

app.put('/api/members/:id', authenticateToken, requireStaff, async (req, res) => {
  const memberId = req.params.id;
  const { name, email, phone, member_code, status } = req.body;

  if (!name || !email || !phone || !member_code || !status) {
    return res.status(400).json({ error: 'All fields are required' });
  }

  if (status !== 'active' && status !== 'suspended') {
    return res.status(400).json({ error: "Status must be either 'active' or 'suspended'" });
  }

  try {
    const member = await db.get('SELECT * FROM members WHERE id = ?', [memberId]);
    if (!member) {
      return res.status(404).json({ error: 'Member not found' });
    }

    const existingCode = await db.get('SELECT id FROM members WHERE member_code = ? AND id != ?', [member_code, memberId]);
    if (existingCode) {
      return res.status(400).json({ error: 'A member with this Code/ID already exists' });
    }

    const existingEmail = await db.get('SELECT id FROM members WHERE email = ? AND id != ?', [email, memberId]);
    if (existingEmail) {
      return res.status(400).json({ error: 'A member with this email already exists' });
    }

    await db.run(
      `UPDATE members SET name = ?, email = ?, phone = ?, member_code = ?, status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [name, email, phone, member_code, status, memberId]
    );

    res.json({ message: 'Member updated successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update member' });
  }
});

app.delete('/api/members/:id', authenticateToken, requireStaff, async (req, res) => {
  const memberId = req.params.id;
  try {
    const member = await db.get('SELECT * FROM members WHERE id = ?', [memberId]);
    if (!member) {
      return res.status(404).json({ error: 'Member not found' });
    }

    const activeBorrows = await db.get('SELECT id FROM borrow_records WHERE member_id = ? AND return_date IS NULL', [memberId]);
    if (activeBorrows) {
      return res.status(400).json({ error: 'Cannot delete member: they have active borrowed books' });
    }

    await db.run('DELETE FROM members WHERE id = ?', [memberId]);
    res.json({ message: 'Member deleted successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete member' });
  }
});

// --- BORROWING ROUTES ---

app.post('/api/borrow', authenticateToken, requireStaff, async (req, res) => {
  const { book_id, member_id, days } = req.body;
  if (!book_id || !member_id) {
    return res.status(400).json({ error: 'Book ID and Member ID are required' });
  }

  const durationDays = parseInt(days) || 14;

  try {
    const book = await db.get('SELECT * FROM books WHERE id = ?', [book_id]);
    if (!book) {
      return res.status(404).json({ error: 'Book not found' });
    }

    if (book.available_copies <= 0) {
      return res.status(400).json({ error: 'No copies available for borrowing' });
    }

    const member = await db.get('SELECT * FROM members WHERE id = ?', [member_id]);
    if (!member) {
      return res.status(404).json({ error: 'Member not found' });
    }

    if (member.status !== 'active') {
      return res.status(400).json({ error: 'Member account is currently suspended' });
    }

    const activeBorrow = await db.get(
      'SELECT id FROM borrow_records WHERE member_id = ? AND book_id = ? AND return_date IS NULL',
      [member_id, book_id]
    );
    if (activeBorrow) {
      return res.status(400).json({ error: 'Member is already borrowing an active copy of this book' });
    }

    const issueDateStr = getLocalDateString();
    const dueDateStr = addDays(issueDateStr, durationDays);

    // Write transactionally
    await db.run('UPDATE books SET available_copies = available_copies - 1 WHERE id = ?', [book_id]);
    await db.run(
      'INSERT INTO borrow_records (book_id, member_id, issue_date, due_date, status) VALUES (?, ?, ?, ?, ?)',
      [book_id, member_id, issueDateStr, dueDateStr, 'issued']
    );

    res.status(201).json({ message: 'Book issued successfully', due_date: dueDateStr });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to issue book' });
  }
});

app.post('/api/borrow/return/:id', authenticateToken, async (req, res) => {
  const borrowId = req.params.id;

  try {
    const borrowRecord = await db.get('SELECT * FROM borrow_records WHERE id = ?', [borrowId]);
    if (!borrowRecord) {
      return res.status(404).json({ error: 'Borrow record not found' });
    }

    if (borrowRecord.return_date) {
      return res.status(400).json({ error: 'Book has already been returned' });
    }

    const returnDateStr = getLocalDateString();

    // Load fine rate
    const fineRateSetting = await db.get("SELECT value FROM settings WHERE key = 'fine_rate'");
    const fineRate = parseFloat(fineRateSetting ? fineRateSetting.value : '2.00');

    // Calculate fine
    let fineAmount = 0;
    const daysOverdue = getDaysDiff(borrowRecord.due_date, returnDateStr);

    if (daysOverdue > 0) {
      fineAmount = daysOverdue * fineRate;
    }

    // Write updates
    await db.run('UPDATE books SET available_copies = available_copies + 1 WHERE id = ?', [borrowRecord.book_id]);
    await db.run(
      'UPDATE borrow_records SET return_date = ?, status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [returnDateStr, 'returned', borrowId]
    );

    if (fineAmount > 0) {
      await db.run(
        'INSERT INTO fines (borrow_record_id, amount, paid) VALUES (?, ?, ?)',
        [borrowId, fineAmount, 0]
      );
    }

    res.json({
      message: 'Book returned successfully',
      return_date: returnDateStr,
      fine_accrued: fineAmount
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to return book' });
  }
});

app.post('/api/borrow/renew/:id', authenticateToken, async (req, res) => {
  const borrowId = req.params.id;

  try {
    const record = await db.get('SELECT * FROM borrow_records WHERE id = ?', [borrowId]);
    if (!record) {
      return res.status(404).json({ error: 'Borrow record not found' });
    }

    if (record.return_date) {
      return res.status(400).json({ error: 'Cannot renew a book that has already been returned' });
    }

    if (record.renewed_count >= 3) {
      return res.status(400).json({ error: 'Maximum renewal limit (3 times) reached for this item' });
    }

    const newDueDate = addDays(record.due_date, 14);

    await db.run(
      'UPDATE borrow_records SET due_date = ?, renewed_count = renewed_count + 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [newDueDate, borrowId]
    );

    res.json({ message: 'Renewal successful', new_due_date: newDueDate });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to renew book' });
  }
});

app.get('/api/borrow/active', authenticateToken, async (req, res) => {
  try {
    const active = await db.all(`
      SELECT 
        br.id, br.book_id, br.member_id, br.issue_date, br.due_date, br.renewed_count,
        b.title as book_title, b.author as book_author, b.isbn as book_isbn,
        m.name as member_name, m.member_code
      FROM borrow_records br
      JOIN books b ON br.book_id = b.id
      JOIN members m ON br.member_id = m.id
      WHERE br.return_date IS NULL
      ORDER BY br.due_date ASC
    `);

    // Load fine rate setting for dynamic calculation
    const fineRateSetting = await db.get("SELECT value FROM settings WHERE key = 'fine_rate'");
    const fineRate = parseFloat(fineRateSetting ? fineRateSetting.value : '2.00');
    const todayStr = getLocalDateString();

    const result = active.map(item => {
      const daysOverdue = getDaysDiff(item.due_date, todayStr);
      const isOverdue = daysOverdue > 0;
      const accruedFine = isOverdue ? (daysOverdue * fineRate) : 0;
      return {
        ...item,
        is_overdue: isOverdue,
        days_overdue: isOverdue ? daysOverdue : 0,
        pending_fine: accruedFine
      };
    });

    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load active borrowings' });
  }
});

app.get('/api/borrow/history', authenticateToken, async (req, res) => {
  try {
    const history = await db.all(`
      SELECT 
        br.id, br.book_id, br.member_id, br.issue_date, br.due_date, br.return_date, br.renewed_count,
        b.title as book_title, b.isbn as book_isbn,
        m.name as member_name, m.member_code,
        f.amount as fine_amount, f.paid as fine_paid
      FROM borrow_records br
      JOIN books b ON br.book_id = b.id
      JOIN members m ON br.member_id = m.id
      LEFT JOIN fines f ON f.borrow_record_id = br.id
      WHERE br.return_date IS NOT NULL
      ORDER BY br.return_date DESC
    `);
    res.json(history);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to retrieve borrow history' });
  }
});

// --- FINE ROUTES ---

app.get('/api/fines', authenticateToken, async (req, res) => {
  try {
    const fines = await db.all(`
      SELECT 
        f.id, f.borrow_record_id, f.amount, f.paid, f.paid_date, f.created_at as charged_date,
        b.title as book_title,
        m.name as member_name, m.member_code
      FROM fines f
      JOIN borrow_records br ON f.borrow_record_id = br.id
      JOIN books b ON br.book_id = b.id
      JOIN members m ON br.member_id = m.id
      ORDER BY f.paid ASC, f.created_at DESC
    `);
    res.json(fines);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to retrieve fines list' });
  }
});

app.post('/api/fines/pay/:id', authenticateToken, async (req, res) => {
  const fineId = req.params.id;
  const payDate = getLocalDateString();
  try {
    const fine = await db.get('SELECT * FROM fines WHERE id = ?', [fineId]);
    if (!fine) {
      return res.status(404).json({ error: 'Fine record not found' });
    }

    if (fine.paid) {
      return res.status(400).json({ error: 'Fine is already paid' });
    }

    await db.run(
      'UPDATE fines SET paid = 1, paid_date = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [payDate, fineId]
    );

    res.json({ message: 'Fine payment recorded successfully', paid_date: payDate });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to complete payment' });
  }
});

// --- SETTINGS ROUTES ---

app.get('/api/settings', authenticateToken, async (req, res) => {
  try {
    const settings = await db.all('SELECT key, value FROM settings');
    const result = {};
    settings.forEach(s => {
      result[s.key] = s.value;
    });
    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to retrieve settings' });
  }
});

app.post('/api/settings', authenticateToken, requireAdmin, async (req, res) => {
  const { fine_rate } = req.body;
  if (fine_rate === undefined) {
    return res.status(400).json({ error: 'Fine rate value is required' });
  }

  const rate = parseFloat(fine_rate);
  if (isNaN(rate) || rate < 0) {
    return res.status(400).json({ error: 'Fine rate must be a positive number' });
  }

  try {
    await db.run(
      "INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES ('fine_rate', ?, CURRENT_TIMESTAMP)",
      [rate.toFixed(2)]
    );
    res.json({ message: 'Settings updated successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update settings' });
  }
});

// --- REPORTS & DASHBOARD ROUTE ---

app.get('/api/reports/dashboard', authenticateToken, async (req, res) => {
  try {
    // 1. Total inventory of copies
    const booksStat = await db.get('SELECT SUM(total_copies) as total, SUM(available_copies) as available FROM books');
    const totalBooks = booksStat.total || 0;
    const availableBooks = booksStat.available || 0;
    const borrowedBooks = totalBooks - availableBooks;

    // 2. Total members
    const membersStat = await db.get('SELECT COUNT(*) as count FROM members');
    const totalMembers = membersStat.count || 0;

    // 3. Overdue calculations
    const activeBorrows = await db.all('SELECT due_date FROM borrow_records WHERE return_date IS NULL');
    const todayStr = getLocalDateString();
    let overdueBooksCount = 0;
    activeBorrows.forEach(b => {
      if (getDaysDiff(b.due_date, todayStr) > 0) {
        overdueBooksCount++;
      }
    });

    // 4. Fine calculations
    const unpaidFinesStat = await db.get('SELECT SUM(amount) as sum FROM fines WHERE paid = 0');
    const paidFinesStat = await db.get('SELECT SUM(amount) as sum FROM fines WHERE paid = 1');

    res.json({
      total_books: totalBooks,
      available_books: availableBooks,
      borrowed_books: borrowedBooks,
      overdue_books: overdueBooksCount,
      total_members: totalMembers,
      total_unpaid_fines: unpaidFinesStat.sum || 0,
      total_paid_fines: paidFinesStat.sum || 0
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load report dashboard data' });
  }
});

// Initialize DB and launch server
db.initDatabase()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Server is running on port ${PORT}`);
    });
  })
  .catch(err => {
    console.error('Failed to initialize database:', err);
    process.exit(1);
  });
