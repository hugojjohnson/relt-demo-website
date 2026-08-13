import { useEffect, useMemo, useState } from "react";
import {
  Navigate,
  NavLink,
  Route,
  Routes,
  useNavigate,
  useParams,
} from "react-router-dom";
import {
  BookOpen,
  LogOut,
  Users,
  Link2,
  UserRound,
  ArrowLeft,
} from "lucide-react";
import logo from "../public/logo.png";
import { gql } from "./api";
import type { Person, Student, Tutor } from "./types";
import { choices, Field, Picker, Section, TextArea, Toggle } from "./ui/forms";
import { Status } from "./ui/Status";
import { Directory } from "./admin/Directory";
import { AdminPage } from "./admin/AdminPage";
import { rankTutorsForStudent } from "./matching";

type Me = { id: string; email: string; role: string };
type Kind = "students" | "tutors";
const ME = `query { me { id email role } }`;
const PERSON_FIELDS = `id fullName nickname phoneNumber emergencyContactName emergencyContactPhone emergencyContactRelationship applicationDate status notes timezone availability mode address gender sameGenderPairingRequired qualitativeAssessment nationalBackground ethnicBackground religiousBackground jobStudyCategory currentProfession hobbiesInterests referenceCheckConducted refereeName refereeRelationship refereeContact pathwayToProgram assessor matcher user { email }`;
const STUDENT_FIELDS = `id activePairingCount englishLevel linguisticBackground intendedProfession refugeeAsylumAssessment interviewConducted person { ${PERSON_FIELDS} }`;
const TUTOR_FIELDS = `id otherLanguages approvedToTutor wwccProvided capacity activePairingCount person { ${PERSON_FIELDS} }`;
const emptyPerson: Person = {
  id: "",
  fullName: "",
  nickname: "",
  phoneNumber: "",
  emergencyContactName: "",
  emergencyContactPhone: "",
  emergencyContactRelationship: "",
  applicationDate: "",
  status: "ACTIVE",
  notes: "",
  timezone: "Australia/Sydney",
  availability: {},
  mode: "ONLINE",
  address: {},
  gender: "",
  sameGenderPairingRequired: false,
  qualitativeAssessment: "",
  nationalBackground: "",
  ethnicBackground: "",
  religiousBackground: "",
  jobStudyCategory: "",
  currentProfession: "",
  hobbiesInterests: "",
  referenceCheckConducted: false,
  refereeName: "",
  refereeRelationship: "",
  refereeContact: "",
  pathwayToProgram: "",
  assessor: "",
  matcher: "",
  user: { email: "" },
};

function Brand() {
  return (
    <div className="brand">
      <img src={logo} alt="RELT" />
    </div>
  );
}
function Login({ done }: { done: (u: Me) => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    try {
      const r = await gql<{ login: { ok: boolean; user: Me; error?: string } }>(
        `mutation($email:String!,$password:String!){login(email:$email,password:$password){ok error user{id email role}}}`,
        { email, password },
      );
      r.login.ok
        ? done(r.login.user)
        : setError(r.login.error || "Unable to sign in");
    } catch (e) {
      setError(String(e));
    }
  }
  return (
    <main className="login">
      <Brand />
      <h1>Program portal</h1>
      <p>Sign in to manage your tutoring journey.</p>
      <form onSubmit={submit}>
        <Field
          label="Email address"
          value={email}
          onChange={setEmail}
          type="email"
        />
        <Field
          label="Password"
          value={password}
          onChange={setPassword}
          type="password"
        />
        {error && <p className="error">{error}</p>}
        <button>Sign in</button>
      </form>
    </main>
  );
}

