import { beforeAll, afterAll, describe, expect, it } from "vitest"
import { PGlite } from "@electric-sql/pglite"
import { readFileSync } from "node:fs"
import { emptyPayload, budgetTotal } from "./model"

const clinic = "11111111-1111-4111-8111-111111111111"
const actor = "22222222-2222-4222-8222-222222222222"
const other = "33333333-3333-4333-8333-333333333333"
const patient = "44444444-4444-4444-8444-444444444444"
const draftId = "55555555-5555-4555-8555-555555555555"
let db: PGlite
let revision = 0
const payload = emptyPayload()
payload.appointment = { doctor_name: "Profissional Fictícia", date: "2026-10-05", time: "09:00", duration_minutes: 60 }
payload.anamnesis.answers = [{ question: "Alergia?", answer: "sim", observation: "Exemplo fictício" }, { question: "Pendente?", answer: null, observation: "Investigar" }]
payload.clinical_notes = "Observação fictícia"
payload.budget.items = [{ source_id: null, procedure: "Procedimento fictício", region: "Dente 26", unitValue: 200, discount: 20 }]
payload.settlement_amount = 180
async function act(action: string, input = {}, rev = revision, owner = clinic, user = actor) {
  const result = await db.query<{ result: { revision: number; appointment_id: string; signed_document_id: string; status: string; patient_id: string } }>("select to_jsonb(public.perform_encounter_action($1,$2,$3,$4,$5,$6::jsonb)) as result", [draftId, owner, user, rev, action, JSON.stringify(input)])
  if (result.rows[0].result) revision = result.rows[0].result.revision
  return result.rows[0].result
}
beforeAll(async () => {
  db = new PGlite()
  // Minimal operational schema, deliberately independent of real Supabase data.
  await db.exec(`create role anon; create role authenticated; create role service_role; create schema auth;
    create table auth.users(id uuid primary key);
    insert into auth.users values('${clinic}'),('${actor}'),('${other}');
    create table patients(id uuid primary key default gen_random_uuid(),user_id uuid not null,full_name text,date_of_birth date,cpf text unique,phone text);
    create table appointments(id uuid primary key default gen_random_uuid(),user_id uuid not null,patient_id uuid not null references patients(id),date date,time time without time zone,duration_minutes integer,doctor_name text,procedure_type text,status text,cost numeric,payment_method text);
    create table anamnesis_records(id uuid primary key,user_id uuid,patient_id uuid,chief_complaint text,dentist_name text,answers jsonb,additional_notes text,diagnosis text,treatment_plan text);
    create table medical_records(id uuid primary key,user_id uuid,patient_id uuid,appointment_id uuid,record_type text,title text,content text);
    create table treatments(id uuid primary key,user_id uuid,patient_id uuid,appointment_id uuid,status text);
    create table documents(id uuid primary key default gen_random_uuid(),user_id uuid,patient_id uuid,title text,document_type text,content text,items jsonb,total_amount numeric,payment_method text,status text,signed boolean,signed_at timestamptz,signature_data text);
    create table financial_transactions(id uuid primary key default gen_random_uuid(),user_id uuid,patient_id uuid,treatment_id uuid,description text,amount numeric,payment_method text,type text,status text,verification_status text);`)
  await db.exec(readFileSync("scripts/014_mobile_encounters.sql", "utf8"))
  await db.query("insert into patients(id,user_id,full_name) values($1,$2,'Paciente Fictício')", [patient, clinic])
  await db.query("insert into encounter_drafts(id,clinic_id,actor_user_id,patient_id,payload) values($1,$2,$3,$4,$5::jsonb)", [draftId, clinic, actor, patient, JSON.stringify(payload)])
}, 30_000)
afterAll(async () => { await db?.close() })

