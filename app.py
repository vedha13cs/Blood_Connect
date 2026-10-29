import hmac
import json
import os
import re
import secrets
import threading
from contextlib import contextmanager
from datetime import datetime, timedelta, timezone

import mysql.connector
from flask import Flask, jsonify, request, session
from mysql.connector import Error as MySQLError
from werkzeug.security import check_password_hash, generate_password_hash

app = Flask(__name__, static_folder="static", static_url_path="")
app.config["MAX_CONTENT_LENGTH"] = 16 * 1024
app.config["SECRET_KEY"] = os.getenv("FLASK_SECRET_KEY") or secrets.token_hex(32)
app.config["SESSION_COOKIE_HTTPONLY"] = True
app.config["SESSION_COOKIE_SAMESITE"] = "Lax"
app.config["SESSION_COOKIE_SECURE"] = os.getenv("SESSION_COOKIE_SECURE", "").lower() == "true"
app.config["PERMANENT_SESSION_LIFETIME"] = timedelta(hours=8)

MYSQL_HOST = os.getenv("MYSQL_HOST", "127.0.0.1")
MYSQL_PORT = int(os.getenv("MYSQL_PORT", "3306"))
MYSQL_USER = os.getenv("MYSQL_USER", "root")
MYSQL_PASSWORD = os.getenv("MYSQL_PASSWORD", "")
MYSQL_DATABASE = os.getenv("MYSQL_DATABASE", "bloodlink")
MYSQL_CONNECT_TIMEOUT = 3

BLOOD_GROUPS = {"O+", "A+", "B+", "AB+", "O-", "A-", "B-", "AB-"}
URGENCY_LEVELS = {"Critical", "Urgent", "Standard"}
REQUEST_STATUSES = {"Submitted", "Contacted", "Matched", "Fulfilled", "Cancelled"}
SCHEMA_LOCK = threading.Lock()
SCHEMA_READY = False

TABLES_SQL = (
    """
    CREATE TABLE IF NOT EXISTS donors (
      id VARCHAR(32) PRIMARY KEY,
      name VARCHAR(100) NOT NULL,
      age TINYINT UNSIGNED NOT NULL,
      `group` VARCHAR(3) NOT NULL,
      city VARCHAR(100) NOT NULL,
      area VARCHAR(100) NULL,
      phone VARCHAR(20) NOT NULL,
      private_phone VARCHAR(10) NOT NULL,
      verified BOOLEAN NOT NULL DEFAULT FALSE,
      consent BOOLEAN NOT NULL DEFAULT TRUE,
      consent_at DATETIME(6) NOT NULL,
      created_at DATETIME(6) NOT NULL,
      verified_at DATETIME(6) NULL,
      INDEX donors_city_group_verified (city, `group`, verified),
      INDEX donors_created_at (created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    """,
    """
    CREATE TABLE IF NOT EXISTS banks (
      id VARCHAR(160) PRIMARY KEY,
      name VARCHAR(160) NOT NULL,
      city VARCHAR(160) NOT NULL,
      address VARCHAR(160) NOT NULL,
      phone VARCHAR(24) NOT NULL,
      type VARCHAR(80) NOT NULL,
      verified BOOLEAN NOT NULL DEFAULT FALSE,
      stock_json JSON NULL,
      updated_at DATETIME(6) NOT NULL,
      INDEX banks_city_verified (city, verified)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    """,
    """
    CREATE TABLE IF NOT EXISTS bank_users (
      id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      email VARCHAR(254) NOT NULL UNIQUE,
      password_hash VARCHAR(255) NOT NULL,
      bank_id VARCHAR(160) NOT NULL,
      active BOOLEAN NOT NULL DEFAULT TRUE,
      created_at DATETIME(6) NOT NULL,
      INDEX bank_users_bank_id (bank_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    """,
    """
    CREATE TABLE IF NOT EXISTS requests (
      id VARCHAR(40) PRIMARY KEY,
      patient VARCHAR(100) NOT NULL,
      `group` VARCHAR(3) NOT NULL,
      units TINYINT UNSIGNED NOT NULL,
      hospital VARCHAR(200) NOT NULL,
      urgency VARCHAR(16) NOT NULL,
      phone VARCHAR(10) NOT NULL,
      status VARCHAR(16) NOT NULL,
      step TINYINT UNSIGNED NOT NULL,
      `time` DATETIME(6) NOT NULL,
      updated_at DATETIME(6) NULL,
      INDEX requests_created_at (`time`),
      INDEX requests_status (status)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    """,
)