function PersonFields({
  person,
  setPerson,
}: {
  person: Person;
  setPerson: (p: Person) => void;
}) {
  const set = (key: keyof Person, value: unknown) =>
    setPerson({ ...person, [key]: value });
  const json = (
    key: "availability" | "address",
    label: string,
    help: string,
  ) => (
    <TextArea
      label={`${label} — ${help}`}
      value={JSON.stringify(person[key] || {}, null, 2)}
      onChange={(v) => {
        try {
          set(key, JSON.parse(v));
        } catch {
          /* retain value until valid JSON */
        }
      }}
    />
  );
  return (
    <>
      <Section title="Contact details">
        <Field
          label="Full name"
          value={person.fullName}
          onChange={(v) => set("fullName", v)}
        />
        <Field
          label="Preferred name"
          value={person.nickname}
          onChange={(v) => set("nickname", v)}
        />
        <Field
          label="Phone number"
          value={person.phoneNumber}
          onChange={(v) => set("phoneNumber", v)}
        />
        <Field
          label="Timezone"
          value={person.timezone}
          onChange={(v) => set("timezone", v)}
        />
        <Picker
          label="Delivery preference"
          value={person.mode}
          options={choices.mode}
          onChange={(v) => set("mode", v)}
        />
        {json("address", "Address", 'JSON, e.g. {"suburb":"Parramatta"}')}
      </Section>
      <Section title="Emergency contact">
        <Field
          label="Name"
          value={person.emergencyContactName}
          onChange={(v) => set("emergencyContactName", v)}
        />
        <Field
          label="Phone number"
          value={person.emergencyContactPhone}
          onChange={(v) => set("emergencyContactPhone", v)}
        />
        <Field
          label="Relationship"
          value={person.emergencyContactRelationship}
          onChange={(v) => set("emergencyContactRelationship", v)}
        />
      </Section>
      <Section title="Matching information">
        <Field
          label="Gender"
          value={person.gender}
          onChange={(v) => set("gender", v)}
        />
        <Toggle
          label="Requires same-gender tutor"
          checked={person.sameGenderPairingRequired}
          onChange={(v) => set("sameGenderPairingRequired", v)}
        />
        <Picker
          label="Qualitative assessment"
          value={person.qualitativeAssessment}
          options={choices.assessment}
          onChange={(v) => set("qualitativeAssessment", v)}
        />
        {json(
          "availability",
          "Weekly availability",
          'JSON, e.g. {"MONDAY":["10:00"]}',
        )}
      </Section>
      <Section title="Background">
        <Field
          label="National background"
          value={person.nationalBackground}
          onChange={(v) => set("nationalBackground", v)}
        />
        <Field
          label="Ethnic background"
          value={person.ethnicBackground}
          onChange={(v) => set("ethnicBackground", v)}
        />
        <Field
          label="Religious background"
          value={person.religiousBackground}
          onChange={(v) => set("religiousBackground", v)}
        />
        <Field
          label="Job / study category"
          value={person.jobStudyCategory}
          onChange={(v) => set("jobStudyCategory", v)}
        />
        <Field
          label="Current profession"
          value={person.currentProfession}
          onChange={(v) => set("currentProfession", v)}
        />
        <TextArea
          label="Hobbies & interests"
          value={person.hobbiesInterests}
          onChange={(v) => set("hobbiesInterests", v)}
        />
      </Section>
      <Section title="Program administration">
        <Picker
          label="Status"
          value={person.status}
          options={choices.status}
          onChange={(v) => set("status", v)}
        />
        <Field
          label="Pathway to program"
          value={person.pathwayToProgram}
          onChange={(v) => set("pathwayToProgram", v)}
        />
        <Field
          label="Assessor"
          value={person.assessor}
          onChange={(v) => set("assessor", v)}
        />
        <Field
          label="Matcher"
          value={person.matcher}
          onChange={(v) => set("matcher", v)}
        />
        <Toggle
          label="Reference check conducted"
          checked={person.referenceCheckConducted}
          onChange={(v) => set("referenceCheckConducted", v)}
        />
        <Field
          label="Referee name"
          value={person.refereeName}
          onChange={(v) => set("refereeName", v)}
        />
        <Field
          label="Referee relationship"
          value={person.refereeRelationship}
          onChange={(v) => set("refereeRelationship", v)}
        />
        <Field
          label="Referee contact"
          value={person.refereeContact}
          onChange={(v) => set("refereeContact", v)}
        />
        <TextArea
          label="Notes"
          value={person.notes}
          onChange={(v) => set("notes", v)}
        />
      </Section>
    </>
  );
}

