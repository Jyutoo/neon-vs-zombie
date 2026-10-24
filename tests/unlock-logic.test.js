// tests/unlock-logic.test.js
// Tests for character unlock logic: level-clear-based unlocking

const CHARACTER_UNLOCK_LEVELS = {
  rat: 2, rabbit: 3, dog: 4, tiger: 5,
  goat: 6, rooster: 7, pig: 8, horse: 9, dragon: 10
};

const STARTING_UNITS = ['egg', 'snake', 'ox', 'monkey'];

function checkCharacterUnlocks(highestCleared, currentlyUnlocked) {
  const unlocked = [...currentlyUnlocked];
  const newlyUnlocked = [];
  for (const [char, level] of Object.entries(CHARACTER_UNLOCK_LEVELS)) {
    if (highestCleared >= level && !unlocked.includes(char)) {
      unlocked.push(char);
      newlyUnlocked.push(char);
    }
  }
  return { unlocked, newlyUnlocked };
}

// --- Test helpers ---
let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    passed++;
    console.log(`  PASS: ${message}`);
  } else {
    failed++;
    console.error(`  FAIL: ${message}`);
  }
}

function assertArraysEqual(actual, expected, message) {
  const actualSorted = [...actual].sort();
  const expectedSorted = [...expected].sort();
  assert(
    actualSorted.length === expectedSorted.length &&
    actualSorted.every((v, i) => v === expectedSorted[i]),
    `${message} (got [${actualSorted}], expected [${expectedSorted}])`
  );
}

// --- Tests ---
console.log('\n=== Character Unlock Logic Tests ===\n');

console.log('Test 1: Starting units are always unlocked');
{
  const result = checkCharacterUnlocks(0, [...STARTING_UNITS]);
  assertArraysEqual(result.unlocked, STARTING_UNITS, 'At level 0, only starting units');
  assert(result.newlyUnlocked.length === 0, 'No new unlocks at level 0');
}

console.log('\nTest 2: Clearing level 2 unlocks rat');
{
  const result = checkCharacterUnlocks(2, [...STARTING_UNITS]);
  assert(result.unlocked.includes('rat'), 'rat unlocked after level 2');
  assertArraysEqual(result.newlyUnlocked, ['rat'], 'Only rat is newly unlocked');
}

console.log('\nTest 3: Clearing level 5 unlocks rat, rabbit, dog, tiger');
{
  const result = checkCharacterUnlocks(5, [...STARTING_UNITS]);
  assert(result.unlocked.includes('rat'), 'rat unlocked at level 5');
  assert(result.unlocked.includes('rabbit'), 'rabbit unlocked at level 5');
  assert(result.unlocked.includes('dog'), 'dog unlocked at level 5');
  assert(result.unlocked.includes('tiger'), 'tiger unlocked at level 5');
  assert(!result.unlocked.includes('goat'), 'goat NOT unlocked at level 5');
  assertArraysEqual(result.newlyUnlocked, ['rat', 'rabbit', 'dog', 'tiger'], 'Correct newly unlocked list');
}

console.log('\nTest 4: Clearing level 10 unlocks all characters');
{
  const result = checkCharacterUnlocks(10, [...STARTING_UNITS]);
  const allCharacters = [...STARTING_UNITS, ...Object.keys(CHARACTER_UNLOCK_LEVELS)];
  assertArraysEqual(result.unlocked, allCharacters, 'All characters unlocked at level 10');
}

console.log('\nTest 5: Already unlocked characters are not re-added');
{
  const existingUnlocked = [...STARTING_UNITS, 'rat', 'rabbit'];
  const result = checkCharacterUnlocks(3, existingUnlocked);
  assert(result.newlyUnlocked.length === 0, 'No new unlocks when already unlocked');
  assert(result.unlocked.length === existingUnlocked.length, 'Unlocked list unchanged');
}

console.log('\nTest 6: Progressive unlocking — level 7 unlocks up to rooster');
{
  const result = checkCharacterUnlocks(7, [...STARTING_UNITS]);
  assert(result.unlocked.includes('rat'), 'rat unlocked');
  assert(result.unlocked.includes('rabbit'), 'rabbit unlocked');
  assert(result.unlocked.includes('dog'), 'dog unlocked');
  assert(result.unlocked.includes('tiger'), 'tiger unlocked');
  assert(result.unlocked.includes('goat'), 'goat unlocked');
  assert(result.unlocked.includes('rooster'), 'rooster unlocked');
  assert(!result.unlocked.includes('pig'), 'pig NOT unlocked at level 7');
  assert(!result.unlocked.includes('horse'), 'horse NOT unlocked at level 7');
  assert(!result.unlocked.includes('dragon'), 'dragon NOT unlocked at level 7');
}

console.log('\nTest 7: CHARACTER_UNLOCK_LEVELS has correct mapping');
{
  assert(CHARACTER_UNLOCK_LEVELS.rat === 2, 'rat requires level 2');
  assert(CHARACTER_UNLOCK_LEVELS.rabbit === 3, 'rabbit requires level 3');
  assert(CHARACTER_UNLOCK_LEVELS.dog === 4, 'dog requires level 4');
  assert(CHARACTER_UNLOCK_LEVELS.tiger === 5, 'tiger requires level 5');
  assert(CHARACTER_UNLOCK_LEVELS.goat === 6, 'goat requires level 6');
  assert(CHARACTER_UNLOCK_LEVELS.rooster === 7, 'rooster requires level 7');
  assert(CHARACTER_UNLOCK_LEVELS.pig === 8, 'pig requires level 8');
  assert(CHARACTER_UNLOCK_LEVELS.horse === 9, 'horse requires level 9');
  assert(CHARACTER_UNLOCK_LEVELS.dragon === 10, 'dragon requires level 10');
}

console.log('\nTest 8: Clearing level 1 does not unlock any new character');
{
  const result = checkCharacterUnlocks(1, [...STARTING_UNITS]);
  assert(result.newlyUnlocked.length === 0, 'No new unlocks at level 1');
  assertArraysEqual(result.unlocked, STARTING_UNITS, 'Only starting units at level 1');
}

console.log('\nTest 9: Existing custard-unlocked characters are preserved');
{
  // Simulate a save where 'dragon' was unlocked via custard previously
  const existingUnlocked = [...STARTING_UNITS, 'dragon'];
  const result = checkCharacterUnlocks(0, existingUnlocked);
  assert(result.unlocked.includes('dragon'), 'dragon remains unlocked from custard era');
  assert(result.newlyUnlocked.length === 0, 'No new unlocks triggered');
}

console.log('\nTest 10: Unlocking is idempotent — running check twice yields same result');
{
  let unlocked = [...STARTING_UNITS];
  const result1 = checkCharacterUnlocks(5, unlocked);
  unlocked = result1.unlocked;
  const result2 = checkCharacterUnlocks(5, unlocked);
  assert(result2.newlyUnlocked.length === 0, 'Second run finds no new unlocks');
  assertArraysEqual(result1.unlocked, result2.unlocked, 'Unlocked list stable across runs');
}

// --- Summary ---
console.log(`\n=== Results: ${passed} passed, ${failed} failed ===\n`);
process.exit(failed > 0 ? 1 : 0);
