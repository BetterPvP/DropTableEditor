// Dev fixture: inserts a ready-to-test published quest ("first_blood") and a
// conversation ("greeting") into the shared content table. The game loads them
// from `published`; the console shows them as editable content. Idempotent.
import 'dotenv/config';
import pg from 'pg';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error('DATABASE_URL is not set.');
  process.exit(1);
}

const QUEST_ROW_ID = '11111111-1111-1111-1111-111111111111';
const CONVERSATION_ROW_ID = '22222222-2222-2222-2222-222222222222';

const quest = {
  id: 'first_blood',
  name: 'First Blood',
  questType: 'side',
  scope: 'solo',
  requirements: [],
  rewards: [{ id: 'rw1', type: 'reward.item', params: { item: 'minecraft:diamond', amount: 2 } }],
  nodes: [
    {
      id: 's1', kind: 'stage', position: { x: 120, y: 120 },
      data: {
        title: 'Cull the horde',
        objectives: [{ id: 'o1', type: 'trigger.kill', params: { count: 3 } }],
        actions: [{ id: 'a1', type: 'action.send_message', params: { message: 'The horde thins…' } }],
      },
    },
    {
      id: 's2', kind: 'stage', position: { x: 400, y: 120 },
      data: {
        title: 'Finish it',
        objectives: [{ id: 'o2', type: 'trigger.kill', params: { count: 1 } }],
        actions: [],
      },
    },
  ],
  edges: [{ id: 'e1', source: 's1', target: 's2', data: { conditions: [] } }],
};

const conversation = {
  id: 'greeting',
  name: 'Garrick Greeting',
  startNodeId: 'g1',
  nodes: [
    {
      id: 'g1', kind: 'dialogue', position: { x: 120, y: 120 },
      data: {
        speaker: 'Garrick', body: 'Well met, traveller. The mines need clearing.', font: 'default', typewriterCps: 28, voiceLineKey: '', delayTicks: 0,
        responses: [
          { id: 'gr1', label: "I'll help", flag: '', conditions: [], actions: [], outcome: { kind: 'goto', target: 'g2' } },
          { id: 'gr2', label: 'Not now.', flag: '', conditions: [], actions: [], outcome: { kind: 'end' } },
        ],
      },
    },
    {
      id: 'g2', kind: 'dialogue', position: { x: 400, y: 120 },
      data: {
        speaker: 'Garrick', body: 'Good. Three should do it. Off you go.', font: 'default', typewriterCps: 28, voiceLineKey: '', delayTicks: 0,
        responses: [{ id: 'gr3', label: 'Understood.', flag: '', conditions: [], actions: [], outcome: { kind: 'end' } }],
      },
    },
  ],
};

const client = new pg.Client({ connectionString });

async function upsert(id, type, name, definition) {
  const json = JSON.stringify(definition);
  await client.query(
    `INSERT INTO content (id, type, name, status, draft, published, version)
     VALUES ($1, $2, $3, 'published', $4::jsonb, $4::jsonb, 1)
     ON CONFLICT (id) DO UPDATE
       SET name = EXCLUDED.name, status = 'published',
           draft = EXCLUDED.draft, published = EXCLUDED.published,
           version = content.version + 1, published_at = now()`,
    [id, type, name, json],
  );
}

try {
  await client.connect();
  await upsert(QUEST_ROW_ID, 'quest', quest.name, quest);
  await upsert(CONVERSATION_ROW_ID, 'conversation', conversation.name, conversation);
  console.log('Seeded sample content: quest "first_blood", conversation "greeting".');
  console.log('In-game: /quest start first_blood   (kill 3 + 1 → 2 diamonds)');
} catch (err) {
  console.error('Content seed failed:', err.message);
  process.exitCode = 1;
} finally {
  await client.end();
}
