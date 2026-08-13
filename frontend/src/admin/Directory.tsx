import { useEffect, useMemo, useState } from "react";
import { NavLink } from "react-router-dom";
import { Plus } from "lucide-react";
import { gql } from "../api";
import type { Student, Tutor } from "../types";
import { Status } from "../ui/Status";

type Kind = "students" | "tutors";
const PERSON_FIELDS = `id fullName applicationDate status qualitativeAssessment currentProfession assessor user { email }`;
const STUDENT_FIELDS = `id activePairingCount englishLevel interviewConducted person { ${PERSON_FIELDS} }`;
const TUTOR_FIELDS = `id approvedToTutor wwccProvided capacity activePairingCount person { ${PERSON_FIELDS} }`;
const DIRECTORY = `query { students { ${STUDENT_FIELDS} } tutors { ${TUTOR_FIELDS} } }`;

const date = (value: string) => value ? new Date(value).toLocaleDateString("en-AU") : "—";
const yesNo = (value: boolean) => value ? "Yes" : "No";
const compare = (left: string | number, right: string | number) => String(left).localeCompare(String(right), undefined, { numeric: true });
const firstName = (fullName: string) => fullName.trim().split(/\s+/)[0] || fullName;

export function Directory({ kind }: { kind: Kind }) {
  const [data, setData] = useState<{ students: Student[]; tutors: Tutor[] } | null>(null);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("ALL");
  const [detail, setDetail] = useState("ALL");
  const [sort, setSort] = useState("name");
  const label = kind === "students" ? "Students" : "Tutors";
  useEffect(() => { gql<{ students: Student[]; tutors: Tutor[] }>(DIRECTORY).then(setData); }, []);
  const rows = useMemo(() => {
    const source = kind === "students" ? data?.students ?? [] : data?.tutors ?? [];
    return source.filter((row) => {
      const person = row.person;
      const searchable = `${person.fullName} ${person.user.email} ${person.assessor} ${person.currentProfession}`.toLowerCase();
      if (query && !searchable.includes(query.toLowerCase())) return false;
      if (status !== "ALL" && person.status !== status) return false;
      if (kind === "students") {
        const student = row as Student;
        if (detail === "ENROLLED" && !student.activePairingCount) return false;
        if (detail === "NOT_ENROLLED" && student.activePairingCount) return false;
        if (detail === "INTERVIEWED" && student.interviewConducted !== "CONDUCTED") return false;
      } else {
        const tutor = row as Tutor;
        if (detail === "WWCC" && !tutor.wwccProvided) return false;
        if (detail === "NO_WWCC" && tutor.wwccProvided) return false;
        if (detail === "AVAILABLE" && (!tutor.approvedToTutor || tutor.activePairingCount >= tutor.capacity)) return false;
      }
      return true;
    }).sort((a, b) => {
      if (sort === "date") return new Date(b.person.applicationDate).getTime() - new Date(a.person.applicationDate).getTime();
      if (sort === "status") return compare(a.person.status, b.person.status);
      if (sort === "assessment") return compare(a.person.qualitativeAssessment, b.person.qualitativeAssessment);
      if (sort === "pairings") return (b as Student | Tutor).activePairingCount - (a as Student | Tutor).activePairingCount;
      if (sort === "capacity") return (b as Tutor).capacity - (a as Tutor).capacity;
      return compare(firstName(a.person.fullName), firstName(b.person.fullName)) || compare(a.person.fullName, b.person.fullName);
    });
  }, [data, detail, kind, query, sort, status]);
  if (!data) return <div className="page">Loading {label.toLowerCase()}…</div>;
  const isStudent = kind === "students";
  return <div className="page">
    <div className="page-heading"><div><p className="eyebrow">Administration</p><h1>{label}</h1></div><NavLink className="button" to={`/${kind}/add`}><Plus size={16} /> Add {kind.slice(0, -1)}</NavLink></div>
    <section className="table-card">
      <div className="table-title"><h2>{label} <span>{rows.length}</span></h2><div className="directory-controls">
        <input aria-label={`Search ${label.toLowerCase()}`} placeholder="Search name, email, profession…" value={query} onChange={(e) => setQuery(e.target.value)} />
        <select aria-label="Filter by status" value={status} onChange={(e) => setStatus(e.target.value)}><option value="ALL">All statuses</option><option value="ACTIVE">Active</option><option value="INACTIVE">Inactive</option><option value="REJECTED">Rejected</option><option value="BLACKLISTED">Blacklisted</option></select>
        <select aria-label="Filter by detail" value={detail} onChange={(e) => setDetail(e.target.value)}>{isStudent ? <><option value="ALL">All enrolment states</option><option value="ENROLLED">Enrolled</option><option value="NOT_ENROLLED">Not enrolled</option><option value="INTERVIEWED">Interview conducted</option></> : <><option value="ALL">All tutor states</option><option value="AVAILABLE">Available to pair</option><option value="WWCC">WWCC provided</option><option value="NO_WWCC">No WWCC</option></>}</select>
        <select aria-label="Sort directory" value={sort} onChange={(e) => setSort(e.target.value)}><option value="name">Sort: first name</option><option value="date">Sort: newest application</option><option value="status">Sort: status</option>{isStudent ? <><option value="assessment">Sort: assessment</option><option value="pairings">Sort: current pairings</option></> : <><option value="capacity">Sort: capacity</option><option value="pairings">Sort: current pairings</option></>}</select>
      </div></div>
      <div className="table-scroll"><table><thead><tr><th>Name</th><th>Application date</th><th>Status</th>{isStudent ? <><th>Enrolled</th><th>Interview</th><th>Assessor</th><th>Assessment</th></> : <><th>Capacity</th><th>Current pairings</th><th>Profession</th><th>WWCC</th><th>Assessor</th></>}<th></th></tr></thead><tbody>
        {rows.map((row) => isStudent ? <StudentRow key={row.id} student={row as Student} /> : <TutorRow key={row.id} tutor={row as Tutor} />)}
      </tbody></table></div>
      {!rows.length && <p className="empty-state">No {label.toLowerCase()} match these filters.</p>}
    </section>
  </div>;
}
function Name({ person }: { person: Student["person"] }) { return <td><strong>{person.fullName}</strong><small>{person.user.email}</small></td>; }
function StudentRow({ student }: { student: Student }) { const { person } = student; return <tr><Name person={person} /><td>{date(person.applicationDate)}</td><td><Status value={person.status} /></td><td>{yesNo(student.activePairingCount > 0)}</td><td>{student.interviewConducted.replaceAll("_", " ")}</td><td>{person.assessor || "—"}</td><td>{person.qualitativeAssessment || "Not assessed"}</td><td><NavLink to={`/students/${student.id}/edit`}>Edit</NavLink></td></tr>; }
function TutorRow({ tutor }: { tutor: Tutor }) { const { person } = tutor; return <tr><Name person={person} /><td>{date(person.applicationDate)}</td><td><Status value={person.status} /></td><td>{tutor.activePairingCount}/{tutor.capacity}</td><td>{tutor.activePairingCount}</td><td>{person.currentProfession || "—"}</td><td>{yesNo(tutor.wwccProvided)}</td><td>{person.assessor || "—"}</td><td><NavLink to={`/tutors/${tutor.id}/edit`}>Edit</NavLink></td></tr>; }