describe.sequential("migração executada em PostgreSQL descartável", () => {
  it("recupera todos os campos e bloqueia sobrescrita por uma aba antiga", async () => {
    await db.query("select save_encounter_draft($1,$2,$3,0,'budget',$4::jsonb)", [draftId, clinic, actor, JSON.stringify(payload)])
    revision = 1
    await expect(db.query("select save_encounter_draft($1,$2,$3,0,'patient',$4::jsonb)", [draftId, clinic, actor, JSON.stringify(emptyPayload())])).rejects.toThrow(/outra aba/)
    const { rows } = await db.query<{ payload: typeof payload; step: string }>("select payload,step from encounter_drafts where id=$1", [draftId])
    expect(rows[0].payload).toEqual(payload); expect(rows[0].step).toBe("budget")
  })
  it("não lê nem altera rascunho de outra clínica ou outro usuário", async () => {
    expect(await act("discard", {}, revision, other)).toBeNull()
    expect(await act("discard", {}, revision, clinic, other)).toBeNull()
    await db.query("set role authenticated")
    await expect(db.query("select * from encounter_drafts")).rejects.toThrow(/permission denied/)
    await expect(db.query("select perform_encounter_action($1,$2,$3,1,'discard')", [draftId, clinic, actor])).rejects.toThrow(/permission denied/)
    await db.query("reset role")
  })
  it("corrige uma instalação antiga com horário TIME sem perder rascunhos e permite reaplicar 015", async () => {
    const upgrade = readFileSync("scripts/015_encounter_appointment_time.sql", "utf8")
    // Reproduce the original 014 function against the actual operational column type.
    await db.exec(upgrade.replace("::date,(d.payload->'appointment'->>'time')::time,", "::date,d.payload->'appointment'->>'time',"))
    await expect(act("start")).rejects.toMatchObject({ code: "42804" })
    expect((await db.query("select id from appointments")).rows).toHaveLength(0)
    const before = (await db.query("select * from encounter_drafts where id=$1", [draftId])).rows
    await db.exec(upgrade)
    await db.exec(upgrade)
    expect((await db.query("select * from encounter_drafts where id=$1", [draftId])).rows).toEqual(before)
    const started = await act("start")
    const appointment = await db.query<{ time: string; status: string }>("select time,status from appointments where id=$1", [started.appointment_id])
    expect(appointment.rows[0]).toEqual({ time: "09:00:00", status: "Em Andamento" })
  })
  it("reaproveita a consulta, impede horário conflitante e duplo início", async () => {
    const first = await act("start")
    const retry = await act("start")
    expect(retry.appointment_id).toBe(first.appointment_id)
    expect((await db.query("select * from appointments")).rows).toHaveLength(1)
    await expect(db.query("insert into appointments(user_id,patient_id,date,time,duration_minutes,doctor_name,status) values($1,$2,'2026-10-05','09:15',30,'Profissional Fictícia','Pendente')", [clinic, patient])).rejects.toThrow(/Conflito/)
  })
  it("registra anamnese e evolução uma única vez, preservando respostas pendentes no rascunho", async () => {
    await act("publish"); await act("publish")
    const records = await db.query<{ answers: unknown[] }>("select answers from anamnesis_records")
    expect(records.rows).toHaveLength(1); expect(records.rows[0].answers).toHaveLength(1)
    expect((await db.query("select * from medical_records")).rows).toHaveLength(1)
  })
  it("liga a assinatura à versão e preserva o mesmo documento em retries", async () => {
    const signedRevision = revision
    const input = { signature: "data:image/png;base64,ZmljdGljaW8=", title: "Proposta fictícia", content: "Texto fictício confirmado", total: budgetTotal(payload.budget.items), hash: "hash-ficticio" }
    const first = await act("sign", input)
    const retry = await act("sign", input, signedRevision)
    expect(retry.signed_document_id).toBe(first.signed_document_id)
    const { rows } = await db.query<{ encounter_revision: number; total_amount: string }>("select encounter_revision,total_amount from documents")
    expect(rows).toHaveLength(1); expect(rows[0].encounter_revision).toBe(signedRevision); expect(Number(rows[0].total_amount)).toBe(180)
    await expect(db.query("update documents set content='Texto diferente'")).rejects.toThrow(/imutável/)
    const altered = { ...payload, budget: { ...payload.budget, payment_method: "Outro" } }
    await expect(db.query("select save_encounter_draft($1,$2,$3,$4,'budget',$5::jsonb)", [draftId, clinic, actor, revision, JSON.stringify(altered)])).rejects.toThrow(/não pode ser alterado/)
  })
  it("conclui e cria exatamente uma cobrança inclusive após retry antigo", async () => {
    const rev = revision
    const first = await act("complete")
    expect(first.status).toBe("completed")
    await act("complete", {}, rev)
    const transactions = await db.query<{ amount: string; source_appointment_id: string }>("select amount,source_appointment_id from financial_transactions")
    expect(transactions.rows).toHaveLength(1); expect(Number(transactions.rows[0].amount)).toBe(180)
    expect(transactions.rows[0].source_appointment_id).toBe(first.appointment_id)
    await db.query("update appointments set status='Concluída' where id=$1", [first.appointment_id])
    await expect(db.query("update appointments set cost=200 where id=$1", [first.appointment_id])).rejects.toThrow(/já concluída/)
    expect((await db.query("select * from financial_transactions")).rows).toHaveLength(1)
  })
  it("falha financeira desfaz a conclusão inteira sem perder o rascunho", async () => {
    const id = "66666666-6666-4666-8666-666666666666"
    const copy = { ...payload, appointment: { ...payload.appointment, time: "11:00" } }
    await db.query("insert into encounter_drafts(id,clinic_id,actor_user_id,patient_id,payload) values($1,$2,$3,$4,$5::jsonb)", [id, clinic, actor, patient, JSON.stringify(copy)])
    const start = await db.query<{ d: { revision: number; appointment_id: string } }>("select to_jsonb(perform_encounter_action($1,$2,$3,0,'start')) d", [id, clinic, actor])
    const signed = await db.query<{ d: { revision: number } }>("select to_jsonb(perform_encounter_action($1,$2,$3,$4,'sign',$5::jsonb)) d", [id, clinic, actor, start.rows[0].d.revision, JSON.stringify({ signature: "data:image/png;base64,AA==", title: "Fictício", content: "Fictício", total: 180, hash: "ficticio" })])
    await db.exec("alter table financial_transactions add constraint fail_test check(amount<100)") .catch(async () => { await db.exec("alter table financial_transactions add constraint fail_test check(amount<100) not valid") })
    await expect(db.query("select perform_encounter_action($1,$2,$3,$4,'complete')", [id, clinic, actor, signed.rows[0].d.revision])).rejects.toThrow(/fail_test/)
    const { rows } = await db.query<{ status: string }>("select status from appointments where id=$1", [start.rows[0].d.appointment_id])
    expect(rows[0].status).toBe("Em Andamento")
    expect((await db.query<{ status: string }>("select status from encounter_drafts where id=$1", [id])).rows[0].status).toBe("active")
    await db.exec("alter table financial_transactions drop constraint fail_test")
  })
  it("vincula plano importado à consulta e rejeita item com cobrança própria", async () => {
    const newPatient = "88888888-8888-4888-8888-888888888888"
    const newDraft = "99999999-9999-4999-8999-999999999999"
    const treatment = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
    await db.query("insert into patients(id,user_id,full_name) values($1,$2,'Outro Paciente Fictício')", [newPatient, clinic])
    await db.query("insert into treatments(id,user_id,patient_id,status) values($1,$2,$3,'planned')", [treatment, clinic, newPatient])
    const copy = { ...payload, appointment: { ...payload.appointment, time: "13:00" }, budget: { ...payload.budget, items: [{ ...payload.budget.items[0], source_id: treatment }] } }
    await db.query("insert into encounter_drafts(id,clinic_id,actor_user_id,patient_id,payload) values($1,$2,$3,$4,$5::jsonb)", [newDraft, clinic, actor, newPatient, JSON.stringify(copy)])
    const started = await db.query<{ d: { revision: number; appointment_id: string } }>("select to_jsonb(perform_encounter_action($1,$2,$3,0,'start')) d", [newDraft, clinic, actor])
    await db.query("insert into financial_transactions(user_id,patient_id,treatment_id,amount,status) values($1,$2,$3,180,'pending')", [clinic, newPatient, treatment])
    const input = JSON.stringify({ signature: "data:image/png;base64,AA==", title: "Fictício", content: "Fictício", total: 180, hash: "ficticio" })
    await expect(db.query("select perform_encounter_action($1,$2,$3,$4,'sign',$5::jsonb)", [newDraft, clinic, actor, started.rows[0].d.revision, input])).rejects.toThrow(/cobrança própria/)
    expect((await db.query("select * from documents where encounter_id=$1", [newDraft])).rows).toHaveLength(0)
    await db.query("update financial_transactions set status='cancelled' where treatment_id=$1", [treatment])
    await db.query("select perform_encounter_action($1,$2,$3,$4,'sign',$5::jsonb)", [newDraft, clinic, actor, started.rows[0].d.revision, input])
    const linked = await db.query<{ appointment_id: string }>("select appointment_id from treatments where id=$1", [treatment])
    expect(linked.rows[0].appointment_id).toBe(started.rows[0].d.appointment_id)
  })
  it("persiste cadastro incompleto e confirma o paciente uma única vez", async () => {
    const registrationId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"
    const registration = emptyPayload()
    registration.registration.full_name = "Pessoa Fictícia de Cadastro"
    await db.query("insert into encounter_drafts(id,clinic_id,actor_user_id,payload) values($1,$2,$3,$4::jsonb)", [registrationId, clinic, actor, JSON.stringify(registration)])
    const partial = await db.query<{ payload: typeof registration }>("select payload from encounter_drafts where id=$1", [registrationId])
    expect(partial.rows[0].payload.registration).toEqual(registration.registration)
    expect((await db.query("select * from patients where full_name='Pessoa Fictícia de Cadastro'")).rows).toHaveLength(0)
    registration.registration.date_of_birth = "1970-01-01"; registration.registration.cpf = "000.000.000-00"
    await db.query("select save_encounter_draft($1,$2,$3,0,'patient',$4::jsonb)", [registrationId, clinic, actor, JSON.stringify(registration)])
    const first = await db.query<{ d: { patient_id: string } }>("select to_jsonb(perform_encounter_action($1,$2,$3,1,'register')) d", [registrationId, clinic, actor])
    const retry = await db.query<{ d: { patient_id: string } }>("select to_jsonb(perform_encounter_action($1,$2,$3,1,'register')) d", [registrationId, clinic, actor])
    expect(retry.rows[0].d.patient_id).toBe(first.rows[0].d.patient_id)
    expect((await db.query("select * from patients where cpf='000.000.000-00'")).rows).toHaveLength(1)
  })
  it("agenda horário TIME e preserva a mesma consulta ao repetir a confirmação", async () => {
    const scheduledPatient = "cccccccc-cccc-4ccc-8ccc-cccccccccccc"
    const scheduledDraft = "dddddddd-dddd-4ddd-8ddd-dddddddddddd"
    const copy = { ...payload, scheduling: true, appointment: { ...payload.appointment, time: "15:30" } }
    await db.query("insert into patients(id,user_id,full_name) values($1,$2,'Paciente Fictício de Agenda')", [scheduledPatient, clinic])
    await db.query("insert into encounter_drafts(id,clinic_id,actor_user_id,patient_id,payload) values($1,$2,$3,$4,$5::jsonb)", [scheduledDraft, clinic, actor, scheduledPatient, JSON.stringify(copy)])
    const call = () => db.query<{ d: { appointment_id: string } }>("select to_jsonb(perform_encounter_action($1,$2,$3,0,'schedule')) d", [scheduledDraft, clinic, actor])
    const first = await call()
    const retry = await call()
    expect(retry.rows[0].d.appointment_id).toBe(first.rows[0].d.appointment_id)
    const appointment = await db.query<{ time: string; status: string }>("select time,status from appointments where id=$1", [first.rows[0].d.appointment_id])
    expect(appointment.rows).toEqual([{ time: "15:30:00", status: "Pendente" }])
  })
})