function PersonEditor({
  kind,
  adding = false,
}: {
  kind: Kind;
  adding?: boolean;
}) {
  const { id } = useParams();
  const navigate = useNavigate();
  const [person, setPerson] = useState<Person>(emptyPerson);
  const [profile, setProfile] = useState<Record<string, any>>(
    kind === "students"
      ? {
          englishLevel: "",
          linguisticBackground: "",
          intendedProfession: "",
          refugeeAsylumAssessment: "",
          interviewConducted: "PENDING",
        }
      : { otherLanguages: [], approvedToTutor: false, wwccProvided: false, capacity: 1 },
  );
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  useEffect(() => {
    if (!adding && id)
      gql<any>(
        `query($id:ID!){${kind.slice(0, -1)}(id:$id){${kind === "students" ? STUDENT_FIELDS : TUTOR_FIELDS}}}`,
        { id },
      ).then((data) => {
        const value = data[kind.slice(0, -1)];
        setPerson(value.person);
        setProfile(value);
        setEmail(value.person.user.email);
      });
  }, [adding, id, kind]);
  async function save() {
    try {
      const personData = { ...person };
      delete (personData as any).id;
      delete (personData as any).user;
      delete (personData as any).applicationDate;
      const profileData = { ...profile };
      delete profileData.id;
      delete profileData.person;
      delete profileData.activePairingCount;
      const operation = adding
        ? `create${kind === "students" ? "Student" : "Tutor"}`
        : `save${kind === "students" ? "Student" : "Tutor"}`;
      const args = adding
        ? "$person:JSONString!,$profile:JSONString!,$email:String!,$password:String!"
        : "$id:ID!,$person:JSONString!,$profile:JSONString!,$email:String!";
      const input: any = {
        person: JSON.stringify(personData),
        profile: JSON.stringify(profileData),
        email,
      };
      if (adding) input.password = password;
      else input.id = id;
      const result = await gql<any>(
        `mutation(${args}){${operation}(${adding ? "" : " " + (kind === "students" ? "studentId" : "tutorId") + ":$id,"}personData:$person,profileData:$profile,email:$email${adding ? ",password:$password" : ""}){${kind.slice(0, -1)}{id}}}`,
        input,
      );
      setMessage("Saved.");
      if (adding)
        navigate(`/${kind}/${result[operation][kind.slice(0, -1)].id}/edit`);
    } catch (e) {
      setMessage(String(e));
    }
  }
  const singular = kind.slice(0, -1);
  return (
    <div className="page">
      <div className="page-heading">
        <div>
          <NavLink className="back" to={`/${kind}`}>
            <ArrowLeft size={16} /> {kind}
          </NavLink>
          <h1>{adding ? `Add ${singular}` : `Edit ${singular}`}</h1>
        </div>
        <button onClick={save}>Save {singular}</button>
      </div>
      {message && <p className="notice">{message}</p>}
      <section>
        <h2>Account</h2>
        <div className="form-grid">
          <Field label="Email" type="email" value={email} onChange={setEmail} />
          {adding && (
            <Field
              label="Temporary password"
              type="password"
              value={password}
              onChange={setPassword}
            />
          )}
        </div>
      </section>
      <PersonFields person={person} setPerson={setPerson} />
      <section>
        <h2>{kind === "students" ? "Student details" : "Tutor details"}</h2>
        {kind === "students" ? (
          <div className="form-grid">
            <Picker
              label="English level"
              value={profile.englishLevel || ""}
              options={choices.cefr}
              onChange={(v) => setProfile({ ...profile, englishLevel: v })}
            />
            <Picker
              label="Interview"
              value={profile.interviewConducted || ""}
              options={choices.interview}
              onChange={(v) =>
                setProfile({ ...profile, interviewConducted: v })
              }
            />
            <Field
              label="Linguistic background"
              value={profile.linguisticBackground || ""}
              onChange={(v) =>
                setProfile({ ...profile, linguisticBackground: v })
              }
            />
            <Field
              label="Intended profession"
              value={profile.intendedProfession || ""}
              onChange={(v) =>
                setProfile({ ...profile, intendedProfession: v })
              }
            />
            <TextArea
              label="Refugee / asylum assessment"
              value={profile.refugeeAsylumAssessment || ""}
              onChange={(v) =>
                setProfile({ ...profile, refugeeAsylumAssessment: v })
              }
            />
          </div>
        ) : (
          <div className="form-grid">
            <Field
              label="Capacity"
              type="number"
              value={String(profile.capacity ?? 1)}
              onChange={(v) => setProfile({ ...profile, capacity: Number(v) })}
            />
            <Toggle
              label="Approved to tutor"
              checked={!!profile.approvedToTutor}
              onChange={(v) => setProfile({ ...profile, approvedToTutor: v })}
            />
            <Toggle
              label="WWCC provided"
              checked={!!profile.wwccProvided}
              onChange={(v) => setProfile({ ...profile, wwccProvided: v })}
            />
            <TextArea
              label="Other languages — JSON list"
              value={JSON.stringify(profile.otherLanguages || [], null, 2)}
              onChange={(v) => {
                try {
                  setProfile({ ...profile, otherLanguages: JSON.parse(v) });
                } catch {}
              }}
            />
          </div>
        )}
      </section>
    </div>
  );
}