def mysql_config(include_database=True):
    config = {
        "host": MYSQL_HOST,
        "port": MYSQL_PORT,
        "user": MYSQL_USER,
        "password": MYSQL_PASSWORD,
        "connection_timeout": MYSQL_CONNECT_TIMEOUT,
        "charset": "utf8mb4",
        "use_unicode": True,
    }
    if include_database:
        config["database"] = MYSQL_DATABASE
    return config


def ensure_schema():
    global SCHEMA_READY
    if SCHEMA_READY:
        return
    if not re.fullmatch(r"[A-Za-z0-9_]{1,64}", MYSQL_DATABASE):
        raise ValueError("MYSQL_DATABASE must contain only letters, numbers, and underscores.")

    with SCHEMA_LOCK:
        if SCHEMA_READY:
            return
        connection = mysql.connector.connect(**mysql_config(include_database=False))
        cursor = connection.cursor()
        try:
            cursor.execute(
                f"CREATE DATABASE IF NOT EXISTS `{MYSQL_DATABASE}` "
                "CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci"
            )
            cursor.execute(f"USE `{MYSQL_DATABASE}`")
            for statement in TABLES_SQL:
                cursor.execute(statement)
            connection.commit()
            SCHEMA_READY = True
        except Exception:
            connection.rollback()
            raise
        finally:
            cursor.close()
            connection.close()


@contextmanager
def database_cursor(dictionary=True):
    ensure_schema()
    connection = mysql.connector.connect(**mysql_config())
    cursor = connection.cursor(dictionary=dictionary)
    try:
        yield connection, cursor
        connection.commit()
    except Exception:
        connection.rollback()
        raise
    finally:
        cursor.close()
        connection.close()


def serialize_value(value):
    if isinstance(value, datetime):
        if value.tzinfo is None:
            value = value.replace(tzinfo=timezone.utc)
        return value.isoformat()
    return value


def serialize_row(row):
    return {key: serialize_value(value) for key, value in row.items()}


def json_body():
    body = request.get_json(silent=True)
    if not isinstance(body, dict):
        return None
    return body


def admin_authorized():
    expected = os.getenv("ADMIN_API_TOKEN")
    if not expected:
        return False, (jsonify(error="Admin API is not configured."), 503)

    supplied = request.headers.get("Authorization", "")
    if not supplied.startswith("Bearer ") or not hmac.compare_digest(
        supplied[7:], expected
    ):
        return False, (jsonify(error="Admin authorization required."), 401)
    return True, None


def admin_pagination():
    try:
        page = int(request.args.get("page", "1"))
        per_page = int(request.args.get("per_page", "50"))
    except ValueError:
        return None, (jsonify(error="Page values must be whole numbers."), 400)
    if page < 1 or per_page < 1 or per_page > 100:
        return None, (
            jsonify(error="Page must be positive and per_page must be between 1 and 100."),
            400,
        )
    return (page, per_page), None


def admin_page(table, page, per_page, sort_column):
    offset = (page - 1) * per_page
    with database_cursor() as (_, cursor):
        cursor.execute(f"SELECT COUNT(*) AS total FROM `{table}`")
        total = cursor.fetchone()["total"]
        cursor.execute(
            f"SELECT * FROM `{table}` ORDER BY `{sort_column}` DESC LIMIT %s OFFSET %s",
            (per_page, offset),
        )
        items = [serialize_row(row) for row in cursor.fetchall()]
    for item in items:
        if table == "donors":
            item["verified"] = bool(item["verified"])
            item["consent"] = bool(item["consent"])
        elif table == "requests":
            item["group"] = item.pop("group")
    return jsonify(items=items, total=total, page=page, per_page=per_page)


def current_utc():
    return datetime.now(timezone.utc).replace(tzinfo=None)


@app.get("/")
def home():
    return app.send_static_file("index.html")


@app.get("/api/ping")
def ping():
    try:
        with database_cursor() as (_, cursor):
            cursor.execute("SELECT 1 AS ok")
            cursor.fetchone()
    except (MySQLError, ValueError) as error:
        app.logger.warning("MySQL health check failed: %s", error)
        return jsonify(ok=False, error="MySQL database is unavailable."), 503
    return jsonify(ok=True)


