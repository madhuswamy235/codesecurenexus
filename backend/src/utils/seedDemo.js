const bcrypt = require('bcryptjs');
const User = require('../models/User');
const Interview = require('../models/Interview');
const Question = require('../models/Question');
const { collection, getMode } = require('../storage/storage');
const logger = require('./logger');

const users = collection('users', User);
const interviews = collection('interviews', Interview);
const questions = collection('questions', Question);

/**
 * Seeds fixed demo users in nonproduction only. Production uses the separate
 * one-time INITIAL_RECRUITER_* bootstrap instead of public demo credentials.
 */
const DEMO_USERS = [
  { name: 'Admin', email: 'admin@securenexus.dev', password: 'admin123', role: 'admin' },
  { name: 'Recruiter', email: 'recruiter@securenexus.dev', password: 'recruiter123', role: 'recruiter' },
  { name: 'Interviewer', email: 'interviewer@securenexus.dev', password: 'interviewer123', role: 'interviewer' },
  { name: 'Candidate', email: 'candidate@securenexus.dev', password: 'candidate123', role: 'candidate' },
];
const DEMO_EMAILS = new Set(DEMO_USERS.map((user) => user.email));

async function seedInitialRecruiter() {
  const email = String(process.env.INITIAL_RECRUITER_EMAIL || '').trim().toLowerCase();
  const password = String(process.env.INITIAL_RECRUITER_PASSWORD || '');
  const name = String(process.env.INITIAL_RECRUITER_NAME || 'Recruiter').trim();
  if (email && DEMO_EMAILS.has(email)) {
    throw new Error('Demo account emails cannot be used as production recruiter credentials.');
  }
  if (!email && !password) {
    const [recruiters, admins] = await Promise.all([
      users.find({ role: 'recruiter' }),
      users.find({ role: 'admin' }),
    ]);
    const existingPrivileged = [...recruiters, ...admins].some((account) => !DEMO_EMAILS.has(String(account.email).toLowerCase()));
    if (existingPrivileged) return false;
    throw new Error('Set INITIAL_RECRUITER_EMAIL and INITIAL_RECRUITER_PASSWORD (at least 12 characters) to create the first production recruiter.');
  }
  if (!email || password.length < 12) {
    throw new Error('Set both INITIAL_RECRUITER_EMAIL and INITIAL_RECRUITER_PASSWORD (at least 12 characters) to create the first production recruiter.');
  }

  const existing = await users.findOne({ email });
  if (existing) {
    if (!['recruiter', 'admin'].includes(existing.role)) {
      throw new Error('INITIAL_RECRUITER_EMAIL is already registered as a non-recruiter account. Choose another email or promote it securely in MongoDB.');
    }
    return false;
  }

  await users.insertOne({
    name: name || 'Recruiter',
    email,
    password: await bcrypt.hash(password, 12),
    role: 'recruiter',
    mobile: '',
    profileImage: '',
    skills: [],
    isActive: true,
  });
  logger.info(`Initial recruiter account created for ${email}`);
  return true;
}

async function seedDemoUsers() {
  for (const demo of DEMO_USERS) {
    const existing = await users.findOne({ email: demo.email });
    if (existing) {
      // Repair: if the account exists but with the wrong role (e.g. someone
      // registered it publicly as candidate before seeding), promote it so the
      // demo keeps a working admin/recruiter/interviewer.
      if (existing.role !== demo.role) {
        await users.updateById(existing._id, { $set: { role: demo.role } });
        console.log(`[seed] promoted ${demo.email} role -> ${demo.role}`);
      }
      continue;
    }
    const hash = await bcrypt.hash(demo.password, 10);
    try {
      await users.insertOne({
        name: demo.name,
        email: demo.email,
        password: hash,
        role: demo.role,
        mobile: '',
        profileImage: '',
        skills: [],
        isActive: true,
      });
      console.log(`[seed] created demo ${demo.role}: ${demo.email} / ${demo.password}`);
    } catch (err) {
      // Tolerate a check-then-act race on the unique email index (e.g. a
      // concurrent seed during a fast restart). 11000 = duplicate key.
      if (err && (err.code === 11000 || /duplicate key/i.test(err.message || ''))) {
        const now = await users.findOne({ email: demo.email });
        if (now && now.role !== demo.role) {
          await users.updateById(now._id, { $set: { role: demo.role } });
        }
        console.log(`[seed] ${demo.email} already exists (skipped)`);
      } else {
        throw err;
      }
    }
  }
  console.log(`[seed] storage mode: ${getMode()}`);
}

/**
 * Idempotent demo-data seed for the ASSESSMENT flow.
 *
 * The dev/file fallback accumulates test data from earlier automated runs, so
 * the demo candidate's newest interviews often contain NO questions (or the
 * CODING questions lack a runnable test-case array). This makes the browser
 * assessment screen load ("Session … · 0 questions") yet never complete a real
 * MCQ/Coding/Written flow.
 *
 * This seed guarantees the demo candidate always has ONE scheduled MIXED
 * assessment whose questions include REAL grading data:
 *   - MCQ      -> options + correctOption (genuinely scored server-side),
 *   - CODING   -> testCases [{input, expected}] executed by the development executor.
 *
 * It only creates the interview/questions when the sentinel interview is
 * missing, and it never touches existing interviews/submissions. It is safe in
 * BOTH storage modes (Mongo when connected, file store otherwise).
 */
