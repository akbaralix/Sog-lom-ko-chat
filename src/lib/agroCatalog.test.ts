import test from 'node:test';
import assert from 'node:assert/strict';
import {
  AGRO_PREPARATIONS,
  UZ_REGIONS,
  calculateDosage,
  computeArrowGeometry,
  evaluateWeatherRisk,
  matchPreparations,
  normalizeAffectedSpots,
} from './agroCatalog.ts';

test('matchPreparations selects relevant local Uzbekistan preparations for diseased plants and none for healthy', () => {
  assert.deepEqual(
    matchPreparations({ healthStatus: 'healthy', recommendedClass: 'none', diseaseName: null }),
    [],
  );

  const fungal = matchPreparations({
    healthStatus: 'diseased',
    recommendedClass: 'fungicide',
    diseaseName: 'Pomidor fitoftorozi',
  });
  assert.ok(fungal.length >= 1);
  assert.equal(fungal[0].id, 'ridomil-gold');

  const pest = matchPreparations({
    healthStatus: 'diseased',
    recommendedClass: 'insecticide',
    diseaseName: 'Barg shirasi va oq qanot',
  });
  assert.equal(pest[0].id, 'aktara-25');
});

test('calculateDosage scales correctly by 10L liters mode and sotix area mode', () => {
  const ridomil = AGRO_PREPARATIONS[0]; // 25g per 10L, 5L per sotix
  const byBucket = calculateDosage(ridomil, 'liters', 10);
  assert.equal(byBucket.waterLiters, 10);
  assert.equal(byBucket.productAmount, 25);
  assert.equal(byBucket.formattedDose, '25 g');

  const bySotix = calculateDosage(ridomil, 'sotix', 4);
  assert.equal(bySotix.waterLiters, 20);
  assert.equal(bySotix.productAmount, 50);
  assert.equal(bySotix.formattedWater, '20 L suv');
});

test('normalizeAffectedSpots and computeArrowGeometry keep arrow targets and tails inside image bounds', () => {
  const spots = normalizeAffectedSpots([
    { label: '  Bargdagi qora dog‘  ', xPercent: 1, yPercent: 99, severity: 'high' },
    { label: '', xPercent: 50, yPercent: 50 },
  ]);
  assert.equal(spots.length, 1);
  assert.equal(spots[0].xPercent, 7);
  assert.equal(spots[0].yPercent, 92);

  const arrow = computeArrowGeometry(spots[0].xPercent, spots[0].yPercent);
  assert.ok(arrow.tailX > arrow.tipX);
  assert.ok(arrow.tailY < arrow.tipY);
  assert.ok(arrow.tailX >= 12 && arrow.tailX <= 88);
  assert.ok(arrow.tailY >= 12 && arrow.tailY <= 88);
});

test('evaluateWeatherRisk flags high fungal risk when humidity is elevated', () => {
  const report = evaluateWeatherRisk({
    region: UZ_REGIONS[1],
    temperatureC: 21,
    humidityPct: 82,
    rainProbabilityPct: 60,
    communityAlertsCount: 3,
    liveSource: true,
  });
  assert.equal(report.riskLevel, 'high');
  assert.equal(report.regionName, "Farg'ona");
});