@app.get("/api/admin/session")
def admin_session():
    authorized, error = admin_authorized()
    if not authorized:
        return error
    return jsonify(ok=True)


@app.get("/api/admin/donors")
def admin_donors():
    authorized, error = admin_authorized()
    if not authorized:
        return error
    pagination, error = admin_pagination()
    if error:
        return error
    try:
        return admin_page("donors", *pagination, "created_at")
    except MySQLError as database_error:
        app.logger.exception("Could not load donor records: %s", database_error)
        return jsonify(error="Could not load donor records."), 503


@app.get("/api/admin/requests")
def admin_requests():
    authorized, error = admin_authorized()
    if not authorized:
        return error
    pagination, error = admin_pagination()
    if error:
        return error
    try:
        return admin_page("requests", *pagination, "time")
    except MySQLError as database_error:
        app.logger.exception("Could not load receiver request records: %s", database_error)
        return jsonify(error="Could not load receiver request records."), 503


@app.get("/api/donors")
def donors():
    group = request.args.get("group", "").strip()
    city = request.args.get("city", "").strip()
    if group and group not in BLOOD_GROUPS:
        return jsonify(error="Unsupported blood group."), 400

    conditions = ["verified = TRUE"]
    parameters = []
    if group:
        conditions.append("`group` = %s")
        parameters.append(group)
    if city:
        conditions.append("city LIKE %s")
        parameters.append(f"%{city}%")

    try:
        with database_cursor() as (_, cursor):
            cursor.execute(
                "SELECT id, name, `group`, city, area, phone, verified "
                "FROM donors WHERE " + " AND ".join(conditions) + " ORDER BY created_at DESC",
                tuple(parameters),
            )
            rows = cursor.fetchall()
        return jsonify([
            {**row, "verified": bool(row["verified"])} for row in rows
        ])
    except MySQLError as database_error:
        app.logger.exception("Could not load donors: %s", database_error)
        return jsonify(error="Could not load donors."), 503


@app.post("/api/donors")
def add_donor():
    body = json_body()
    if body is None:
        return jsonify(error="A JSON request body is required."), 400

    name = str(body.get("name", "")).strip()
    city = str(body.get("city", "")).strip()
    group = body.get("group")
    phone = re.sub(r"[\s-]", "", str(body.get("phone", "")))
    age = body.get("age")
    if not name or len(name) > 100 or not city or len(city) > 100:
        return jsonify(error="Name and city are required."), 400
    if group not in BLOOD_GROUPS:
        return jsonify(error="Unsupported blood group."), 400
    if not isinstance(age, int) or isinstance(age, bool) or not 18 <= age <= 65:
        return jsonify(error="Donor age must be between 18 and 65."), 400
    if not re.fullmatch(r"[6-9]\d{9}", phone):
        return jsonify(error="Enter a valid 10-digit Indian mobile number."), 400
    if body.get("consent") is not True:
        return jsonify(error="Donor consent is required."), 400

    donor_id = f"D-{secrets.token_hex(4).upper()}"
    now = current_utc()
    try:
        with database_cursor(dictionary=False) as (_, cursor):
            cursor.execute(
                """
                INSERT INTO donors
                  (id, name, age, `group`, city, phone, private_phone, verified,
                   consent, consent_at, created_at)
                VALUES (%s, %s, %s, %s, %s, %s, %s, FALSE, TRUE, %s, %s)
                """,
                (
                    donor_id,
                    name,
                    age,
                    group,
                    city,
                    f"{phone[:2]}******{phone[-2:]}",
                    phone,
                    now,
                    now,
                ),
            )
    except MySQLError as database_error:
        app.logger.exception("Could not save donor registration: %s", database_error)
        return jsonify(error="Could not save donor registration."), 503
    return jsonify(ok=True, id=donor_id), 201


@app.patch("/api/donors/<donor_id>/verification")
def update_donor_verification(donor_id):
    authorized, error = admin_authorized()
    if not authorized:
        return error

    body = json_body()
    verified = body.get("verified") if body else None
    if not isinstance(verified, bool):
        return jsonify(error="verified must be true or false."), 400
    try:
        with database_cursor(dictionary=False) as (_, cursor):
            cursor.execute(
                "UPDATE donors SET verified = %s, verified_at = %s WHERE id = %s",
                (verified, current_utc() if verified else None, donor_id.upper()),
            )
            updated = cursor.rowcount > 0
            if not updated:
                cursor.execute("SELECT 1 FROM donors WHERE id = %s", (donor_id.upper(),))
                updated = cursor.fetchone() is not None
    except MySQLError as database_error:
        app.logger.exception("Could not update donor verification: %s", database_error)
        return jsonify(error="Could not update donor verification."), 503
    if not updated:
        return jsonify(error="Donor not found."), 404
    return jsonify(ok=True, id=donor_id.upper(), verified=verified)


