import graphene
from django.contrib.auth import authenticate, login, logout
from django.core.exceptions import ValidationError
from django.db.models import Count, Q
from graphene_django import DjangoObjectType
from .models import User, Person, StudentProfile, TutorProfile, Pairing, TutoringSession


class UserType(DjangoObjectType):
    class Meta:
        model = User
        fields = ("id", "email", "role")


class PersonType(DjangoObjectType):
    class Meta:
        model = Person
        fields = "__all__"


class StudentType(DjangoObjectType):
    active_pairing_count = graphene.Int()

    class Meta:
        model = StudentProfile
        fields = "__all__"

    def resolve_active_pairing_count(root, info):
        return root.pairings.filter(status=Pairing.Status.ACTIVE).count()


class TutorType(DjangoObjectType):
    active_pairing_count = graphene.Int()

    class Meta:
        model = TutorProfile
        fields = "__all__"

    def resolve_active_pairing_count(root, info):
        return root.pairings.filter(status=Pairing.Status.ACTIVE).count()


class PairingType(DjangoObjectType):
    class Meta:
        model = Pairing
        fields = "__all__"


class SessionType(DjangoObjectType):
    class Meta:
        model = TutoringSession
        fields = "__all__"


def is_admin(info):
    return (
        info.context.user.is_authenticated and info.context.user.role == User.Role.ADMIN
    )


def own_person(info, person_id):
    return info.context.user.is_authenticated and str(
        info.context.user.person.id
    ) == str(person_id)


def availability_slots(availability):
    """Normalise imported availability values into comparable day/hour pairs."""
    slots = set()
    for day, hours in (availability or {}).items():
        if isinstance(hours, dict):
            hours = [hour for hour, selected in hours.items() if selected]
        elif isinstance(hours, str):
            hours = [hour.strip() for hour in hours.split(",")]
        elif not isinstance(hours, (list, tuple, set)):
            hours = []
        slots.update((day, str(hour)) for hour in hours)
    return slots


class Query(graphene.ObjectType):
    me = graphene.Field(UserType)
    my_person = graphene.Field(PersonType)
    person = graphene.Field(PersonType, id=graphene.ID(required=True))
    student = graphene.Field(StudentType, id=graphene.ID(required=True))
    tutor = graphene.Field(TutorType, id=graphene.ID(required=True))
    students = graphene.List(StudentType)
    tutors = graphene.List(TutorType, available_only=graphene.Boolean())
    pairings = graphene.List(PairingType)

    def resolve_me(root, info):
        return info.context.user if info.context.user.is_authenticated else None

    def resolve_my_person(root, info):
        if not info.context.user.is_authenticated:
            return None
        return getattr(info.context.user, "person", None)

    def resolve_person(root, info, id):
        if not is_admin(info):
            raise Exception("Administrator access required")
        return Person.objects.get(pk=id)

    def resolve_students(root, info):
        if not is_admin(info):
            raise Exception("Administrator access required")
        return StudentProfile.objects.select_related("person__user")

    def resolve_student(root, info, id):
        if not is_admin(info):
            raise Exception("Administrator access required")
        return StudentProfile.objects.select_related("person__user").get(pk=id)

    def resolve_tutors(root, info, available_only=False):
        if not is_admin(info):
            raise Exception("Administrator access required")
        qs = TutorProfile.objects.select_related("person__user").annotate(
            active_count=Count(
                "pairings", filter=Q(pairings__status=Pairing.Status.ACTIVE)
            )
        )
        if available_only:
            return [
                tutor
                for tutor in qs
                if tutor.approved_to_tutor and tutor.active_count < tutor.capacity
            ]
        return qs

    def resolve_tutor(root, info, id):
        if not is_admin(info):
            raise Exception("Administrator access required")
        return TutorProfile.objects.select_related("person__user").get(pk=id)

    def resolve_pairings(root, info):
        if not is_admin(info):
            raise Exception("Administrator access required")
        return Pairing.objects.select_related("tutor__person", "student__person")


class Login(graphene.Mutation):
    class Arguments:
        email = graphene.String(required=True)
        password = graphene.String(required=True)

    ok = graphene.Boolean()
    user = graphene.Field(UserType)
    error = graphene.String()

    def mutate(root, info, email, password):
        user = authenticate(info.context, email=email, password=password)
        if not user:
            return Login(ok=False, error="Incorrect email or password.")
        login(info.context, user)
        return Login(ok=True, user=user)


class Logout(graphene.Mutation):
    ok = graphene.Boolean()

    def mutate(root, info):
        logout(info.context)
        return Logout(ok=True)


class SavePerson(graphene.Mutation):
    class Arguments:
        person_id = graphene.ID(required=True)
        data = graphene.JSONString(required=True)

    person = graphene.Field(PersonType)

    def mutate(root, info, person_id, data):
        if not (is_admin(info) or own_person(info, person_id)):
            raise Exception("Not authorised")
        person = Person.objects.get(pk=person_id)
        try:
            save_person_fields(person, data)
        except ValidationError as e:
            raise Exception(e.message_dict)
        return SavePerson(person=person)


def save_person_fields(person, data):
    protected = {"user", "application_date", "id", "email", "password"}
    for key, value in data.items():
        field = "".join("_" + char.lower() if char.isupper() else char for char in key)
        if field not in protected and hasattr(person, field):
            setattr(person, field, value)
    person.full_clean()
    person.save()