async function seedDemoAssessment() {
  const admin = await users.findOne({ email: 'admin@securenexus.dev' });
  const candidate = await users.findOne({ email: 'candidate@securenexus.dev' });
  if (!admin || !candidate) return; // demo accounts missing — nothing to bind

  const SENTINEL_TITLE = 'SecureNexus Demo Assessment';
  const existing = await interviews.findOne({ title: SENTINEL_TITLE });
  if (existing) {
    const candidateInterviews = await interviews.find({ candidateId: candidate._id });
    for (const interview of candidateInterviews) await ensureDemoQuestionSet(interview._id);
    return;
  }
  if (existing) return; // idempotent — only ever created once

  const iv = await interviews.insertOne({
    title: SENTINEL_TITLE,
    description:
      'Interview demo with server-scored MCQ and code execution against real test cases.',
    type: 'MIXED',
    status: 'scheduled',
    candidateId: candidate._id,
    interviewerId: null,
    recruiterId: admin._id,
    scheduledAt: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(),
    durationMinutes: 60,
    roomCode: require('crypto').randomBytes(3).toString('hex').toUpperCase(),
    tags: ['phase3-demo'],
  });

  await questions.insertOne({
    interviewId: iv._id,
    type: 'MCQ',
    text: 'In JavaScript, which of the following expressions evaluates to true?',
    options: ['"0" === 0', "1 === '1'", "'2' == 2", 'NaN === NaN'],
    correctOption: 2,
    language: 'javascript',
    starterCode: '',
    testCases: [],
    maxScore: 10,
    tags: ['phase3-demo'],
  });

  await questions.insertOne({
    interviewId: iv._id,
    type: 'CODING',
    text:
      'Write a JavaScript program that reads an integer from standard input and ' +
      'prints "true" if it is even, otherwise "false".',
    options: [],
    correctOption: -1,
    language: 'javascript',
    starterCode: [
      '// Reads a number from stdin and prints true/false for parity.',
      'let data = "";',
      'process.stdin.on("data", (d) => (data += d));',
      'process.stdin.on("end", () => {',
      '  const n = parseInt(data.trim(), 10);',
      '  console.log(n % 2 === 0 ? "true" : "false");',
      '});',
      '',
    ].join('\n'),
    testCases: [
      { input: '2', expected: 'true' },
      { input: '7', expected: 'false' },
      { input: '12', expected: 'true' },
    ],
    maxScore: 15,
    tags: ['phase3-demo'],
  });


  await ensureDemoQuestionSet(iv._id);
  console.log(`[seed] created demo assessment: ${iv._id} (${SENTINEL_TITLE})`);
}

async function ensureDemoQuestionSet(interviewId) {
  const rows = await questions.find({ interviewId });
  const mcq = [
    ['Which JavaScript keyword declares a block-scoped variable?', ['var', 'let', 'global', 'define'], 1, 'Variables and scope'],
    ['What does Array.prototype.map return?', ['A new array', 'A number', 'A promise always', 'The original array only'], 0, 'Array transformations'],
    ['Which HTTP status means a request succeeded?', ['301', '404', '200', '500'], 2, 'Web fundamentals'],
    ['Which React hook stores component state?', ['useMemo', 'useState', 'useRoute', 'useFetchOnly'], 1, 'React fundamentals'],
  ];
  const coding = [
    ['Write a function that returns the sum of two numbers.', 'function solve(a, b) { return a + b; }', 'Functions'],
    ['Write a function that returns true when a string is a palindrome.', 'function solve(value) { return value === value.split(\"\").reverse().join(\"\"); }', 'Strings'],
    ['Write a function that returns the largest number in an array.', 'function solve(values) { return Math.max(...values); }', 'Arrays'],
    ['Write a function that counts vowels in a string.', 'function solve(value) { return (value.match(/[aeiou]/gi) || []).length; }', 'Algorithms'],
  ];
  const written = [
    ['Explain the difference between let, const, and var.', 'JavaScript scope'],
    ['Explain how to make a React component accessible.', 'Frontend accessibility'],
    ['Describe how to handle API loading and error states.', 'API design'],
    ['Explain the benefits of code review.', 'Engineering practices'],
    ['Describe how to debug a slow web page.', 'Performance debugging'],
  ];
  const add = async (type, values) => {
    const count = rows.filter((row) => row.type === type).length;
    for (let index = count; index < 5; index += 1) {
      const value = values[index % values.length];
      const document = type === 'MCQ'
        ? { interviewId, type, text: value[0], options: value[1], correctOption: value[2], language: 'javascript', starterCode: '', testCases: [], maxScore: 10, tags: [value[3]] }
        : type === 'CODING'
          ? { interviewId, type, text: value[0], options: [], correctOption: -1, language: 'javascript', starterCode: value[1], testCases: [], maxScore: 10, tags: [value[2]] }
          : { interviewId, type, text: value[0], options: [], correctOption: -1, language: 'javascript', starterCode: '', testCases: [], maxScore: 10, tags: [value[1]] };
      await questions.insertOne(document);
    }
  };
  await add('MCQ', mcq);
  await add('CODING', coding);
  await add('WRITTEN', written);
}

module.exports = { seedDemoUsers, seedDemoAssessment, seedInitialRecruiter };
