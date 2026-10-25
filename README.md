# Mini Task Manager with Audit Log

Aplikasi manajemen task sederhana untuk tim internal dengan audit trail yang mencatat riwayat perubahan status task secara kronologis dan tidak dapat diubah (immutable).

---

## 1. Quick Start

### Prerequisites
- Node.js (v18+ recommended)
- npm (v9+)

### Cara Menjalankan

#### A. Backend
```bash
cd backend
npm install
npm run dev
```
Backend berjalan di: `http://localhost:3001`
Untuk menjalankan automated test:
```bash
npm test
```

#### B. Frontend
```bash
cd frontend
npm install
npm run dev
```
Frontend berjalan di: `http://localhost:5173` (otomatis mem-proxy `/api` ke backend `http://localhost:3001`).

---

## 2. Arsitektur Solusi

```
[ Frontend: React + TS (Vite) ]
      │  HTTP REST (JSON)
      ▼
[ Backend: Node.js + Express + TS ]
      ├── Domain State Machine (Strict: to_do -> pending -> in_progress -> done)
      └── Persistence Layer (Atomic writes & Append-only Audit Logs)
            └── data/tasks.json (or SQLite)
```

- **Frontend (`/frontend`)**:
  - React + TypeScript tanpa state manager berat (Redux/Zustand dihindari karena local state + custom fetch function sudah cukup).
  - Actor selector dropdown di header untuk mensimulasikan user yang sedang login (`john.doe`, `jane.smith`, `alice.wong`, `bob.chen`).
  - Strict UI Action: Tombol aksi status hanya menawarkan transisi status berikutnya sesuai alur domain.
  - Audit Log viewer modal yang menampilkan riwayat kronologis per task.

- **Backend (`/backend`)**:
  - Express.js + TypeScript dengan pemisahan type definitions (`types.ts`), validasi state machine (`stateMachine.ts`), database abstraction (`db.ts`), dan route handler (`server.ts`).
  - **Atomic Transaction & Consistency**: Saat task status berubah, penulisan status baru pada task dan penambahan audit log baru dieksekusi secara atomic. Jika salah satu gagal, seluruh operasi batal.
  - **Strict Domain Validation**: Menolak transisi status di luar urutan:
    `to_do` ➔ `pending` ➔ `in_progress` ➔ `done`.
  - **Idempotency**: Jika status tujuan sama dengan status saat ini, backend mengembalikan status 200 dengan flag `unchanged: true` tanpa membuat audit log duplikat.
  - **Audit Log Immutability**: Tidak ada endpoint `PUT/PATCH/DELETE` untuk audit logs. Penghapusan task (`DELETE /api/tasks/:id`) tetap mempertahankan audit log historis demi keperluan compliance/traceability.

---

## 3. Asumsi dan Trade-Off

### Asumsi:
1. **User Authentication**: Sistem diasumsikan sebagai prototipe internal. Tidak ada mekanisme login/JWT; actor dipilih melalui dropdown predefined users (`GET /api/users`).
2. **Alur Status Linear**: Task hanya bergerak satu arah (`to_do` ➔ `pending` ➔ `in_progress` ➔ `done`). Task yang sudah `done` bersifat final dan tidak dapat diubah kembali.
3. **Audit Log Persistence**: Menghapus task dari daftar aktif tidak menghapus rekam jejak audit log yang telah terjadi.

### Trade-Off:
1. **File-based JSON / SQLite vs Distributed DB (PostgreSQL)**:
   - *Pilihan*: File-based atomic JSON / SQLite.
   - *Kelebihan*: Zero installation/dependencies luar, mudah dievaluasi reviewer, ACID/atomic writes via temp file replacement atau SQLite transactions.
   - *Trade-off*: Tidak optimal untuk horizontal scaling multi-server tanpa shared storage.
2. **Synchronous Audit Logging vs Event-Driven (Message Broker)**:
   - *Pilihan*: Menulis audit log langsung di dalam satu transaksi synchronous bersama task update.
   - *Kelebihan*: Menjamin konsistensi data kuat (Strong Consistency) tanpa risiko race condition data belum ter-sync.
   - *Trade-off*: Waktu response API sedikit bertambah seiring bertambahnya I/O audit log.

---

## 4. Jawaban Evaluasi Teknis

