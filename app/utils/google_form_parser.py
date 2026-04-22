"""
Google Form CSV parser.

Expected CSV columns (case-insensitive, spaces replaced with underscores):
    name, roll_no, date_of_birth, email, phone, gender, address,
    guardian_name, guardian_phone, branch_code, semester_number, admission_year

The column names are flexible – the parser tries common aliases too.
"""
import io
from datetime import datetime, date

import pandas as pd
from fastapi import HTTPException, status



COLUMN_ALIASES: dict[str, list[str]] = {
    "name":             ["name", "full name", "student name", "full_name", "student_name"],
    "roll_no":          ["roll_no", "roll no", "rollno", "roll number", "roll_number"],
    "date_of_birth":    ["date_of_birth", "dob", "date of birth", "birth date", "birthdate"],
    "email":            ["email", "email address", "email_address"],
    "phone":            ["phone", "phone number", "mobile", "mobile number", "contact"],
    "gender":           ["gender", "sex"],
    "address":          ["address", "residential address"],
    "guardian_name":    ["guardian_name", "guardian name", "parent name", "parent_name", "father name"],
    "guardian_phone":   ["guardian_phone", "guardian phone", "parent phone", "parent contact"],
    "branch_code":      ["branch_code", "branch code", "branch", "department code", "dept code"],
    "semester_number":  ["semester_number", "semester no", "semester", "sem", "sem no", "sem_no"],
    "admission_year":   ["admission_year", "admission year", "year of admission", "joining year"],
}

REQUIRED_FIELDS = {"name", "roll_no", "branch_code", "semester_number"}


def _normalize(col: str) -> str:
    return col.strip().lower()


def _build_col_map(df_columns: list[str]) -> dict[str, str]:
    """Return {canonical_field: actual_df_column} for matched columns."""
    normalized = {_normalize(c): c for c in df_columns}
    col_map: dict[str, str] = {}
    for canonical, aliases in COLUMN_ALIASES.items():
        for alias in aliases:
            if alias in normalized:
                col_map[canonical] = normalized[alias]
                break
    return col_map


def parse_google_form_csv(file_bytes: bytes) -> list[dict]:
    """
    Parse raw CSV bytes from a Google Form export.

    Returns a list of dicts with canonical field names.
    Raises HTTPException on fatal issues (missing required columns).
    """
    try:
        df = pd.read_csv(io.BytesIO(file_bytes), dtype=str)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Could not parse CSV file: {exc}",
        )

    df.columns = [c.strip() for c in df.columns]
    col_map = _build_col_map(list(df.columns))

    missing = REQUIRED_FIELDS - set(col_map.keys())
    if missing:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"CSV is missing required columns: {missing}. "
                   f"Detected columns: {list(df.columns)}",
        )

    rows: list[dict] = []
    for _, row in df.iterrows():
        record: dict = {}
        for canonical, actual_col in col_map.items():
            val = row.get(actual_col, "")
            record[canonical] = None if pd.isna(val) or str(val).strip() == "" else str(val).strip()
        rows.append(record)

    return rows


def parse_date(raw: str | None) -> date | None:
    if not raw:
        return None
    for fmt in ("%Y-%m-%d", "%d-%m-%Y", "%d/%m/%Y", "%m/%d/%Y", "%d %b %Y"):
        try:
            return datetime.strptime(raw, fmt).date()
        except ValueError:
            continue
    return None