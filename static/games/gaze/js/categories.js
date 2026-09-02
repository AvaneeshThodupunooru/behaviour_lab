// Shared age/gender -> image-category logic, loaded by both the standalone
// gaze page and the merged gaze-timer page (relative path from gaze-timer:
// ../gaze/js/categories.js). Single source of truth so the two pages can't
// drift out of sync on which numbers belong to which category.

// 4 image numbers assigned per category, out of 16 flat files in Images/.
var CATEGORY_IMAGE_NUMBERS = {
  'below25-male':   [1, 2, 3, 4],
  'below25-female': [5, 6, 7, 8],
  'above25-male':   [9, 10, 11, 12],
  'above25-female': [13, 14, 15, 16]
};

function resolveCategory(age, gender) {
  var bracket = age >= 25 ? 'above25' : 'below25';
  return bracket + '-' + gender;
}

// Fisher-Yates shuffle; returns a new array, does not mutate input.
function shuffleArray(arr) {
  var copy = arr.slice();
  for (var i = copy.length - 1; i > 0; i--) {
    var j = Math.floor(Math.random() * (i + 1));
    var tmp = copy[i]; copy[i] = copy[j]; copy[j] = tmp;
  }
  return copy;
}

// Picks n random, non-repeating numbers from a category's assigned list
// (e.g. 2 random numbers out of that category's 4), so not every
// participant in the same category sees the same 2 images.
function pickRandomNumbers(category, n) {
  var pool = CATEGORY_IMAGE_NUMBERS[category] || [];
  return shuffleArray(pool).slice(0, n);
}

// Loads up to n images for a category, tolerant of a station that doesn't
// have the full 4-image set per category yet (e.g. only 1.png-4.png exist
// while categories reference up to 16). Strategy:
//   1. Try every number assigned to this category (shuffled), not just n
//      of them, since some of those numbers may not have a file on disk.
//   2. If that still comes up short of n, top up with whatever other
//      images actually exist in Images/ (detectImages scans 1, 2, 3, ...
//      until a gap), skipping numbers already picked.
// Depends on loadImagesByNumbers and detectImages from imageLoader.js,
// which must be loaded before this script.
async function loadImagesForCategory(category, n) {
  var pool = CATEGORY_IMAGE_NUMBERS[category] || [];
  var fromCategory = await loadImagesByNumbers(shuffleArray(pool));
  if (fromCategory.length >= n) {
    return fromCategory.slice(0, n);
  }

  var already = fromCategory.map(function (im) { return im.id; });
  var everything = await detectImages();
  var extra = shuffleArray(everything.filter(function (im) { return already.indexOf(im.id) === -1; }));
  return fromCategory.concat(extra).slice(0, n);
}
