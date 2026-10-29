# BloodLink

BloodLink is a Flask, MySQL, HTML/CSS, and JavaScript prototype for finding blood-bank contacts, registering donors, and tracking requests.

## Run locally

1. Install Python 3.9+ and MySQL Server. The default local MySQL service name is `MySQL80`; start it from an elevated PowerShell prompt if it is stopped:

   ```powershell
   Get-Service MySQL80
   Start-Service MySQL80
   ```

2. Install dependencies:

   ```powershell
   pip install -r requirements.txt
   ```

3. Configure the MySQL connection and private admin API token in the same PowerShell session. The database defaults are `127.0.0.1:3306`, user `root`, and database `bloodlink`. Enter your MySQL password at the prompt; it is not echoed or saved in the project:

   ```powershell
   $securePassword = Read-Host "MySQL password" -AsSecureString
   $env:MYSQL_PASSWORD = (New-Object System.Net.NetworkCredential("", $securePassword)).Password
   $env:MYSQL_USER = "root"
   $env:MYSQL_DATABASE = "bloodlink"
   $env:ADMIN_API_TOKEN = "replace-with-a-long-random-secret"
   $keyBytes = New-Object byte[] 32
   $rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
   $rng.GetBytes($keyBytes)
   $env:FLASK_SECRET_KEY = [Convert]::ToBase64String($keyBytes)
   $rng.Dispose()
   python app.py
   ```

   If your MySQL root account has no password, set `$env:MYSQL_PASSWORD = ""` instead. On first connection, the app creates the `bloodlink` database and its tables; the configured MySQL user therefore needs permission to create databases and tables. Keep the same private `FLASK_SECRET_KEY` across restarts so active bank staff sessions remain valid. For production, use a dedicated database user with only the required privileges rather than `root`, and set `SESSION_COOKIE_SECURE=true` behind HTTPS.

4. Open `http://localhost:5000`.

The server creates an empty schema and does not insert sample banks or donors. Existing MongoDB data is not automatically copied; it remains in MongoDB and is not modified. When MySQL is unavailable, the frontend falls back to browser-only demo data; requests created in that mode are **not sent to a blood bank**.

## Separate role portals

The home page's sign-in chooser links to separate donor, receiver, hospital, blood-bank staff, and admin pages. Donors and hospitals have their own portal landing pages; receivers have their own request dashboard; admins use the protected records dashboard. Donor, receiver, and hospital sign-in are demonstration flows only and do not authenticate accounts. Blood-bank staff accounts use password verification and a bank-specific session; admins create those accounts using `ADMIN_API_TOKEN`.

## Hospital and blood-bank contacts

An administrator must confirm each bank's name, location, phone number, and optional stock, then add or update it using the protected endpoint. Only records marked verified by this endpoint appear in the live directory.

```powershell
$headers = @{ Authorization = ('Bearer ' + $env:ADMIN_API_TOKEN) }
$bank = @{
  id = "kmc-mangaluru"
  name = "Blood Bank Name"
  city = "Mangaluru"
  address = "Street address"
  phone = "+918240000000"
  type = "Licensed blood bank"
  stock = @{ "O+" = 0; "A+" = 0 }
} | ConvertTo-Json

Invoke-RestMethod -Method Put -Uri "http://localhost:5000/api/banks" `
  -Headers $headers -ContentType "application/json" -Body $bank
```

On a phone, **Call bank** opens that record's number in the device's dialer (`tel:`). The app does not place calls itself. **Directions** opens a map search. Initial stock is optional; after a bank staff account is created, its staff can maintain all eight blood-group counts from the blood-bank inventory portal. Directory stock is reported inventory, not a reservation; callers should confirm availability, compatibility, and eligibility directly with the blood bank before travelling.

### Blood-bank staff inventory

First add and verify the bank with the protected `PUT /api/banks` endpoint above. Then create an individual staff login for that bank using the protected admin endpoint. Use the bank's exact ID and a unique email; passwords must be at least 12 characters. The password is stored as a hash and is not returned by the API:

```powershell
$headers = @{ Authorization = ('Bearer ' + $env:ADMIN_API_TOKEN) }
$secureBankPassword = Read-Host "New bank staff password" -AsSecureString
$bankPassword = (New-Object System.Net.NetworkCredential("", $secureBankPassword)).Password
$staff = @{
  email = "inventory@example.org"
  password = $bankPassword
  bank_id = "kmc-mangaluru"
} | ConvertTo-Json
Invoke-RestMethod -Method Post -Uri "http://localhost:5000/api/admin/bank-users" `
  -Headers $headers -ContentType "application/json" -Body $staff
Remove-Variable bankPassword, staff, secureBankPassword
```

Staff sign in at `http://localhost:5000/bank-login.html`. Their dashboard displays A+, A−, B+, B−, O+, O−, AB+, and AB− stock counts and saves changes only to the bank associated with their account. Staff should increase a count only after donated blood has been received and checked in, and decrease it when units are issued. Donor registration does not automatically change stock. Configure HTTPS and `SESSION_COOKIE_SECURE=true` before using staff accounts outside local development.

## Requests and status updates

Submitting a request stores it in MySQL and returns a tracking ID. The status tracker checks the backend every 15 seconds while open. It does not send SMS, call hospitals, or notify donors automatically. Authorized staff can update the request after contacting the blood bank:

```powershell
$status = @{ status = "Contacted" } | ConvertTo-Json
Invoke-RestMethod -Method Patch -Uri "http://localhost:5000/api/requests/REQUEST_ID/status" `
  -Headers $headers -ContentType "application/json" -Body $status
```

Allowed statuses: `Submitted`, `Contacted`, `Matched`, `Fulfilled`, and `Cancelled`.

## Donor registrations

Open `http://localhost:5000/admin.html` and sign in with the server's admin API token to review donor registrations and receiver requests. The dashboard displays records in pages, including donor age, blood group, city, contact, consent and verification details, plus receiver name, blood group, units, urgency, hospital, contact and request status. It lets authorized staff approve donors or update request status. The token remains in the current browser tab's session storage. The dashboard can show only details BloodLink actually collects; it cannot reveal external account, hospital-system, or medical records.

New donor registrations are stored as unverified and do not appear in live search until reviewed. Authorized staff can approve a registration using its returned donor ID:

```powershell
$verification = @{ verified = $true } | ConvertTo-Json
Invoke-RestMethod -Method Patch -Uri "http://localhost:5000/api/donors/DONOR_ID/verification" `
  -Headers $headers -ContentType "application/json" -Body $verification

# Review a donor's submitted details using the protected staff endpoint.
Invoke-RestMethod -Method Get -Uri "http://localhost:5000/api/admin/donors/DONOR_ID" `
  -Headers $headers
```

Use the protected `GET /api/admin/requests/REQUEST_ID` endpoint to view the contact details for a request before staff follow up. The public donor endpoint returns masked numbers only, and public request tracking returns status without patient or contact details. Donor and patient phone numbers are personal data; use HTTPS, restrict MySQL access, set a strong admin token, and define a retention and consent policy before handling real users. This prototype does not provide user authentication, SMS integration, hospital inventory feeds, or emergency-service dispatch. Deploy behind a production WSGI server and HTTPS before public use.
