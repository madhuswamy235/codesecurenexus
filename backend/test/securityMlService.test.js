const test = require('node:test');
const assert = require('node:assert/strict');
const {
  analyzeSecurityFeatures,
  trainModels,
  resetModelsForTests,
  featureVector,
} = require('../src/services/securityMlService');

test('runs the Random Forest and temporal CNN security models', () => {
  resetModelsForTests();
  const result = analyzeSecurityFeatures({ tabSwitches: 4, nearbyDeviceCount: 2, eventFrequency: 6 });

  assert.equal(result.demoPipeline, true);
  assert.equal(result.training.source, 'synthetic-bootstrap');
  assert.ok(result.models.randomForest.treeCount > 1);
  assert.equal(result.models.randomForest.status, 'trained');
  assert.ok(result.models.randomForest.votes.HIGH_RISK >= 0);
  assert.equal(result.models.cnn.status, 'trained');
  assert.deepEqual(result.models.cnn.kernelSizes, [3, 3, 3]);
  assert.ok(result.models.cnn.riskProbability >= 0 && result.models.cnn.riskProbability <= 1);
  assert.deepEqual(Object.keys(result.models), ['randomForest', 'cnn']);
  assert.deepEqual(Object.keys(result.models.randomForest.featureVector), [
    'tabSwitches', 'blurFocusEvents', 'fullscreenExits', 'nearbyDeviceCount',
    'eventFrequency', 'eventDuration', 'sessionInterruptions',
  ]);
});

test('trains the Random Forest using labeled rows', () => {
  const records = Array.from({ length: 60 }, (_, index) => {
    const label = index < 20 ? 'LOW_RISK' : index < 40 ? 'MEDIUM_RISK' : 'HIGH_RISK';
    const eventCount = label === 'LOW_RISK' ? 0 : label === 'MEDIUM_RISK' ? 3 : 8;
    return { label, features: { tabSwitches: eventCount, nearbyDeviceCount: eventCount > 5 ? 2 : 0 } };
  });
  const models = trainModels(records);
  assert.equal(models.source, 'in-memory-labeled');
  assert.equal(models.sampleCount, 60);
  assert.deepEqual(models.classes, ['LOW_RISK', 'MEDIUM_RISK', 'HIGH_RISK']);
  assert.equal(models.randomForest.trees.length, 51);
  assert.equal(models.cnn.kernelSizes.length, 3);
  assert.equal(models.cnn.centroids.HIGH_RISK.length, 6);
  assert.equal(models.isolationForest, undefined);
});

test('ignores removed face/biometric features and clamps numeric inputs', () => {
  const vector = featureVector({ tabSwitches: -4, faceCount: 3, attentionScore: 5, nearbyDeviceCount: 101 });
  assert.equal(vector.tabSwitches, 0);
  assert.equal(vector.nearbyDeviceCount, 100);
  assert.equal('faceCount' in vector, false);
  assert.equal('attentionScore' in vector, false);
});

test('rejects unlabeled or undersized training input', () => {
  assert.throws(() => trainModels([]), /At least 30 labeled rows/);
});
