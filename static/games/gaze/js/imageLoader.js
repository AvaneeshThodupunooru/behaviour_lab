const SUPPORTED_EXTENSIONS = ['jpg', 'jpeg', 'png', 'webp', 'gif'];
const IMAGE_ASSET_BASE = new URL('../', document.currentScript.src);

function assetUrl(relativePath) {
  return new URL(relativePath, IMAGE_ASSET_BASE).href;
}

function loadOneImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject();
    img.src = url;
  });
}

async function findImageForNumber(folder, n) {
  for (const ext of SUPPORTED_EXTENSIONS) {
    const url = `${assetUrl(`Images/${folder}/${n}.${ext}`)}?v=${Date.now()}`;
    try {
      const img = await loadOneImage(url);
      return {
        id: String(n),
        url,
        width: img.naturalWidth,
        height: img.naturalHeight,
        questionUrl: assetUrl(`js/${folder}/${n}.json`)
      };
    } catch (e) {
      // that extension doesn't exist for this number, try the next one
    }
  }
  return null; // no file found for this number at all
}

async function detectImages(folder) {
  const images = [];
  let consecutiveMisses = 0;
  for (let n = 1; n <= 1000 && consecutiveMisses < 5; n++) {
    const found = await findImageForNumber(folder, n);
    if (found) {
      images.push(found);
      consecutiveMisses = 0;
    } else {
      consecutiveMisses++;
    }
  }
  return images;
}

function shuffleArray(arr) {
  const copy = arr.slice();
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

async function loadQuestions(image) {
  let response;
  try {
    response = await fetch(`${image.questionUrl}?v=${Date.now()}`);
  } catch (error) {
    throw new Error(`Could not load questions for image ${image.id}: ${image.questionUrl}`);
  }
  if (!response.ok) {
    throw new Error(`Missing question file for image ${image.id}: ${image.questionUrl}`);
  }

  let data;
  try {
    data = await response.json();
  } catch (error) {
    throw new Error(`Invalid question JSON for image ${image.id}: ${image.questionUrl}`);
  }
  if (!Array.isArray(data) || data.length === 0) {
    throw new Error(`Question file is empty or invalid for image ${image.id}: ${image.questionUrl}`);
  }

  image.questions = data.map((question, index) => {
    const prompt = question.prompt || question.question;
    const answer = question.answer ?? question.correct_answer;
    if (!prompt || !Array.isArray(question.options) || answer === undefined) {
      throw new Error(`Invalid question ${index + 1} in ${image.questionUrl}`);
    }
    return {
      id: `${image.id}-q-${question.id ?? index + 1}`,
      prompt,
      options: question.options,
      answer
    };
  });
  return image;
}

async function getImagesForParticipant(age, gender) {
  if (!Number.isFinite(age) || age <= 0) {
    throw new Error('Please enter a valid age.');
  }

  let folder;
  if (age > 21) {
    folder = 'Oldies';
  } else if (gender === 'female') {
    folder = 'Female';
  } else if (gender === 'male') {
    folder = 'Male';
  } else {
    throw new Error('Please select a gender for participants aged 21 or below.');
  }

  const available = await detectImages(folder);
  if (available.length < 2) {
    throw new Error(`At least 2 images are required in Images/${folder}/; found ${available.length}.`);
  }

  const checked = await Promise.all(available.map(async image => {
    try {
      return { image: await loadQuestions(image), error: null };
    } catch (error) {
      return { image, error };
    }
  }));
  const validImages = checked.filter(item => !item.error).map(item => item.image);
  if (validImages.length < 2) {
    const failures = checked.filter(item => item.error)
      .map(item => item.error.message)
      .join(' ');
    throw new Error(`Fewer than 2 usable image/question pairs are available in Images/${folder}/. ${failures}`);
  }

  return shuffleArray(validImages).slice(0, 2);
}