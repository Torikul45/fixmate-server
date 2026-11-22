# FixMate – Backend Server

FixMate is a Smart Device & Home Appliance Repair Service Platform backend. It provides APIs for managing users, repair services, bookings, technicians, and payments.

## Technologies Used

- Node.js
- Express.js
- MongoDB
- Better Auth
- JSON Web Token (JWT)
- Stripe Payment Gateway

## Key Features

- Secure authentication and token verification
- Role-based authorization for Admin, Technician, and Customer
- Repair service management
- Booking creation and management
- Technician booking assignment and status updates
- Stripe checkout and payment verification
- Payment history management
- Payment webhook idempotency protection
- MongoDB database integration

## Environment Variables

Create a `.env` file in the server root directory and configure:

```env
PORT=5000
MONGODB_URI=your_mongodb_connection_string
DB_NAME=your_database_name
BETTER_AUTH_URL=http://localhost:3000
CLIENT_URL=http://localhost:3000
STRIPE_SECRET_KEY=your_stripe_secret_key
STRIPE_WEBHOOK_SECRET=your_stripe_webhook_secret
```

Never commit your actual `.env` file or secret keys to GitHub.

## Installation & Setup

1. Clone the repository:

```bash
git clone https://github.com/Torikul45/fixmate-server.git
```

2. Go to the project directory:

```bash
cd fixmate-server
```

3. Install dependencies:

```bash
npm install
```

4. Create and configure the `.env` file using the environment variables above.

5. Start the development server:

```bash
npm run dev
```

The backend server will run at:

```text
http://localhost:5000
```

## Client Application

Frontend repository: https://github.com/Torikul45/fixmate-client


## API Endpoints

All endpoints use the `/api` prefix.

### Services

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/services` | Get available services |
| GET | `/api/services/:id` | Get service details |
| POST | `/api/services` | Create a repair service |
| GET | `/api/services/my-services` | Get technician's services |
| PATCH | `/api/services/:id/edit` | Update a service |
| PATCH | `/api/services/:id/availability` | Update service availability |
| DELETE | `/api/services/:id` | Delete a service |

### Bookings

| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/bookings` | Create a booking |
| GET | `/api/bookings/my-bookings` | Get customer bookings |
| GET | `/api/bookings/technician-requests` | Get technician booking requests |
| PATCH | `/api/bookings/:id/status` | Update booking status |
| PATCH | `/api/bookings/:id/cancel` | Cancel a booking |

### Admin

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/admin/overview` | Get dashboard overview |
| GET | `/api/admin/users` | Get all users |
| PATCH | `/api/admin/users/:id/role` | Update user role |
| GET | `/api/admin/services` | Get services for approval |
| PATCH | `/api/admin/services/:id/approval` | Approve or reject a service |
| GET | `/api/admin/bookings` | Get all bookings |
| GET | `/api/admin/transactions` | Get payment transactions |

### Payments

| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/payments/webhook` | Handle Stripe webhook events |
| POST | `/api/payments/create-checkout-session` | Create Stripe checkout session |
| POST | `/api/payments/verify-payment` | Verify payment |
| GET | `/api/payments/my-payments` | Get customer payment history |

### Users

| Method | Endpoint | Description |
|---|---|---|
| PATCH | `/api/users/profile` | Update user profile |

Protected endpoints require a valid authentication token and appropriate role permissions.


## Payment Integration

Stripe is used to process payments securely. The backend handles checkout sessions, payment verification, and webhook events with idempotency protection.

## Live Server

Production API URL: https://fixmate-server-rust.vercel.app

Backend is deployed on Vercel.

## Test Credentials

| Role         | Email               | Password             |
|--------------|---------------------|----------------------|
| Admin        | habibi98@gmail.com  | Provided to examiner |
| Technician 1 | orbin56@gmail.com   | Provided to examiner |
| Technician 2 | mubid1234@gmail.com | Provided to examiner |
| Customer     | nazib23@gmail.com   | Provided to examiner |

## NPM Packages

### Dependencies
- express – Backend API and routing
- mongodb – MongoDB database connection and queries
- cors – Cross-origin resource sharing
- dotenv – Environment variable management
- jose – JWT verification
- stripe – Payment processing

### Development Dependencies
- nodemon – Automatically restarts the server during development

## Author

FixMate Project
Developed by: Torikul islam