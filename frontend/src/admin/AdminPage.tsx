import { useEffect, useState } from "react";
import { Download } from "lucide-react";
import { gql } from "../api";
import type { Student, Tutor } from "../types";
import { exportParticipantRegister } from "./exportRegister";

const PERSON_FIELDS = `id fullName nickname phoneNumber emergencyContactName emergencyContactPhone emergencyContactRelationship applicationDate status notes timezone availability mode address gender sameGenderPairingRequired qualitativeAssessment nationalBackground ethnicBackground religiousBackground jobStudyCategory currentProfession hobbiesInterests referenceCheckConducted refereeName refereeRelationship refereeContact pathwayToProgram assessor matcher user { email }`;
const DIRECTORY = `query { students { id activePairingCount englishLevel linguisticBackground intendedProfession refugeeAsylumAssessment interviewConducted person { ${PERSON_FIELDS} } } tutors { id otherLanguages approvedToTutor wwccProvided capacity activePairingCount person { ${PERSON_FIELDS} } } }`;

export function AdminPage() {
  const [data, setData] = useState<{ students: Student[]; tutors: Tutor[] } | null>(null);
  const [error, setError] = useState("");
  useEffect(() => { gql<{ students: Student[]; tutors: Tutor[] }>(DIRECTORY).then(setData).catch((e) => setError(String(e))); }, []);
  return <div className="page"><div className="page-heading"><div><p className="eyebrow">Administration</p><h1>Admin</h1></div></div><section className="admin-export"><h2>Export participant register</h2><p>Download a single-sheet Excel register of all students and tutors. The exported sheet follows the structure and section colours of the supplied Register of Participants template.</p>{error && <p className="error">{error}</p>}<button disabled={!data} onClick={() => data && exportParticipantRegister(data.students, data.tutors)}><Download size={16} /> {data ? "Export Register of Participants" : "Loading register…"}</button></section></div>;
}
