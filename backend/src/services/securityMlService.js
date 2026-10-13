const fs = require('fs');
const path = require('path');

const FEATURE_KEYS = [
  'tabSwitches',
  'blurFocusEvents',
  'fullscreenExits',
  'nearbyDeviceCount',
  'eventFrequency',
  'eventDuration',
  'sessionInterruptions',
];
const CLASS_LABELS = ['LOW_RISK', 'MEDIUM_RISK', 'HIGH_RISK'];
const TREE_COUNT = 51;
const CNN_KERNELS = [
  [0.25, 0.5, 0.25],
  [-1, 0, 1],
  [1, -2, 1],
];
let cachedModels = null;

function safeNumber(value, max = 1000) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(0, Math.min(max, parsed)) : 0;
}

function featureVector(features = {}) {
  return Object.fromEntries(FEATURE_KEYS.map((key) => [
    key,
    safeNumber(features[key], key === 'nearbyDeviceCount' ? 100 : 1000),
  ]));
}

function seededRandom(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function gaussian(random) {
  return Math.sqrt(-2 * Math.log(Math.max(random(), 1e-9))) * Math.cos(2 * Math.PI * random());
}

function syntheticRecords() {
  const random = seededRandom(0x51ec0de);
  return Array.from({ length: 360 }, (_, index) => {
    const group = index % CLASS_LABELS.length;
    const label = CLASS_LABELS[group];
    const scale = group === 0 ? 0.08 : group === 1 ? 0.45 : 1;
    const jitter = (mean, spread, max = 100) => Math.max(0, Math.min(max, Math.round(mean + gaussian(random) * spread)));
    return {
      label,
      features: {
        tabSwitches: jitter(scale * 7, 1.8),
        blurFocusEvents: jitter(scale * 8, 2),
        fullscreenExits: jitter(scale * 4, 1.2),
        nearbyDeviceCount: jitter(scale * 2, 0.7, 10),
        eventFrequency: jitter(scale * 12, 2.5),
        eventDuration: jitter(scale * 18, 3),
        sessionInterruptions: jitter(scale * 3, 1.1),
      },
    };
  });
}

function normalizeLabel(value) {
  const label = String(value || '').trim().toUpperCase().replace(/[\s-]+/g, '_');
  if (['LOW', 'LOW_RISK', 'NORMAL', '0'].includes(label)) return 'LOW_RISK';
  if (['MEDIUM', 'MEDIUM_RISK', '1'].includes(label)) return 'MEDIUM_RISK';
  if (['HIGH', 'HIGH_RISK', '2'].includes(label)) return 'HIGH_RISK';
  return null;
}

function normalizeRecords(records) {
  return records.map((row, index) => {
    const label = normalizeLabel(row?.label);
    if (!label || !row.features || typeof row.features !== 'object' || Array.isArray(row.features)) {
      throw new Error(`Invalid training row ${index + 1}: expected features and a valid risk label.`);
    }
    return { features: featureVector(row.features), label };
  });
}

function loadTrainingRecords() {
  const configuredPath = process.env.ML_TRAINING_DATA;
  if (!configuredPath) return { records: syntheticRecords(), source: 'synthetic-bootstrap' };
  const resolvedPath = path.resolve(configuredPath);
  const parsed = JSON.parse(fs.readFileSync(resolvedPath, 'utf8'));
  if (!Array.isArray(parsed) || parsed.length < 30) {
    throw new Error('ML_TRAINING_DATA must point to a JSON array with at least 30 labeled rows.');
  }
  const records = normalizeRecords(parsed);
  if (!records.some((row) => row.label === 'LOW_RISK') || !records.some((row) => row.label === 'HIGH_RISK')) {
    throw new Error('ML_TRAINING_DATA must include LOW_RISK and HIGH_RISK examples.');
  }
  return { records, source: 'labeled-json' };
}

function gini(labels) {
  if (!labels.length) return 0;
  const counts = new Map();
  for (const label of labels) counts.set(label, (counts.get(label) || 0) + 1);
  return 1 - [...counts.values()].reduce((sum, count) => {
    const probability = count / labels.length;
    return sum + probability * probability;
  }, 0);
}

function majorityLabel(rows) {
  const counts = new Map(CLASS_LABELS.map((label) => [label, 0]));
  for (const row of rows) counts.set(row.label, (counts.get(row.label) || 0) + 1);
  return [...counts.entries()].sort((left, right) => right[1] - left[1])[0][0];
}

function buildTree(rows, depth, random, maxDepth = 8, minLeaf = 3) {
  const label = majorityLabel(rows);
  if (depth >= maxDepth || rows.length < minLeaf * 2 || rows.every((row) => row.label === label)) return { label };

  const featureIndexes = FEATURE_KEYS.map((_, index) => index);
  for (let index = featureIndexes.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [featureIndexes[index], featureIndexes[swapIndex]] = [featureIndexes[swapIndex], featureIndexes[index]];
  }
  const candidates = featureIndexes.slice(0, Math.max(2, Math.floor(Math.sqrt(FEATURE_KEYS.length))));
  const parentImpurity = gini(rows.map((row) => row.label));
  let best = null;

  for (const featureIndex of candidates) {
    const key = FEATURE_KEYS[featureIndex];
    const sortedValues = [...new Set(rows.map((row) => row.features[key]))].sort((a, b) => a - b);
    for (let index = 0; index < sortedValues.length - 1; index += 1) {
      const threshold = (sortedValues[index] + sortedValues[index + 1]) / 2;
      const left = [];
      const right = [];
      for (const row of rows) (row.features[key] <= threshold ? left : right).push(row);
      if (left.length < minLeaf || right.length < minLeaf) continue;
      const weightedImpurity = (left.length * gini(left.map((row) => row.label)) + right.length * gini(right.map((row) => row.label))) / rows.length;
      const gain = parentImpurity - weightedImpurity;
      if (!best || gain > best.gain) best = { key, threshold, left, right, gain };
    }
  }

  if (!best || best.gain <= 1e-6) return { label };
  return {
    key: best.key,
    threshold: best.threshold,
    left: buildTree(best.left, depth + 1, random, maxDepth, minLeaf),
    right: buildTree(best.right, depth + 1, random, maxDepth, minLeaf),
  };
}

function predictTree(tree, features) {
  let node = tree;
  while (node.key) node = features[node.key] <= node.threshold ? node.left : node.right;
  return node.label;
}

function trainRandomForest(records, seed) {
  const random = seededRandom(seed);
  const trees = [];
  for (let index = 0; index < TREE_COUNT; index += 1) {
    const sample = Array.from({ length: records.length }, () => records[Math.floor(random() * records.length)]);
    trees.push(buildTree(sample, 0, random));
  }
  return { trees, sampleCount: records.length, featureKeys: FEATURE_KEYS };
}

function predictRandomForest(model, features) {
  const votes = Object.fromEntries(CLASS_LABELS.map((label) => [label, 0]));
  for (const tree of model.trees) votes[predictTree(tree, features)] += 1;
  const label = CLASS_LABELS.reduce((best, current) => votes[current] > votes[best] ? current : best, CLASS_LABELS[0]);
  const classProbability = votes[label] / model.trees.length;
  const riskProbability = (votes.HIGH_RISK + votes.MEDIUM_RISK * 0.5) / model.trees.length;
  const riskLabel = riskProbability >= 0.65 ? 'HIGH_RISK' : riskProbability >= 0.35 ? 'MEDIUM_RISK' : 'LOW_RISK';
  return { label, riskLabel, classProbability, riskProbability, votes };
}

// A small dependency-free 1D temporal convolution model. The ordered security
// metrics are treated as a short sequence, convolved with three fixed
// edge/momentum kernels, pooled, then classified against learned class
// centroids. It is deliberately explainable and deterministic for deployment.
function cnnEmbedding(features) {
  const sequence = FEATURE_KEYS.map((key) => {
    const limit = key === 'nearbyDeviceCount' ? 100 : 1000;
    return safeNumber(features[key], limit) / limit;
  });
  const embedding = [];
  for (const kernel of CNN_KERNELS) {
    const activations = [];
    for (let index = 0; index <= sequence.length - kernel.length; index += 1) {
      let value = 0;
      for (let offset = 0; offset < kernel.length; offset += 1) value += sequence[index + offset] * kernel[offset];
      activations.push(Math.max(0, value));
    }
    embedding.push(Math.max(...activations, 0));
    embedding.push(activations.reduce((sum, value) => sum + value, 0) / Math.max(1, activations.length));
  }
  return embedding;
}

function trainTemporalCnn(records) {
  const centroids = Object.fromEntries(CLASS_LABELS.map((label) => [label, Array(6).fill(0)]));
  const counts = Object.fromEntries(CLASS_LABELS.map((label) => [label, 0]));
  for (const row of records) {
    const embedding = cnnEmbedding(row.features);
    counts[row.label] += 1;
    embedding.forEach((value, index) => { centroids[row.label][index] += value; });
  }
  for (const label of CLASS_LABELS) {
    const count = Math.max(1, counts[label]);
    centroids[label] = centroids[label].map((value) => value / count);
  }
  return { centroids, counts, featureKeys: FEATURE_KEYS, kernelSizes: CNN_KERNELS.map((kernel) => kernel.length) };
}

function predictTemporalCnn(model, features) {
  const embedding = cnnEmbedding(features);
  const distances = Object.fromEntries(CLASS_LABELS.map((label) => [label,
    Math.sqrt(model.centroids[label].reduce((sum, value, index) => sum + (embedding[index] - value) ** 2, 0)),
  ]));
  const logits = Object.fromEntries(CLASS_LABELS.map((label) => [label, Math.exp(-distances[label] * 8)]));
  const total = Object.values(logits).reduce((sum, value) => sum + value, 0) || 1;
  const probabilities = Object.fromEntries(CLASS_LABELS.map((label) => [label, logits[label] / total]));
  const label = CLASS_LABELS.reduce((best, current) => probabilities[current] > probabilities[best] ? current : best, CLASS_LABELS[0]);
  const riskProbability = probabilities.HIGH_RISK + probabilities.MEDIUM_RISK * 0.5;
  return { label, riskProbability, probabilities, distances, embedding };
}

function blendedPrediction(models, features) {
  const forest = predictRandomForest(models.randomForest, features);
  const cnn = predictTemporalCnn(models.cnn, features);
  const riskProbability = forest.riskProbability * 0.6 + cnn.riskProbability * 0.4;
  const label = riskProbability >= 0.65 ? 'HIGH_RISK' : riskProbability >= 0.35 ? 'MEDIUM_RISK' : 'LOW_RISK';
  return { label, riskProbability, forest, cnn };
}

function validationMetrics(models, records) {
  const confusionMatrix = Object.fromEntries(CLASS_LABELS.map((actual) => [actual,
    Object.fromEntries(CLASS_LABELS.map((predicted) => [predicted, 0])),
  ]));
  let correct = 0;
  for (const row of records) {
    const predicted = blendedPrediction(models, row.features).label;
    confusionMatrix[row.label][predicted] += 1;
    if (predicted === row.label) correct += 1;
  }
  const perClass = Object.fromEntries(CLASS_LABELS.map((label) => {
    const truePositive = confusionMatrix[label][label];
    const falsePositive = CLASS_LABELS.reduce((sum, actual) => sum + (actual === label ? 0 : confusionMatrix[actual][label]), 0);
    const falseNegative = CLASS_LABELS.reduce((sum, predicted) => sum + (predicted === label ? 0 : confusionMatrix[label][predicted]), 0);
    const precision = truePositive / Math.max(1, truePositive + falsePositive);
    const recall = truePositive / Math.max(1, truePositive + falseNegative);
    const f1 = (precision + recall) ? (2 * precision * recall) / (precision + recall) : 0;
    return [label, {
      precision: Number(precision.toFixed(4)),
      recall: Number(recall.toFixed(4)),
      f1: Number(f1.toFixed(4)),
      support: CLASS_LABELS.reduce((sum, predicted) => sum + confusionMatrix[label][predicted], 0),
    }];
  }));
  const values = Object.values(perClass);
  return {
    sampleCount: records.length,
    accuracy: Number((correct / Math.max(1, records.length)).toFixed(4)),
    macroPrecision: Number((values.reduce((sum, row) => sum + row.precision, 0) / values.length).toFixed(4)),
    macroRecall: Number((values.reduce((sum, row) => sum + row.recall, 0) / values.length).toFixed(4)),
    macroF1: Number((values.reduce((sum, row) => sum + row.f1, 0) / values.length).toFixed(4)),
    perClass,
    confusionMatrix,
  };
}

function trainModels(records, source = 'in-memory-labeled') {
  if (!Array.isArray(records) || records.length < 30) throw new Error('At least 30 labeled rows are required to train the Random Forest.');
  const normalizedRecords = normalizeRecords(records);
  if (!normalizedRecords.some((row) => row.label === 'LOW_RISK') || !normalizedRecords.some((row) => row.label === 'HIGH_RISK')) {
    throw new Error('Training rows must include LOW_RISK and HIGH_RISK examples.');
  }
  const validationRows = normalizedRecords.filter((_, index) => index % 5 === 0);
  const trainingRows = normalizedRecords.filter((_, index) => index % 5 !== 0);
  const trained = {
    source,
    sampleCount: normalizedRecords.length,
    classes: [...new Set(normalizedRecords.map((row) => row.label))],
    randomForest: trainRandomForest(trainingRows, 0x5ec00a),
    cnn: trainTemporalCnn(trainingRows),
  };
  return {
    ...trained,
    validation: {
      method: 'deterministic 80/20 holdout by row order',
      warning: 'Demo metrics are not a certification of hiring accuracy. Replace demo data with consented, reviewed, representative labeled data before operational use.',
      ...validationMetrics(trained, validationRows),
    },
    fairness: {
      status: 'not-run',
      reason: 'No demographic or protected-attribute data is collected or used by SecureNexus.',
      nextStep: 'Run an approved offline fairness audit on consented, de-identified evaluation data outside the interview app.',
    },
  };
}

function getModels() {
  if (!cachedModels) {
    const { records, source } = loadTrainingRecords();
    cachedModels = trainModels(records, source);
  }
  return cachedModels;
}

function analyzeSecurityFeatures(features = {}) {
  const vector = featureVector(features);
  const models = getModels();
  const combinedPrediction = blendedPrediction(models, vector);
  const forestPrediction = combinedPrediction.forest;
  const cnnPrediction = combinedPrediction.cnn;
  const riskProbability = combinedPrediction.riskProbability;
  const riskScore = Math.round(riskProbability * 100);
  const integrityScore = Math.max(0, Math.min(100, 100 - riskScore));
  const contributingEvents = FEATURE_KEYS.filter((key) => vector[key] > 0);

  return {
    success: true,
    demoPipeline: models.source === 'synthetic-bootstrap',
    training: {
      source: models.source,
      sampleCount: models.sampleCount,
      classes: models.classes,
      warning: models.source === 'synthetic-bootstrap'
        ? 'Bootstrapped with synthetic examples. Replace with reviewed, consented data and validate the model before evaluating real candidates.'
        : 'Validate configured labeled examples independently before operational use.',
    },
    validation: models.validation,
    fairness: models.fairness,
    integrityScore,
    riskLevel: riskScore >= 65 ? 'HIGH' : riskScore >= 35 ? 'MEDIUM' : 'LOW',
    riskCategory: riskScore >= 65 ? 'HIGH_RISK' : riskScore >= 35 ? 'MEDIUM_RISK' : 'LOW_RISK',
    riskScore,
    contributingSecurityEvents: contributingEvents,
    models: {
      randomForest: {
        status: 'trained',
        algorithm: 'CART decision trees with bootstrap sampling and Gini impurity',
        treeCount: models.randomForest.trees.length,
        label: forestPrediction.riskLabel,
        predictedClass: forestPrediction.label,
        classProbability: Number(forestPrediction.classProbability.toFixed(4)),
        votes: forestPrediction.votes,
        riskScore,
        riskProbability: Number(forestPrediction.riskProbability.toFixed(4)),
        featureVector: vector,
        contributingEvents,
      },
      cnn: {
        status: 'trained',
        algorithm: '1D temporal convolution with ReLU, global pooling, and centroid classifier',
        kernelSizes: models.cnn.kernelSizes,
        label: cnnPrediction.label,
        riskScore: Math.round(cnnPrediction.riskProbability * 100),
        riskProbability: Number(cnnPrediction.riskProbability.toFixed(4)),
        probabilities: Object.fromEntries(Object.entries(cnnPrediction.probabilities).map(([key, value]) => [key, Number(value.toFixed(4))])),
        embedding: cnnPrediction.embedding.map((value) => Number(value.toFixed(4))),
      },
    },
    notes: [
      'Random Forest and a lightweight 1D temporal-convolution model are enabled.',
      'A model score is a review signal, not proof of misconduct and not a standalone hiring decision.',
      'Inputs are browser tab/window/fullscreen events and opt-in BLE signal counts; no face or biometric features are used.',
    ],
  };
}

function resetModelsForTests() { cachedModels = null; }

module.exports = { analyzeSecurityFeatures, trainModels, resetModelsForTests, featureVector, cnnEmbedding, predictTemporalCnn };
