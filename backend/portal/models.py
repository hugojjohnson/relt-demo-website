from django.contrib.auth.models import AbstractUser, BaseUserManager
from django.core.validators import RegexValidator
from django.db import models

phone_validator = RegexValidator(
    r"^\+[1-9]\d{6,14}$", "Use an international number, e.g. +61412345678."
)


class UserManager(BaseUserManager):
    def create_user(self, email, password=None, **extra):
        if not email:
            raise ValueError("Email is required")
        user = self.model(email=self.normalize_email(email), **extra)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_superuser(self, email, password=None, **extra):
        extra.setdefault("role", User.Role.ADMIN)
        extra.setdefault("is_staff", True)
        extra.setdefault("is_superuser", True)
        return self.create_user(email, password, **extra)


class User(AbstractUser):
    class Role(models.TextChoices):
        ADMIN = "ADMIN", "Admin"
        STUDENT = "STUDENT", "Student"
        TUTOR = "TUTOR", "Tutor"

    username = None
    email = models.EmailField(unique=True)
    role = models.CharField(max_length=12, choices=Role.choices, default=Role.STUDENT)
    USERNAME_FIELD = "email"
    REQUIRED_FIELDS = []
    objects = UserManager()


class Person(models.Model):
    class Status(models.TextChoices):
        ACTIVE = "ACTIVE", "Active"
        REJECTED = "REJECTED", "Rejected"
        BLACKLISTED = "BLACKLISTED", "Blacklisted"
        INACTIVE = "INACTIVE", "Inactive"

    class Mode(models.TextChoices):
        IN_PERSON = "IN_PERSON", "In person"
        ONLINE = "ONLINE", "Online"

    class Assessment(models.TextChoices):
        LOW = "LOW", "Low"
        MODERATE = "MODERATE", "Moderate"
        HIGH = "HIGH", "High"
        OUTSTANDING = "OUTSTANDING", "Outstanding"

    class CEFR(models.TextChoices):
        A1 = "A1", "A1"
        A2 = "A2", "A2"
        B1 = "B1", "B1"
        B2 = "B2", "B2"
        C1 = "C1", "C1"
        C2 = "C2", "C2"

    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name="person")
    full_name = models.CharField(max_length=255)
    nickname = models.CharField(max_length=100, blank=True)
    phone_number = models.CharField(max_length=16, validators=[phone_validator])
    emergency_contact_name = models.CharField(max_length=255, blank=True)
    emergency_contact_phone = models.CharField(
        max_length=16, blank=True, validators=[phone_validator]
    )
    emergency_contact_relationship = models.CharField(max_length=100, blank=True)
    application_date = models.DateTimeField(auto_now_add=True)
    status = models.CharField(
        max_length=12, choices=Status.choices, default=Status.ACTIVE
    )
    notes = models.TextField(blank=True)
    timezone = models.CharField(max_length=64, default="Australia/Sydney")
    availability = models.JSONField(
        default=dict, blank=True, help_text='{"MONDAY":["09:00","10:00"]}'
    )
    mode = models.CharField(max_length=12, choices=Mode.choices, default=Mode.ONLINE)
    address = models.JSONField(
        default=dict,
        blank=True,
        help_text='{"line1":"", "suburb":"", "state":"", "postcode":"", "country":""}',
    )
    gender = models.CharField(max_length=100, blank=True)
    same_gender_pairing_required = models.BooleanField(default=False)
    qualitative_assessment = models.CharField(
        max_length=12, choices=Assessment.choices, blank=True
    )
    national_background = models.CharField(max_length=255, blank=True)
    ethnic_background = models.CharField(max_length=255, blank=True)
    religious_background = models.CharField(max_length=255, blank=True)
    job_study_category = models.CharField(max_length=255, blank=True)
    current_profession = models.CharField(max_length=255, blank=True)
    hobbies_interests = models.TextField(blank=True)
    reference_check_conducted = models.BooleanField(default=False)
    referee_name = models.CharField(max_length=255, blank=True)
    referee_relationship = models.CharField(max_length=255, blank=True)
    referee_contact = models.CharField(max_length=255, blank=True)
    pathway_to_program = models.CharField(max_length=255, blank=True)
    assessor = models.CharField(max_length=255, blank=True)
    matcher = models.CharField(max_length=255, blank=True)

    class Meta:
        ordering = ["full_name"]

    def __str__(self):
        return self.full_name


class StudentProfile(models.Model):
    class Interview(models.TextChoices):
        PENDING = "PENDING", "Pending"
        CONDUCTED = "CONDUCTED", "Conducted"
        FOLLOW_UP = "FOLLOW_UP", "Follow up required"

    person = models.OneToOneField(
        Person, on_delete=models.CASCADE, related_name="student_profile"
    )
    english_level = models.CharField(
        max_length=2, choices=Person.CEFR.choices, blank=True
    )
    linguistic_background = models.CharField(max_length=255, blank=True)
    intended_profession = models.CharField(max_length=255, blank=True)
    refugee_asylum_assessment = models.TextField(blank=True)
    interview_conducted = models.CharField(
        max_length=12, choices=Interview.choices, default=Interview.PENDING
    )


class TutorProfile(models.Model):
    person = models.OneToOneField(
        Person, on_delete=models.CASCADE, related_name="tutor_profile"
    )
    other_languages = models.JSONField(
        default=list, blank=True, help_text='[{"language":"Arabic","level":"B2"}]'
    )
    approved_to_tutor = models.BooleanField(default=False)
    capacity = models.PositiveSmallIntegerField(default=1)


class Pairing(models.Model):
    class Status(models.TextChoices):
        ACTIVE = "ACTIVE", "Active"
        STOPPED = "STOPPED", "Stopped"

    tutor = models.ForeignKey(
        TutorProfile, on_delete=models.PROTECT, related_name="pairings"
    )
    student = models.ForeignKey(
        StudentProfile, on_delete=models.PROTECT, related_name="pairings"
    )
    start_date = models.DateField()
    session_time = models.JSONField(
        default=dict, help_text='{"day":"MONDAY", "time":"10:00"}'
    )
    status = models.CharField(
        max_length=10, choices=Status.choices, default=Status.ACTIVE
    )

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["tutor", "student"], name="unique_pairing")
        ]


class TutoringSession(models.Model):
    pairing = models.ForeignKey(
        Pairing, on_delete=models.CASCADE, related_name="sessions"
    )
    session_notes = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)
