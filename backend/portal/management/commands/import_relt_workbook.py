"""Import the demo participant register supplied by RELT.

The workbook uses a wide Excel table, while the application stores people in
normalised User, Person, StudentProfile and TutorProfile records.  This command
intentionally imports only the participant register and its pairing history;
the feedback and incident sheets have no corresponding application models.
"""

from datetime import date, datetime, timedelta
from pathlib import Path
import re
from xml.etree import ElementTree as ET
from zipfile import ZipFile

from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from portal.models import Pairing, Person, StudentProfile, TutorProfile, User


NS = {
    "x": "http://schemas.openxmlformats.org/spreadsheetml/2006/main",
    "r": "http://schemas.openxmlformats.org/officeDocument/2006/relationships",
}
DAY_COLUMNS = {
    "X": "MONDAY", "Y": "TUESDAY", "Z": "WEDNESDAY", "AA": "THURSDAY",
    "AB": "FRIDAY", "AC": "SATURDAY", "AD": "SUNDAY",
}


def cell_value(cell, shared_strings):
    """Return the displayed scalar value from an XLSX cell without openpyxl."""
    cell_type = cell.attrib.get("t")
    value = cell.find("x:v", NS)
    if cell_type == "s":
        return shared_strings[int(value.text)] if value is not None else ""
    if cell_type == "inlineStr":
        return "".join(node.text or "" for node in cell.findall(".//x:t", NS))
    return value.text if value is not None else ""


def column_name(reference):
    return re.match(r"[A-Z]+", reference).group()


def register_rows(workbook_path):
    """Read the participant table as dictionaries keyed by Excel column name."""
    with ZipFile(workbook_path) as archive:
        shared_strings = []
        if "xl/sharedStrings.xml" in archive.namelist():
            root = ET.fromstring(archive.read("xl/sharedStrings.xml"))
            shared_strings = [
                "".join(text.text or "" for text in item.findall(".//x:t", NS))
                for item in root.findall("x:si", NS)
            ]
        workbook = ET.fromstring(archive.read("xl/workbook.xml"))
        relationships = ET.fromstring(archive.read("xl/_rels/workbook.xml.rels"))
        targets = {item.attrib["Id"]: item.attrib["Target"] for item in relationships}
        sheet = next(
            item for item in workbook.find("x:sheets", NS)
            if item.attrib["name"] == "(B) Register of Participants"
        )
        relationship_id = sheet.attrib["{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id"]
        target = targets[relationship_id].lstrip("/")
        target = target if target.startswith("xl/") else f"xl/{target}"
        sheet_root = ET.fromstring(archive.read(target))
        rows = []
        for row in sheet_root.findall(".//x:sheetData/x:row", NS):
            values = {
                column_name(cell.attrib["r"]): (cell_value(cell, shared_strings) or "").strip()
                for cell in row.findall("x:c", NS)
            }
            if values.get("A", "").startswith(("T-", "S-")):
                rows.append(values)
        return rows


def excel_date(value):
    if not value:
        return None
    try:
        return (datetime(1899, 12, 30) + timedelta(days=float(value))).date()
    except ValueError:
        return datetime.strptime(value, "%Y-%m-%d").date()


def phone(value):
    return re.sub(r"[\s()-]", "", value or "")


def affirmative(value):
    return value.strip().lower() in {"yes", "everyone", "adults only"}


def meaningful(value):
    return "" if value.strip().upper().startswith("NA") else value.strip()


def status(value):
    if "REJ" in value:
        return Person.Status.REJECTED
    if "INACT" in value:
        return Person.Status.INACTIVE
    return Person.Status.ACTIVE


def mode(value):
    return Person.Mode.IN_PERSON if value == "In-Person" else Person.Mode.ONLINE


def time_24(value):
    parsed = datetime.strptime(value.strip().lower(), "%I%p")
    return parsed.strftime("%H:%M")


def availability(row):
    result = {}
    for column, day in DAY_COLUMNS.items():
        slots = []
        for segment in row.get(column, "").split(";"):
            if "-" not in segment or segment.upper().startswith("NA"):
                continue
            start, end = segment.split("-", 1)
            try:
                slots.extend([time_24(start), time_24(end)])
            except ValueError:
                continue
        if slots:
            result[day] = list(dict.fromkeys(slots))
    return result


def languages(value):
    result = []
    for language, level in re.findall(r"([^;()]+?)\s*\((A[12]|B[12]|C[12])\)", meaningful(value)):
        result.append({"language": language.strip(), "level": level})
    return result


def interview_status(value):
    return StudentProfile.Interview.CONDUCTED if affirmative(value) else StudentProfile.Interview.PENDING


def source_notes(row):
    source_id = row["A"]
    comments = row.get("BL", "")
    return f"Imported from workbook record {source_id}." + (f" {comments}" if comments else "")