@app.get("/api/admin/donors/<donor_id>")
def get_donor_for_review(donor_id):
    authorized, error = admin_authorized()
    if not authorized:
        return error
    try:
        with database_cursor() as (_, cursor):
            cursor.execute("SELECT * FROM donors WHERE id = %s", (donor_id.upper(),))
            donor = cursor.fetchone()
        if donor:
            donor = serialize_row(donor)
            donor["verified"] = bool(donor["verified"])
            donor["consent"] = bool(donor["consent"])
    except MySQLError as database_error:
        app.logger.exception("Could not load donor registration: %s", database_error)
        return jsonify(error="Could not load donor registration."), 503
    return jsonify(donor) if donor else (jsonify(error="Donor not found."), 404)


@app.get("/api/banks")
def banks():
    city = request.args.get("city", "").strip()
    try:
        with database_cursor() as (_, cursor):
            if city:
                cursor.execute(
                    "SELECT id, name, city, address, phone, type, stock_json, verified, updated_at "
                    "FROM banks WHERE verified = TRUE AND city LIKE %s ORDER BY name",
                    (f"%{city}%",),
                )
            else:
                cursor.execute(
                    "SELECT id, name, city, address, phone, type, stock_json, verified, updated_at "
                    "FROM banks WHERE verified = TRUE ORDER BY name"
                )
            result = cursor.fetchall()
        bank_list = []
        for bank in result:
            stock = bank.pop("stock_json")
            bank["stock"] = json.loads(stock) if stock else None
            bank["verified"] = bool(bank["verified"])
            bank_list.append(serialize_row(bank))
        return jsonify(bank_list)
    except (MySQLError, ValueError, TypeError) as database_error:
        app.logger.exception("Could not load blood-bank listings: %s", database_error)
        return jsonify(error="Could not load blood-bank listings."), 503


@app.put("/api/banks")
def upsert_bank():
    authorized, error = admin_authorized()
    if not authorized:
        return error

    body = json_body()
    if body is None:
        return jsonify(error="A JSON request body is required."), 400

    bank_id = str(body.get("id", "")).strip()
    name = str(body.get("name", "")).strip()
    city = str(body.get("city", "")).strip()
    address = str(body.get("address", "")).strip()
    phone = re.sub(r"[\s()-]", "", str(body.get("phone", "")))
    if not all((bank_id, name, city, address, phone)):
        return jsonify(error="ID, name, city, address, and phone are required."), 400
    if any(len(value) > 160 for value in (bank_id, name, city, address)):
        return jsonify(error="Bank details are too long."), 400
    if not re.fullmatch(r"\+?[0-9]{8,15}", phone):
        return jsonify(error="Enter a valid phone number."), 400

    bank_type = str(body.get("type", "Blood bank"))[:80]
    stock = body.get("stock")
    if stock is not None and (
        not isinstance(stock, dict)
        or any(
            group not in BLOOD_GROUPS
            or not isinstance(quantity, int)
            or isinstance(quantity, bool)
            or quantity < 0
            for group, quantity in stock.items()
        )
    ):
        return jsonify(error="Stock must map valid blood groups to non-negative whole units."), 400

    now = current_utc()
    stock_json = json.dumps(stock) if stock is not None else None
    try:
        with database_cursor(dictionary=False) as (_, cursor):
            if stock is not None:
                cursor.execute(
                    "SELECT id FROM bank_users WHERE bank_id = %s AND active = TRUE LIMIT 1",
                    (bank_id,),
                )
                if cursor.fetchone() is not None:
                    return jsonify(error="Only this bank's staff can update its stock."), 403
            cursor.execute(
                """
                INSERT INTO banks (id, name, city, address, phone, type, verified, stock_json, updated_at)
                VALUES (%s, %s, %s, %s, %s, %s, TRUE, %s, %s)
                ON DUPLICATE KEY UPDATE
                  name = VALUES(name), city = VALUES(city), address = VALUES(address),
                  phone = VALUES(phone), type = VALUES(type), verified = TRUE,
                  stock_json = COALESCE(VALUES(stock_json), stock_json), updated_at = VALUES(updated_at)
                """,
                (bank_id, name, city, address, phone, bank_type, stock_json, now),
            )
    except MySQLError as database_error:
        app.logger.exception("Could not save blood-bank listing: %s", database_error)
        return jsonify(error="Could not save blood-bank listing."), 503
    bank = {
        "id": bank_id,
        "name": name,
        "city": city,
        "address": address,
        "phone": phone,
        "type": bank_type,
        "verified": True,
        "stock": stock,
        "updated_at": now.replace(tzinfo=timezone.utc).isoformat(),
    }
    return jsonify(ok=True, bank=bank), 200