class SaveStudent(graphene.Mutation):
    class Arguments:
        student_id = graphene.ID(required=True)
        person_data = graphene.JSONString(required=True)
        profile_data = graphene.JSONString(required=True)
        email = graphene.String(required=True)

    student = graphene.Field(StudentType)

    def mutate(root, info, student_id, person_data, profile_data, email):
        if not is_admin(info):
            raise Exception("Administrator access required")
        student = StudentProfile.objects.select_related("person__user").get(
            pk=student_id
        )
        save_person_fields(student.person, person_data)
        for key, value in profile_data.items():
            field = "".join(
                "_" + char.lower() if char.isupper() else char for char in key
            )
            if field not in {"id", "person"} and hasattr(student, field):
                setattr(student, field, value)
        student.full_clean()
        student.save()
        user = student.person.user
        user.email = email
        user.full_clean()
        user.save()
        return SaveStudent(student=student)


class SaveTutor(graphene.Mutation):
    class Arguments:
        tutor_id = graphene.ID(required=True)
        person_data = graphene.JSONString(required=True)
        profile_data = graphene.JSONString(required=True)
        email = graphene.String(required=True)

    tutor = graphene.Field(TutorType)

    def mutate(root, info, tutor_id, person_data, profile_data, email):
        if not is_admin(info):
            raise Exception("Administrator access required")
        tutor = TutorProfile.objects.select_related("person__user").get(pk=tutor_id)
        save_person_fields(tutor.person, person_data)
        for key, value in profile_data.items():
            field = "".join(
                "_" + char.lower() if char.isupper() else char for char in key
            )
            if field not in {"id", "person", "active_pairing_count"} and hasattr(
                tutor, field
            ):
                setattr(tutor, field, value)
        tutor.full_clean()
        tutor.save()
        user = tutor.person.user
        user.email = email
        user.full_clean()
        user.save()
        return SaveTutor(tutor=tutor)


class CreateStudent(graphene.Mutation):
    class Arguments:
        person_data = graphene.JSONString(required=True)
        profile_data = graphene.JSONString(required=True)
        email = graphene.String(required=True)
        password = graphene.String(required=True)

    student = graphene.Field(StudentType)

    def mutate(root, info, person_data, profile_data, email, password):
        if not is_admin(info):
            raise Exception("Administrator access required")
        user = User.objects.create_user(
            email=email, password=password, role=User.Role.STUDENT
        )
        try:
            person = Person(
                user=user,
                full_name=person_data.get("fullName") or "New student",
                phone_number=person_data.get("phoneNumber") or "+61000000000",
            )
            save_person_fields(person, person_data)
            student = StudentProfile.objects.create(
                person=person,
                **{
                    "".join("_" + c.lower() if c.isupper() else c for c in k): v
                    for k, v in profile_data.items()
                    if k not in {"id", "person"}
                }
            )
        except Exception:
            user.delete()
            raise
        return CreateStudent(student=student)


class CreateTutor(graphene.Mutation):
    class Arguments:
        person_data = graphene.JSONString(required=True)
        profile_data = graphene.JSONString(required=True)
        email = graphene.String(required=True)
        password = graphene.String(required=True)

    tutor = graphene.Field(TutorType)

    def mutate(root, info, person_data, profile_data, email, password):
        if not is_admin(info):
            raise Exception("Administrator access required")
        user = User.objects.create_user(
            email=email, password=password, role=User.Role.TUTOR
        )
        try:
            person = Person(
                user=user,
                full_name=person_data.get("fullName") or "New tutor",
                phone_number=person_data.get("phoneNumber") or "+61000000000",
            )
            save_person_fields(person, person_data)
            tutor = TutorProfile.objects.create(
                person=person,
                **{
                    "".join("_" + c.lower() if c.isupper() else c for c in k): v
                    for k, v in profile_data.items()
                    if k not in {"id", "person", "activePairingCount"}
                }
            )
        except Exception:
            user.delete()
            raise
        return CreateTutor(tutor=tutor)


class CreatePairing(graphene.Mutation):
    class Arguments:
        tutor_id = graphene.ID(required=True)
        student_id = graphene.ID(required=True)
        start_date = graphene.Date(required=True)
        session_time = graphene.JSONString(required=True)

    pairing = graphene.Field(PairingType)

    def mutate(root, info, tutor_id, student_id, start_date, session_time):
        if not is_admin(info):
            raise Exception("Administrator access required")
        tutor = TutorProfile.objects.get(pk=tutor_id)
        student = StudentProfile.objects.get(pk=student_id)
        tutor_person, student_person = tutor.person, student.person
        if tutor_person.status in {Person.Status.BLACKLISTED, Person.Status.REJECTED}:
            raise Exception("Tutor is unavailable for matching")
        if not tutor.approved_to_tutor:
            raise Exception("Tutor is not approved")
        if (
            tutor.pairings.filter(status=Pairing.Status.ACTIVE).count()
            >= tutor.capacity
        ):
            raise Exception("Tutor is at capacity")
        if tutor_person.mode != student_person.mode:
            raise Exception("Tutor and student have incompatible delivery preferences")
        tutor_hours = availability_slots(tutor_person.availability)
        student_hours = availability_slots(student_person.availability)
        if not tutor_hours.intersection(student_hours):
            raise Exception("Tutor and student have no shared availability")
        if (
            student_person.same_gender_pairing_required
            and tutor_person.gender != student_person.gender
        ):
            raise Exception("Student requested a same-gender tutor")
        pairing = Pairing.objects.create(
            tutor=tutor,
            student=student,
            start_date=start_date,
            session_time=session_time,
        )
        return CreatePairing(pairing=pairing)


class Mutation(graphene.ObjectType):
    login = Login.Field()
    logout = Logout.Field()
    save_person = SavePerson.Field()
    save_student = SaveStudent.Field()
    save_tutor = SaveTutor.Field()
    create_student = CreateStudent.Field()
    create_tutor = CreateTutor.Field()
    create_pairing = CreatePairing.Field()


schema = graphene.Schema(query=Query, mutation=Mutation)