function Pairings() {
  const [data, setData] = useState<{
    students: Student[];
    tutors: Tutor[];
    pairings: any[];
  } | null>(null);
  const [studentId, setStudentId] = useState("");
  const [tutorId, setTutorId] = useState("");
  const [message, setMessage] = useState("");
  const load = () =>
    gql<any>(
      `query{students{${STUDENT_FIELDS}} tutors{${TUTOR_FIELDS}} pairings{id startDate status tutor{id person{fullName}} student{id person{fullName}}}}`,
    ).then(setData);
  useEffect(() => {
    void load();
  }, []);
  const students = useMemo(
    () =>
      data?.students
        .slice()
        .sort(
          (a, b) =>
            (({ OUTSTANDING: 4, HIGH: 3, MODERATE: 2, LOW: 1 })[
              b.person.qualitativeAssessment
            ] || 0) -
              ({ OUTSTANDING: 4, HIGH: 3, MODERATE: 2, LOW: 1 }[
                a.person.qualitativeAssessment
              ] || 0) ||
            new Date(a.person.applicationDate).getTime() -
              new Date(b.person.applicationDate).getTime(),
        ) || [],
    [data],
  );
  useEffect(() => {
    if (!studentId && students[0]) setStudentId(students[0].id);
  }, [students, studentId]);
  const selected = students.find((s) => s.id === studentId);
  const matches =
    selected && data ? rankTutorsForStudent(selected, data.tutors) : [];
  async function create() {
    if (!selected || !tutorId) return;
    try {
      await gql(
        `mutation($t:ID!,$s:ID!,$d:Date!,$time:JSONString!){createPairing(tutorId:$t,studentId:$s,startDate:$d,sessionTime:$time){pairing{id}}}`,
        {
          t: tutorId,
          s: selected.id,
          d: new Date().toISOString().slice(0, 10),
          time: JSON.stringify({}),
        },
      );
      setMessage("Pairing created.");
      setTutorId("");
      load();
    } catch (e) {
      setMessage(String(e));
    }
  }
  if (!data) return <div className="page">Loading pairings…</div>;
  return (
    <div className="page">
      <div className="page-heading">
        <div>
          <p className="eyebrow">Administration</p>
          <h1>Create a new match</h1>
        </div>
      </div>
      {message && <p className="notice">{message}</p>}
      <div className="matching-board">
        <section className="student-list">
          <h2>
            Students <span>{students.length}</span>
          </h2>
          <p>Ordered by assessment, then application date.</p>
          {students.map((s) => (
            <button
              key={s.id}
              className={s.id === studentId ? "selected" : ""}
              onClick={() => {
                setStudentId(s.id);
                setTutorId("");
              }}
            >
              <strong>{s.person.fullName}</strong>
              <small>
                {s.person.qualitativeAssessment || "Not assessed"} · applied{" "}
                {new Date(s.person.applicationDate).toLocaleDateString()}
              </small>
            </button>
          ))}
        </section>
        <section className="ranking-list">
          <h2>Suitable tutors</h2>
          {selected && (
            <p className="match-caption">
              For {selected.person.fullName} —{" "}
              {selected.person.mode.replace("_", " ").toLowerCase()} preference
            </p>
          )}
          {matches.length === 0 ? (
            <p>No tutors currently meet the matching rules.</p>
          ) : (
            matches.map(({ tutor, sharedHours }) => (
              <button
                key={tutor.id}
                className={
                  "tutor-option " + (tutor.id === tutorId ? "selected" : "")
                }
                onClick={() => setTutorId(tutor.id)}
                aria-pressed={tutor.id === tutorId}
              >
                <span className="tutor-option-header">
                  <span className="tutor-identity">
                    <span className="tutor-avatar" aria-hidden="true">
                      {initials(tutor.person.fullName)}
                    </span>
                    <span>
                      <strong>{tutor.person.fullName}</strong>
                      {tutor.person.currentProfession && (
                        <small className="tutor-profession">
                          {tutor.person.currentProfession}
                        </small>
                      )}
                    </span>
                  </span>
                  <span className="capacity-pill">
                    {remainingPlaces(tutor)}
                  </span>
                </span>
                <span className="tutor-details">
                  <span>{formatDeliveryMode(tutor.person.mode)}</span>
                  {languageSummary(tutor) && <span>{languageSummary(tutor)}</span>}
                </span>
                <span className="shared-availability">
                  <span className="availability-label">Shared availability</span>
                  <span className="availability-groups">
                    {groupSharedHours(sharedHours).map(({ day, times }) => (
                      <span className="availability-chip" key={day}>
                        <b>{day}</b> {times.join(", ")}
                      </span>
                    ))}
                  </span>
                </span>
              </button>
            ))
          )}
          <button
            className="create-pairing"
            disabled={!tutorId}
            onClick={create}
          >
            Create pairing
          </button>
        </section>
      </div>
      <section className="table-card">
        <h2>
          Existing pairings <span>{data.pairings.length}</span>
        </h2>
        <table>
          <thead>
            <tr>
              <th>Tutor</th>
              <th>Student</th>
              <th>Start date</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {data.pairings.map((p) => (
              <tr key={p.id}>
                <td>{p.tutor.person.fullName}</td>
                <td>{p.student.person.fullName}</td>
                <td>{p.startDate}</td>
                <td>
                  <Status value={p.status} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}

function initials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase() || "?";
}

function remainingPlaces(tutor: Tutor) {
  const places = Math.max(0, tutor.capacity - tutor.activePairingCount);
  return `${places} ${places === 1 ? "spot" : "spots"} open`;
}

function formatDeliveryMode(mode: string) {
  return mode
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function languageSummary(tutor: Tutor) {
  const languages = Array.isArray(tutor.otherLanguages)
    ? tutor.otherLanguages
        .map((language) => language?.language)
        .filter(Boolean)
    : [];
  if (!languages.length) return "";
  return languages.length === 1
    ? `Also speaks ${languages[0]}`
    : `Also speaks ${languages.slice(0, 2).join(" & ")}${languages.length > 2 ? " +" : ""}`;
}

function groupSharedHours(sharedHours: string[]) {
  const groups = new Map<string, string[]>();
  sharedHours.forEach((slot) => {
    const [day, ...time] = slot.split(" ");
    if (!day || !time.length) return;
    groups.set(day, [...(groups.get(day) || []), formatTime(time.join(" "))]);
  });
  return [...groups].map(([day, times]) => ({ day, times }));
}

function formatTime(time: string) {
  const match = time.trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return time;
  const [, hour, minute] = match;
  const date = new Date(2000, 0, 1, Number(hour), Number(minute));
  return new Intl.DateTimeFormat("en-AU", {
    hour: "numeric",
    minute: Number(minute) ? "2-digit" : undefined,
  }).format(date);
}

function Profile({
  person,
  setPerson,
}: {
  person: Person;
  setPerson: (p: Person) => void;
}) {
  const [draft, setDraft] = useState(person);
  useEffect(() => setDraft(person), [person]);
  async function save() {
    const data = { ...draft };
    delete (data as any).id;
    delete (data as any).user;
    delete (data as any).applicationDate;
    const r = await gql<{ savePerson: { person: Person } }>(
      `mutation($id:ID!,$data:JSONString!){savePerson(personId:$id,data:$data){person{${PERSON_FIELDS}}}}`,
      { id: draft.id, data: JSON.stringify(data) },
    );
    setPerson(r.savePerson.person);
  }
  return (
    <div className="page">
      <div className="page-heading">
        <h1>My profile</h1>
        <button onClick={save}>Save changes</button>
      </div>
      <PersonFields person={draft} setPerson={setDraft} />
    </div>
  );
}

function App() {
  const [me, setMe] = useState<Me | null | undefined>(undefined);
  const [person, setPerson] = useState<Person | null>(null);
  useEffect(() => {
    gql<{ me: Me | null }>(ME).then((x) => setMe(x.me));
  }, []);
  useEffect(() => {
    if (me && me.role !== "ADMIN")
      gql<{ myPerson: Person }>(`query{myPerson{${PERSON_FIELDS}}}`).then((x) =>
        setPerson(x.myPerson),
      );
  }, [me]);
  if (me === undefined) return <main className="login">Loading…</main>;
  if (!me) return <Login done={setMe} />;
  const admin = me.role === "ADMIN";
  async function signout() {
    await gql("mutation{logout{ok}}");
    setMe(null);
    setPerson(null);
  }
  return (
    <div className="shell">
      <aside>
        <Brand />
        <nav>
          {admin ? (
            <>
              <NavLink to="/students">
                <Users /> Students
              </NavLink>
              <NavLink to="/tutors">
                <UserRound /> Tutors
              </NavLink>
              <NavLink to="/pairings">
                <Link2 /> Pairings
              </NavLink>
              <NavLink to="/admin">
                <BookOpen /> Admin
              </NavLink>
            </>
          ) : (
            <NavLink to="/profile">
              <UserRound /> My profile
            </NavLink>
          )}
        </nav>
        <div className="account">
          <span>{me.email}</span>
          <button onClick={signout}>
            <LogOut /> Sign out
          </button>
        </div>
      </aside>
      <main>
        {admin ? (
          <Routes>
            <Route path="/students" element={<Directory kind="students" />} />
            <Route
              path="/students/add"
              element={<PersonEditor kind="students" adding />}
            />
            <Route
              path="/students/:id/edit"
              element={<PersonEditor kind="students" />}
            />
            <Route path="/tutors" element={<Directory kind="tutors" />} />
            <Route
              path="/tutors/add"
              element={<PersonEditor kind="tutors" adding />}
            />
            <Route
              path="/tutors/:id/edit"
              element={<PersonEditor kind="tutors" />}
            />
            <Route path="/pairings" element={<Pairings />} />
            <Route path="/admin" element={<AdminPage />} />
            <Route path="*" element={<Navigate to="/students" replace />} />
          </Routes>
        ) : (
          <Routes>
            <Route
              path="/profile"
              element={
                person ? (
                  <Profile person={person} setPerson={setPerson} />
                ) : (
                  <div className="page">Loading profile…</div>
                )
              }
            />
            <Route path="*" element={<Navigate to="/profile" replace />} />
          </Routes>
        )}
      </main>
    </div>
  );
}
export default App;
