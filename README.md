# EventDesk Platform (MongoDB & Mongoose Engine)

Production-grade, multi-tenant community event ticketing and RSVP platform built with Node.js, Express, MongoDB / Mongoose ODM, Passport.js, and EJS.

## Features & Architectural Highlights

1. **Atomic RSVP Engine & Zero-Oversell Guarantee**:
   - Uses Mongoose validation, active document counting, and compound unique indexes (`{ userId: 1, eventId: 1 }`) to eliminate duplicate reservations and guarantee that event capacity quotas are strictly enforced under high concurrency.
2. **Multi-Tenant Security & Privilege Isolation**:
   - Passport.js Local Strategy with salted bcrypt password hashing (10 salt rounds).
   - Strict horizontal privilege escalation prevention: Organizers can only modify or delete self-hosted events. Attempts by unauthorized users trigger immediate HTTP `403 Forbidden` responses.
3. **Dual Content Delivery (Content Negotiation)**:
   - Server-rendered EJS templates for web browser requests (`Accept: text/html`).
   - Clean RESTful JSON payloads for API/CLI requests (`Accept: application/json`).
   - Unsupported media types return HTTP `406 Not Acceptable`.
4. **Memory-Efficient Attendee CSV Streaming ($O(1)$ Heap Footprint)**:
   - Transforms Mongoose MongoDB cursor streams (`Registration.find(...).cursor()`) into RFC 4180 compliant CSV lines via Node.js `stream.Transform` and pipes directly to `res`, keeping memory usage constant regardless of attendee count.
5. **CLI Administration Tooling**:
   - Executable script (`bin/archive-events.js`) parsing `process.argv` flags (e.g. `--before 2026-09-01` or `--days 30`) to batch-archive expired events independently of the web server.

---

## Directory Layout

```
Event Management/
├── bin/
│   ├── archive-events.js      # CLI tool for batch-archiving expired events
│   └── seed-data.js           # CLI script to seed sample organizers & attendees
├── public/
│   └── css/
│       └── style.css          # Glassmorphism responsive CSS stylesheet
├── src/
│   ├── app.js                 # Express application & middleware setup
│   ├── server.js              # Database connection & server entry point
│   ├── config/
│   │   ├── database.js        # Mongoose MongoDB connection manager
│   │   └── passport.js        # Passport.js local authentication strategy
│   ├── controllers/
│   │   ├── authController.js  # Registration, sign-in, and sign-out logic
│   │   ├── eventController.js # Event CRUD, listing, and content negotiation
│   │   └── registrationController.js # Transactional RSVP and CSV stream export
│   ├── middleware/
│   │   ├── auth.js            # Auth guards & multi-tenant ownership check
│   │   ├── csrf.js            # CSRF token generation and validation
│   │   └── errorHandler.js    # Centralized error handler
│   ├── models/                # User, Event, and Registration Mongoose models
│   ├── routes/                # Express modular routing layers
│   └── views/                 # Server-rendered EJS views & reusable partials
├── tests/
│   ├── unit/                  # Model validation unit tests (MongoMemoryServer)
│   └── integration/           # Auth, multi-tenancy, RSVP, and streaming integration tests
└── Procfile                   # Deployment configuration for PaaS platforms
```

---

## Getting Started

### Prerequisites
- **Node.js**: v18.x or higher
- **MongoDB**: Local MongoDB instance (`mongodb://127.0.0.1:27017/eventdesk`) or MongoDB Atlas cluster.
  *(Note: Automated tests run using in-memory MongoDB server (`mongodb-memory-server`) with zero external database dependencies required!)*

### Installation & Execution

1. Install dependencies:
   ```bash
   npm install
   ```

2. Seed database with demo data:
   ```bash
   npm run db:seed
   ```

3. Start development server:
   ```bash
   npm start
   ```

4. Access application at:
   [http://localhost:3000](http://localhost:3000)

---

## CLI Administrative Tools

### Batch Archive Expired Events
```bash
# Archive all events older than today
node bin/archive-events.js

# Archive events older than 30 days
node bin/archive-events.js --days 30

# Archive events prior to a specific date
node bin/archive-events.js --before 2026-09-01
```

---

## Running Test Suite

Execute isolated automated unit & integration test suites using Jest, Supertest & MongoMemoryServer:
```bash
npm test
```

---

## Environment Variables

| Variable | Description | Default |
| :--- | :--- | :--- |
| `PORT` | HTTP Listening Port | `3000` |
| `NODE_ENV` | Runtime Environment (`development`, `test`, `production`) | `development` |
| `SESSION_SECRET` | Secret key for express-session cookie signing | `eventdesk_secret` |
| `MONGODB_URI` | MongoDB Connection URI | `mongodb://127.0.0.1:27017/eventdesk` |