@app.post("/api/admin/bank-users")
def create_bank_user():
    authorized, error = admin_authorized()
    if not authorized:
        return error

    body = json_body()
    if body is None:
        return jsonify(error="A JSON request body is required."), 400

    email = str(body.get("email", "")).strip().lower()
    password = body.get("password")
    bank_id = str(body.get("bank_id", "")).strip()
    if not re.fullmatch(r"[^@\s]+@[^@\s]+\.[^@\s]+", email) or len(email) > 254:
        return jsonify(error="Enter a valid bank staff email address."), 400
    if not isinstance(password, str) or not 12 <= len(password) <= 256:
        return jsonify(error="Password must be between 12 and 256 characters."), 400
    if not bank_id or len(bank_id) > 160:
        return jsonify(error="A valid bank ID is required."), 400

    try:
        with database_cursor(dictionary=False) as (_, cursor):
            cursor.execute(
                "SELECT id FROM banks WHERE id = %s AND verified = TRUE",
                (bank_id,),
            )
            if cursor.fetchone() is None:
                return jsonify(error="Verified blood bank not found."), 404
            cursor.execute(
                """
                INSERT INTO bank_users (email, password_hash, bank_id, created_at)
                VALUES (%s, %s, %s, %s)
                """,
                (email, generate_password_hash(password), bank_id, current_utc()),
            )
            user_id = cursor.lastrowid
    except MySQLError as database_error:
        if getattr(database_error, "errno", None) == 1062:
            return jsonify(error="A bank staff account already exists for that email."), 409
        app.logger.exception("Could not create bank staff account: %s", database_error)
        return jsonify(error="Could not create bank staff account."), 503
    return jsonify(ok=True, id=user_id, email=email, bank_id=bank_id), 201


@app.post("/api/bank-auth/login")
def bank_login():
    body = json_body()
    if body is None:
        return jsonify(error="A JSON request body is required."), 400
    email = str(body.get("email", "")).strip().lower()
    password = body.get("password")
    if not email or not isinstance(password, str):
        return jsonify(error="Enter your email and password."), 400

    try:
        with database_cursor() as (_, cursor):
            cursor.execute(
                """
                SELECT bank_users.id, bank_users.email, bank_users.password_hash,
                       bank_users.bank_id, banks.name
                FROM bank_users
                JOIN banks ON banks.id = bank_users.bank_id
                WHERE bank_users.email = %s
                  AND bank_users.active = TRUE
                  AND banks.verified = TRUE
                """,
                (email,),
            )
            user = cursor.fetchone()
    except MySQLError as database_error:
        app.logger.exception("Could not authenticate bank staff: %s", database_error)
        return jsonify(error="Bank sign in is temporarily unavailable."), 503

    if not user or not check_password_hash(user["password_hash"], password):
        return jsonify(error="Email or password is incorrect."), 401

    session.clear()
    session["bank_user_id"] = user["id"]
    session["csrf_token"] = secrets.token_urlsafe(32)
    session.permanent = True
    return jsonify(ok=True, bank={"id": user["bank_id"], "name": user["name"]})


def current_bank_user(cursor):
    user_id = session.get("bank_user_id")
    if not user_id:
        return None
    cursor.execute(
        """
        SELECT bank_users.id, bank_users.email, bank_users.bank_id, banks.name
        FROM bank_users
        JOIN banks ON banks.id = bank_users.bank_id
        WHERE bank_users.id = %s
          AND bank_users.active = TRUE
          AND banks.verified = TRUE
        """,
        (user_id,),
    )
    return cursor.fetchone()


