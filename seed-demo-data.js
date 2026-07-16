const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('library.db');

db.serialize(() => {
  db.run("UPDATE users SET email='admin@knowledgehub.local' WHERE username='admin'");
  db.run("UPDATE users SET email='librarian@knowledgehub.local' WHERE username='librarian'");
  db.run("UPDATE users SET email='student@ug.edu.gh' WHERE username='student'");
  db.get('SELECT COUNT(*) AS count FROM borrow_records', (error, existing) => {
    if (error) throw error;
    if (existing.count) {
      console.log(JSON.stringify({ seeded: false, existingLoans: existing.count }));
      return db.close();
    }
    db.all('SELECT id FROM books WHERE total_copies > available_copies LIMIT 5', (bookError, books) => {
      if (bookError) throw bookError;
      db.all('SELECT id FROM members ORDER BY id LIMIT 3', (memberError, members) => {
        if (memberError) throw memberError;
        const rows = [
          [books[0].id, members[0].id, '2026-07-05', '2026-07-19', null, 'issued'],
          [books[1].id, members[1].id, '2026-07-01', '2026-07-14', null, 'issued'],
          [books[2].id, members[2].id, '2026-07-09', '2026-07-23', null, 'issued'],
          [books[3].id, members[0].id, '2026-06-20', '2026-07-04', '2026-07-03', 'returned'],
          [books[4].id, members[1].id, '2026-06-22', '2026-07-06', '2026-07-10', 'returned']
        ];
        const statement = db.prepare('INSERT INTO borrow_records (book_id, member_id, issue_date, due_date, return_date, status) VALUES (?, ?, ?, ?, ?, ?)');
        const ids = [];
        rows.forEach((row, index) => statement.run(row, function onInsert(insertError) {
          if (insertError) throw insertError;
          ids[index] = this.lastID;
        }));
        statement.finalize(() => {
          db.run('INSERT INTO fines (borrow_record_id, amount, paid, paid_date) VALUES (?, ?, 1, ?)', [ids[3], 6, '2026-07-03']);
          db.run('INSERT INTO fines (borrow_record_id, amount, paid) VALUES (?, ?, 0)', [ids[4], 8], () => {
            console.log(JSON.stringify({ seeded: true, loans: rows.length, fines: 2 }));
            db.close();
          });
        });
      });
    });
  });
});