### 1. Bagaimana kamu memastikan audit log tidak ter-modifikasi?
1. **No Mutation Endpoints**: Di level API, tidak disediakan endpoint `PUT`, `PATCH`, atau `DELETE` untuk resource `/audit-logs`. Hanya ada `GET /api/tasks/:id/audit-logs`.
2. **Append-Only Storage Pattern**: Di level layer database, operasi audit log hanya berupa `INSERT`/`push`. Operasi update dan delete task dilarang memanipulasi baris audit log yang sudah tercatat.
3. **Database Constraints (Production)**: Pada database relasional seperti PostgreSQL, kita dapat mencabut hak akses `UPDATE` dan `DELETE` dari role aplikasi untuk tabel `audit_logs` (`REVOKE UPDATE, DELETE ON audit_logs FROM app_user`), atau memasang trigger `BEFORE UPDATE OR DELETE ON audit_logs` yang melempar exception jika ada upaya modifikasi.
4. **Cryptographic Chaining (Tamper-evident)**: Menyimpan hash dari log sebelumnya (seperti chain SHA-256) pada setiap row audit log baru sehingga jika ada data lama yang dimanipulasi, verifikasi hash chain akan invalid.

### 2. Bagian mana dari solusi ini yang paling berisiko jika digunakan oleh banyak user?
**Operasi `PATCH /api/tasks/:id/status` (Concurrency & Race Condition)**:
- Jika dua user melakukan update status task yang sama di waktu yang nyaris bersamaan (misal User A mengubah `to_do` ➔ `pending`, dan User B mencoba mengubah `to_do` ➔ `pending`), tanpa concurrency control bisa terjadi race condition: status log tercatat ganda atau terjadi desinkronisasi antara status aktual task dan histori log.
- Pada skala multi-request, file locking (pada JSON/SQLite) akan mengalami write contention bottleneck.
- **Mitigasi**: Menerapkan **Optimistic Locking** menggunakan kolom `version` (misal: `UPDATE tasks SET status = :new, version = version + 1 WHERE id = :id AND version = :current_version`). Jika version tidak cocok, kembalikan HTTP 409 Conflict.

### 3. Jika task ini berkembang menjadi sistem besar, bagian mana yang akan kamu refactor terlebih dahulu dan kenapa?
1. **Pemisahan Audit Logging ke Asynchronous Event Stream (Event-Driven Architecture)**:
   - *Alasan*: Menulis audit log secara synchronous ke database utama memperlambat throughput sistem dan memperbesar beban write pada database operasional.
   - *Solusi Refactor*: Menggunakan message broker seperti Apache Kafka / AWS SQS / RabbitMQ. Saat status task berubah, backend mem-publish event `TaskStatusChangedEvent`. Service audit log terpisah mengonsumsi event tersebut dan menyimpannya ke storage khusus time-series atau data lake (misal: Elasticsearch, ClickHouse, atau DynamoDB).
2. **Migrasi Database ke RDBMS dengan Connection Pooling**:
   - Memindahkan data store dari local file/SQLite ke PostgreSQL dengan setup read-replica dan connection pooler (seperti PgBouncer).
3. **Autentikasi & Autorisasi (RBAC)**:
   - Mengganti actor dropdown dengan JWT Authentication berbasis session terverifikasi, serta audit log mencatat actor ID, IP address, user-agent, dan geolocation.

### 4. Penggunaan AI & Validasi
- **Bagian yang dibantu AI**:
  - Scaffolding konfigurasi awal TypeScript & CSS styling minimalis.
  - Pembuatan boilerplate test assertions pada `taskFlow.test.ts`.
- **Cara Validasi**:
  - Meninjau secara manual setiap logika bisnis pada `stateMachine.ts` dan `db.ts` untuk memastikan alur status `to_do` -> `pending` -> `in_progress` -> `done` tidak bisa dilewati.
  - Menguji kasus idempotency (mengirim status yang sama berulang kali) dan memastikan tidak ada log ganda.
  - Memverifikasi endpoint error handling ketika actor kosong atau format request tidak valid.

---

## 5. API Reference

| Method | Endpoint | Deskripsi |
|---|---|---|
| `GET` | `/api/users` | Mendapatkan daftar predefined actors |
| `GET` | `/api/tasks` | Mendapatkan semua task (urutan terbaru) |
| `POST` | `/api/tasks` | Membuat task baru (status awal `to_do`) |
| `PATCH` | `/api/tasks/:id/status` | Mengubah status task (strict sequence, idempotent) |
| `DELETE` | `/api/tasks/:id` | Menghapus task (audit logs tetap disimpan) |
| `GET` | `/api/tasks/:id/audit-logs` | Mendapatkan audit log kronologis per task |