def bank_csrf_valid():
    expected = session.get("csrf_token", "")
    supplied = request.headers.get("X-CSRF-Token", "")
    return bool(expected and supplied and secrets.compare_digest(expected, supplied))


@app.get("/api/bank-auth/session")
def bank_auth_session():
    try:
        with database_cursor() as (_, cursor):
            user = current_bank_user(cursor)
    except MySQLError as database_error:
        app.logger.exception("Could not load bank staff session: %s", database_error)
        return jsonify(error="Could not verify bank session."), 503
    if not user:
        session.clear()
        return jsonify(error="Bank sign in required."), 401
    return jsonify(
        ok=True,
        csrf_token=session["csrf_token"],
        bank={"id": user["bank_id"], "name": user["name"]},
    )


@app.post("/api/bank-auth/logout")
def bank_logout():
    if not bank_csrf_valid():
        return jsonify(error="Invalid or missing security token."), 403
    session.clear()
    return jsonify(ok=True)


@app.get("/api/bank/stock")
def get_bank_stock():
    try:
        with database_cursor() as (_, cursor):
            user = current_bank_user(cursor)
            if not user:
                session.clear()
                return jsonify(error="Bank sign in required."), 401
            cursor.execute(
                "SELECT stock_json, updated_at FROM banks WHERE id = %s",
                (user["bank_id"],),
            )
            bank = cursor.fetchone()
        stock = bank["stock_json"] if bank["stock_json"] else {}
        if isinstance(stock, str):
            stock = json.loads(stock)
        if not isinstance(stock, dict):
            raise ValueError("Bank stock must be a JSON object.")
        normalized_stock = {
            group: stock.get(group, 0)
            for group in ("A+", "A-", "B+", "B-", "O+", "O-", "AB+", "AB-")
        }
        if any(
            not isinstance(quantity, int) or isinstance(quantity, bool) or quantity < 0
            for quantity in normalized_stock.values()
        ):
            raise ValueError("Bank stock contains an invalid quantity.")
    except (MySQLError, ValueError, TypeError) as database_error:
        app.logger.exception("Could not load bank stock: %s", database_error)
        return jsonify(error="Could not load blood-bank stock."), 503
    return jsonify(
        bank={"id": user["bank_id"], "name": user["name"]},
        stock=normalized_stock,
        updated_at=serialize_value(bank["updated_at"]),
    )


@app.put("/api/bank/stock")
def update_bank_stock():
    if not bank_csrf_valid():
        return jsonify(error="Invalid or missing security token."), 403
    body = json_body()
    if body is None or not isinstance(body.get("stock"), dict):
        return jsonify(error="A stock object is required."), 400
    groups = ("A+", "A-", "B+", "B-", "O+", "O-", "AB+", "AB-")
    stock = body["stock"]
    if set(stock) != set(groups) or any(
        not isinstance(stock[group], int)
        or isinstance(stock[group], bool)
        or not 0 <= stock[group] <= 1_000_000
        for group in groups
    ):
        return jsonify(error="Enter a non-negative whole-unit count for all eight blood groups."), 400

    now = current_utc()
    try:
        with database_cursor(dictionary=False) as (_, cursor):
            user = current_bank_user(cursor)
            if not user:
                session.clear()
                return jsonify(error="Bank sign in required."), 401
            cursor.execute(
                """
                UPDATE banks SET stock_json = %s, updated_at = %s
                WHERE id = %s AND verified = TRUE
                """,
                (json.dumps(stock), now, user["bank_id"]),
            )
            if cursor.rowcount == 0:
                cursor.execute(
                    "SELECT 1 FROM banks WHERE id = %s AND verified = TRUE",
                    (user["bank_id"],),
                )
                if cursor.fetchone() is None:
                    session.clear()
                    return jsonify(error="Verified blood bank not found."), 404
    except MySQLError as database_error:
        app.logger.exception("Could not update bank stock: %s", database_error)
        return jsonify(error="Could not update blood-bank stock."), 503
    return jsonify(
        ok=True,
        stock=stock,
        updated_at=now.replace(tzinfo=timezone.utc).isoformat(),
    )


