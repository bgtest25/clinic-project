import { GetObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';
import { Client } from 'pg';
import { randomUUID } from 'crypto';

const s3 = new S3Client({});
const bedrock = new BedrockRuntimeClient({});

interface PipelineEvent {
  encounterId: string;
  bucket: string;
  transcriptKey: string;
}

const SOAP_SYSTEM_PROMPT =
  'You are a clinical documentation assistant. You will be given a raw transcript of a ' +
  'conversation between a clinician and a patient during an urgent care visit. Produce a ' +
  'structured SOAP note as a JSON object with exactly these string fields: "subjective", ' +
  '"objective", "assessment", "plan", and "suggestedCodes" (a short comma-separated string of ' +
  'plausible ICD-10 codes, or an empty string if none are clear). Only include information ' +
  "actually present or reasonably inferable from the transcript — never invent vitals, exam " +
  'findings, or history that was not mentioned. If a section has no information, use an empty ' +
  'string for that field. Respond with ONLY the JSON object, no other text.';

async function fetchTranscriptText(bucket: string, key: string): Promise<string> {
  const res = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
  const body = await res.Body?.transformToString();
  if (!body) throw new Error('Empty transcript output from S3');

  const parsed = JSON.parse(body);
  const text = parsed?.results?.transcripts?.[0]?.transcript;
  if (!text) throw new Error('Transcript output missing results.transcripts[0].transcript');
  return text;
}

async function generateSoapNote(transcriptText: string) {
  const command = new InvokeModelCommand({
    modelId: process.env.BEDROCK_MODEL_ID,
    contentType: 'application/json',
    accept: 'application/json',
    body: JSON.stringify({
      anthropic_version: 'bedrock-2023-05-31',
      max_tokens: 1500,
      system: SOAP_SYSTEM_PROMPT,
      messages: [{ role: 'user', content: `Transcript:\n\n${transcriptText}` }],
    }),
  });

  const response = await bedrock.send(command);
  const responseBody = JSON.parse(new TextDecoder().decode(response.body));
  const text: string | undefined = responseBody?.content?.[0]?.text;
  if (!text) throw new Error('No text content in Bedrock response');

  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error(`Bedrock response was not JSON: ${text}`);
  return JSON.parse(jsonMatch[0]) as {
    subjective?: string;
    objective?: string;
    assessment?: string;
    plan?: string;
    suggestedCodes?: string;
  };
}

function resolveDatabaseConfig() {
  const { DB_HOST, DB_PORT, DB_NAME, DB_USERNAME, DB_PASSWORD } = process.env;
  if (!DB_HOST || !DB_PORT || !DB_NAME || !DB_USERNAME || !DB_PASSWORD) {
    throw new Error('Missing DB_HOST/DB_PORT/DB_NAME/DB_USERNAME/DB_PASSWORD');
  }
  return {
    host: DB_HOST,
    port: Number(DB_PORT),
    database: DB_NAME,
    user: DB_USERNAME,
    password: DB_PASSWORD,
    // Same rationale as the API's PrismaService: RDS enforces TLS, this
    // connection never leaves the private isolated subnet.
    ssl: { rejectUnauthorized: false },
  };
}

export const handler = async (event: PipelineEvent) => {
  const { encounterId, bucket, transcriptKey } = event;

  const transcriptText = await fetchTranscriptText(bucket, transcriptKey);
  const note = await generateSoapNote(transcriptText);

  const client = new Client(resolveDatabaseConfig());
  await client.connect();
  try {
    await client.query('BEGIN');
    await client.query(
      `INSERT INTO "transcripts" ("id", "encounterId", "rawText", "diarizedSegments", "sttProvider", "createdAt")
       VALUES ($1, $2, $3, $4, $5, now())
       ON CONFLICT ("encounterId") DO UPDATE SET "rawText" = EXCLUDED."rawText"`,
      [randomUUID(), encounterId, transcriptText, JSON.stringify({}), 'aws-transcribe-medical'],
    );
    await client.query(
      `INSERT INTO "clinical_notes"
         ("id", "encounterId", "version", "subjective", "objective", "assessment", "plan", "suggestedCodes", "status", "createdAt", "updatedAt")
       VALUES ($1, $2, 1, $3, $4, $5, $6, $7, 'DRAFT', now(), now())`,
      [
        randomUUID(),
        encounterId,
        note.subjective ?? '',
        note.objective ?? '',
        note.assessment ?? '',
        note.plan ?? '',
        JSON.stringify(note.suggestedCodes ?? ''),
      ],
    );
    await client.query(`UPDATE "encounters" SET "status" = 'IN_REVIEW', "updatedAt" = now() WHERE "id" = $1`, [
      encounterId,
    ]);
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    await client.end();
  }

  return { encounterId, status: 'IN_REVIEW' };
};
