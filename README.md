# Tayaqan — Certificate Verification System

**A unified blockchain-based system for certificate management and verification.**

Tayaqan is a web application that helps educational institutions issue certificates and enables applicants to manage and share them with employers. It combines a React frontend, Django REST API, Ethereum smart contracts, and Storacha file storage to support certificate verification and controlled access.

## Architecture

<img width="707" height="660" alt="image (1)" src="https://github.com/user-attachments/assets/fa9ad3d5-6e66-4b11-8b18-c16330e4c2bc" />

The web application connects the three user roles—institution, applicant, and employer/HR. Certificate files are uploaded to Storacha, while blockchain smart contracts maintain certificate-related records and access permissions. The Django backend manages application data and connects the frontend with blockchain and storage services.

## Key Features

- **Institutions:** register, issue certificates, view issued records, and revoke certificates.
- **Applicants:** view certificates and manage employer requests to access selected certificates.
- **Employers/HR:** request access to certificates and view those shared by applicants, subject to permissions.
- **Certificate verification:** use certificate hashes and blockchain records to help detect file changes.
- **Access control:** support controlled certificate sharing and time-limited access where configured.
- **Authentication:** JWT-based authentication and role-specific workflows.

## Technology Stack

- **Frontend:** React, TypeScript, Vite, React Router, Axios, TanStack Query, React Hook Form, Zod, i18next, Tailwind CSS
- **Backend:** Python, Django, Django REST Framework, Simple JWT
- **Blockchain:** Solidity, Hardhat, ethers.js, Web3.py
- **File storage:** Storacha
- **Database:** SQLite by default

## Repository Structure

```text
Tayaqan-Certificate-Verification-System/
├── frontend/       # React + TypeScript application
├── backend/        # Django REST API
├── contract/       # Solidity contracts and Hardhat configuration
├── Docs/           # Project documentation
├── requirements.txt
└── README.md
```

## Run Locally

You will need Python, Node.js/npm, and a local or remote Ethereum-compatible JSON-RPC endpoint. Storacha credentials are needed for file uploads.

### 1. Start a local blockchain

```bash
cd contract
npm install
npx hardhat node
```

Keep this terminal running.

### 2. Deploy the contracts

In a second terminal:

```bash
cd contract
npx hardhat deploy --network localhost
```

Copy the deployed registry address into the backend configuration. Ensure the RPC URL, chain ID, and development wallet settings match the local node.

### 3. Configure and start the backend

Create a local `backend/.env` with the environment variables required by the Django settings and integration helpers. Configure a new Django secret key, local blockchain RPC and registry addresses, and Storacha credentials as needed.

```bash
cd backend
python -m venv .venv
```

Activate the virtual environment, then install dependencies and run migrations:

```bash
# Windows PowerShell activation:
.venv\Scripts\Activate.ps1
# macOS/Linux activation:
source .venv/bin/activate

pip install -r ../requirements.txt
python manage.py migrate
python manage.py runserver
```

If the requirements file is not found at the repository root in your checkout, install it from its actual location.

### 4. Start the frontend

In another terminal:

```bash
cd frontend
npm install
```

Create `frontend/.env` if needed:

```env
VITE_API_BASE_URL=http://127.0.0.1:8000/api
```

Then run:

```bash
npm run dev
```

The Vite development server prints the local URL when it starts. Blockchain-dependent workflows require deployed contract addresses and matching backend configuration.

## Project

Tayaqan was developed as a graduation project exploring blockchain-based certificate management and verification.