@app.post("/api/requests")
def add_request():
    body = json_body()
    if body is None:
        return jsonify(error="A JSON request body is required."), 400

    patient = str(body.get("patient", "")).strip()
    hospital = str(body.get("hospital", "")).strip()
    group = body.get("group")
    urgency = body.get("urgency")
    phone = re.sub(r"[\s-]", "", str(body.get("phone", "")))
    units = body.get("units")
    if not patient or len(patient) > 100 or not hospital or len(hospital) > 200:
        return jsonify(error="Patient and hospital details are required."), 400
    if group not in BLOOD_GROUPS or urgency not in URGENCY_LEVELS:
        return jsonify(error="Choose a valid blood group and urgency level."), 400
    if not isinstance(units, int) or isinstance(units, bool) or not 1 <= units <= 10:
        return jsonify(error="Units must be a whole number between 1 and 10."), 400
    if not re.fullmatch(r"[6-9]\d{9}", phone):
        return jsonify(error="Enter a valid 10-digit Indian mobile number."), 400

    request_id = f"BR-{secrets.token_hex(16).upper()}"
    now = current_utc()
    record = {
        "id": request_id,
        "patient": patient,
        "group": group,
        "units": units,
        "hospital": hospital,
        "urgency": urgency,
        "phone": phone,
        "status": "Submitted",
        "step": 1,
        "time": now,
    }
    try:
        with database_cursor(dictionary=False) as (_, cursor):
            cursor.execute(
                """
                INSERT INTO requests (id, patient, `group`, units, hospital, urgency, phone, status, step, `time`)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                """,
                (
                    request_id,
                    patient,
                    group,
                    units,
                    hospital,
                    urgency,
                    phone,
                    "Submitted",
                    1,
                    now,
                ),
            )
    except MySQLError as database_error:
        app.logger.exception("Could not submit blood request: %s", database_error)
        return jsonify(error="Could not submit the blood request."), 503
    record["time"] = now.replace(tzinfo=timezone.utc).isoformat()
    record.pop("phone")
    return jsonify(record), 201


@app.get("/api/requests/<rid>")
def get_request(rid):
    try:
        with database_cursor() as (_, cursor):
            cursor.execute(
                """
                SELECT id, `group`, units, urgency, status, step, `time`, updated_at
                FROM requests WHERE id = %s
                """,
                (rid.upper(),),
            )
            record = cursor.fetchone()
        if record:
            record = serialize_row(record)
    except MySQLError as database_error:
        app.logger.exception("Could not load blood request: %s", database_error)
        return jsonify(error="Could not load the blood request."), 503
    return jsonify(record) if record else (jsonify(error="Request not found."), 404)


@app.get("/api/admin/requests/<rid>")
def get_request_for_staff(rid):
    authorized, error = admin_authorized()
    if not authorized:
        return error
    try:
        with database_cursor() as (_, cursor):
            cursor.execute("SELECT * FROM requests WHERE id = %s", (rid.upper(),))
            record = cursor.fetchone()
        if record:
            record = serialize_row(record)
    except MySQLError as database_error:
        app.logger.exception("Could not load blood request: %s", database_error)
        return jsonify(error="Could not load the blood request."), 503
    return jsonify(record) if record else (jsonify(error="Request not found."), 404)


@app.patch("/api/requests/<rid>/status")
def update_request_status(rid):
    authorized, error = admin_authorized()
    if not authorized:
        return error

    body = json_body()
    status = body.get("status") if body else None
    if status not in REQUEST_STATUSES:
        return jsonify(error="Choose a valid request status."), 400
    step_by_status = {
        "Submitted": 1,
        "Contacted": 2,
        "Matched": 3,
        "Fulfilled": 4,
        "Cancelled": 0,
    }
    try:
        with database_cursor(dictionary=False) as (_, cursor):
            cursor.execute(
                "UPDATE requests SET status = %s, step = %s, updated_at = %s WHERE id = %s",
                (status, step_by_status[status], current_utc(), rid.upper()),
            )
            updated = cursor.rowcount > 0
            if not updated:
                cursor.execute("SELECT 1 FROM requests WHERE id = %s", (rid.upper(),))
                updated = cursor.fetchone() is not None
    except MySQLError as database_error:
        app.logger.exception("Could not update request status: %s", database_error)
        return jsonify(error="Could not update request status."), 503
    if not updated:
        return jsonify(error="Request not found."), 404
    return jsonify(ok=True, id=rid.upper(), status=status, step=step_by_status[status])


if __name__ == "__main__":
    app.run(debug=False, port=5000)
