import graphene
from django.contrib.auth import authenticate, login, logout
from django.core.exceptions import ValidationError
from django.db.models import Count, Q
from graphene_django import DjangoObjectType
from .models import User, Person, StudentProfile, TutorProfile, Pairing, TutoringSession

class UserType(DjangoObjectType):
    class Meta: model = User; fields = ("id", "email", "role")
class PersonType(DjangoObjectType):
    class Meta: model = Person; fields = "__all__"
class StudentType(DjangoObjectType):
    class Meta: model = StudentProfile; fields = "__all__"
class TutorType(DjangoObjectType):
    active_pairing_count = graphene.Int()
    class Meta: model = TutorProfile; fields = "__all__"
    def resolve_active_pairing_count(root, info): return root.pairings.filter(status=Pairing.Status.ACTIVE).count()
class PairingType(DjangoObjectType):
    class Meta: model = Pairing; fields = "__all__"
class SessionType(DjangoObjectType):
    class Meta: model = TutoringSession; fields = "__all__"

def is_admin(info): return info.context.user.is_authenticated and info.context.user.role == User.Role.ADMIN
def own_person(info, person_id): return info.context.user.is_authenticated and str(info.context.user.person.id) == str(person_id)

class Query(graphene.ObjectType):
    me = graphene.Field(UserType)
    my_person = graphene.Field(PersonType)
    person = graphene.Field(PersonType, id=graphene.ID(required=True))
    students = graphene.List(StudentType)
    tutors = graphene.List(TutorType, available_only=graphene.Boolean())
    pairings = graphene.List(PairingType)
    def resolve_me(root, info): return info.context.user if info.context.user.is_authenticated else None
    def resolve_my_person(root, info):
        if not info.context.user.is_authenticated: return None
        return getattr(info.context.user, "person", None)
    def resolve_person(root, info, id):
        if not is_admin(info): raise Exception("Administrator access required")
        return Person.objects.get(pk=id)
    def resolve_students(root, info):
        if not is_admin(info): raise Exception("Administrator access required")
        return StudentProfile.objects.select_related("person__user")
    def resolve_tutors(root, info, available_only=False):
        if not is_admin(info): raise Exception("Administrator access required")
        qs = TutorProfile.objects.select_related("person__user").annotate(active_count=Count("pairings", filter=Q(pairings__status=Pairing.Status.ACTIVE)))
        if available_only:
            return [tutor for tutor in qs if tutor.approved_to_tutor and tutor.active_count < tutor.capacity]
        return qs
    def resolve_pairings(root, info):
        if not is_admin(info): raise Exception("Administrator access required")
        return Pairing.objects.select_related("tutor__person", "student__person")

class Login(graphene.Mutation):
    class Arguments: email = graphene.String(required=True); password = graphene.String(required=True)
    ok = graphene.Boolean(); user = graphene.Field(UserType); error = graphene.String()
    def mutate(root, info, email, password):
        user = authenticate(info.context, email=email, password=password)
        if not user: return Login(ok=False, error="Incorrect email or password.")
        login(info.context, user); return Login(ok=True, user=user)
class Logout(graphene.Mutation):
    ok = graphene.Boolean()
    def mutate(root, info): logout(info.context); return Logout(ok=True)

class SavePerson(graphene.Mutation):
    class Arguments: person_id=graphene.ID(required=True); data=graphene.JSONString(required=True)
    person = graphene.Field(PersonType)
    def mutate(root, info, person_id, data):
        if not (is_admin(info) or own_person(info, person_id)): raise Exception("Not authorised")
        person = Person.objects.get(pk=person_id)
        protected = {"user", "application_date", "id"}
        for key, value in data.items():
            if key not in protected and hasattr(person, key): setattr(person, key, value)
        try: person.full_clean(); person.save()
        except ValidationError as e: raise Exception(e.message_dict)
        return SavePerson(person=person)

class CreatePairing(graphene.Mutation):
    class Arguments: tutor_id=graphene.ID(required=True); student_id=graphene.ID(required=True); start_date=graphene.Date(required=True); session_time=graphene.JSONString(required=True)
    pairing = graphene.Field(PairingType)
    def mutate(root, info, tutor_id, student_id, start_date, session_time):
        if not is_admin(info): raise Exception("Administrator access required")
        tutor = TutorProfile.objects.get(pk=tutor_id)
        if not tutor.approved_to_tutor: raise Exception("Tutor is not approved")
        if tutor.pairings.filter(status=Pairing.Status.ACTIVE).count() >= tutor.capacity: raise Exception("Tutor is at capacity")
        pairing = Pairing.objects.create(tutor=tutor, student_id=student_id, start_date=start_date, session_time=session_time)
        return CreatePairing(pairing=pairing)
class Mutation(graphene.ObjectType):
    login = Login.Field(); logout = Logout.Field(); save_person = SavePerson.Field(); create_pairing = CreatePairing.Field()
schema = graphene.Schema(query=Query, mutation=Mutation)