class Command(BaseCommand):
    help = "Import people and pairing history from the RELT participant-register XLSX file."

    def add_arguments(self, parser):
        parser.add_argument("workbook", nargs="?", default="import_these.xlsx")
        parser.add_argument("--password", default="relt-demo-2026", help="Password assigned to newly created demo accounts.")
        parser.add_argument("--dry-run", action="store_true")

    @transaction.atomic
    def handle(self, *args, **options):
        workbook = Path(options["workbook"])
        if not workbook.is_absolute():
            workbook = Path.cwd() / workbook
        if not workbook.is_file():
            raise CommandError(f"Workbook not found: {workbook}")

        rows = register_rows(workbook)
        created = {"students": 0, "tutors": 0, "users": 0, "pairings": 0}
        profiles = {}
        for row in rows:
            is_tutor = row["H"].lower() == "tutor"
            role = User.Role.TUTOR if is_tutor else User.Role.STUDENT
            user, user_created = User.objects.get_or_create(
                email=row["C"].lower(), defaults={"role": role}
            )
            if user_created:
                user.set_password(options["password"])
                user.save(update_fields=["password"])
                created["users"] += 1
            elif user.role != role:
                user.role = role
                user.save(update_fields=["role"])

            assessment = row.get("AO", "").upper()
            person_defaults = {
                "full_name": row["B"], "phone_number": phone(row["D"]),
                "emergency_contact_name": row.get("E", ""),
                "emergency_contact_phone": phone(row.get("F", "")),
                "emergency_contact_relationship": row.get("G", ""),
                "status": status(row.get("J", "")), "notes": source_notes(row),
                "timezone": meaningful(row.get("W", "")) or "Australia/Sydney",
                "availability": availability(row), "mode": mode(row.get("AE", "")),
                "address": {"suburb": row.get("AI", ""), "state": row.get("AH", ""),
                            "postcode": row.get("AJ", ""), "country": row.get("AG", "")},
                "gender": meaningful(row.get("AL", "")),
                "same_gender_pairing_required": affirmative(row.get("AM", "")),
                "qualitative_assessment": assessment if assessment in Person.Assessment.values else "",
                "national_background": meaningful(row.get("AP", "")),
                "ethnic_background": meaningful(row.get("AQ", "")),
                "religious_background": meaningful(row.get("AS", "")),
                "job_study_category": meaningful(row.get("AT", "")),
                "current_profession": meaningful(row.get("AU", "")),
                "hobbies_interests": meaningful(row.get("AW", "")),
                "reference_check_conducted": affirmative(row.get("AZ", "")),
                "referee_name": row.get("BA", ""), "referee_relationship": row.get("BB", ""),
                "referee_contact": row.get("BC", ""), "pathway_to_program": row.get("BI", ""),
                "assessor": row.get("BJ", ""), "matcher": row.get("BK", ""),
            }
            person, _ = Person.objects.update_or_create(user=user, defaults=person_defaults)
            if is_tutor:
                profile, profile_created = TutorProfile.objects.update_or_create(
                    person=person,
                    defaults={"other_languages": languages(row.get("AR", "")),
                              "approved_to_tutor": affirmative(row.get("BH", "")),
                              "capacity": max(int(float(row.get("O") or 1)), 1)},
                )
                created["tutors"] += profile_created
            else:
                english_level = meaningful(row.get("AN", "")).upper()
                profile, profile_created = StudentProfile.objects.update_or_create(
                    person=person,
                    defaults={"english_level": english_level if english_level in Person.CEFR.values else "",
                              "linguistic_background": meaningful(row.get("AR", "")),
                              "intended_profession": meaningful(row.get("AV", "")),
                              "refugee_asylum_assessment": meaningful(row.get("AX", "")),
                              "interview_conducted": interview_status(row.get("AY", ""))},
                )
                created["students"] += profile_created
            profiles[row["A"]] = profile

        for row in rows:
            if row["H"].lower() != "tutor":
                continue
            tutor = profiles[row["A"]]
            for pairing_id, start_column, end_column in (("BO", "BQ", "BR"), ("BU", "BW", "BX"), ("CA", "CC", "CD"), ("CG", "CI", "CJ"), ("CM", "CO", "CP")):
                student_id = row.get(pairing_id, "")
                student = profiles.get(student_id)
                start = excel_date(row.get(start_column, ""))
                if not student or not start:
                    continue
                pairing, pairing_created = Pairing.objects.update_or_create(
                    tutor=tutor, student=student,
                    defaults={"start_date": start, "session_time": {"day": "MONDAY", "time": "18:00"},
                              "status": Pairing.Status.STOPPED if row.get(end_column) else Pairing.Status.ACTIVE},
                )
                created["pairings"] += pairing_created

        if options["dry_run"]:
            transaction.set_rollback(True)
            self.stdout.write(self.style.WARNING(f"Dry run: would import {len(rows)} people; {created}"))
        else:
            self.stdout.write(self.style.SUCCESS(f"Imported {len(rows)} people; {created}"))
