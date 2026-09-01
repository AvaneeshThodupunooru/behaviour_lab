const Experiment = (function () {
  // Each image is shown for exactly 7 seconds.
  const POSTER_DURATION_MS = 7000;
  let images = [];
  let currentIndex = 0;
  let currentImgEl = null;
  let currentImgDocRect = null; // {left, top, width, height} in document coordinates
  let onCompleteCb = null;
  let questionResults = [];
  let selectedQuestions = []; // fixed random selection for this session

  // -----------------------------------------------------------------
  // Question banks — 8 objective visual-recall questions per image.
  // Only images 1 and 2 are used in the active experiment.
  // -----------------------------------------------------------------
  const QUESTION_BANK = {
    1: [
      { id: 'img1-q1', prompt: 'What animal is the woman holding?', options: ['Cat', 'Rabbit', 'Dog', 'Fox'], answer: 'Cat' },
      { id: 'img1-q2', prompt: 'What is the man holding?', options: ['A camera', 'A fish bowl', 'A book', 'A coffee cup'], answer: 'A fish bowl' },
      { id: 'img1-q3', prompt: 'What color is the cat the woman is holding?', options: ['Orange', 'Black', 'White', 'Gray'], answer: 'Orange' },
      { id: 'img1-q4', prompt: 'How many people are visible in the image?', options: ['1', '2', '3', '4'], answer: '2' },
      { id: 'img1-q5', prompt: 'Is the woman standing or sitting?', options: ['Standing', 'Sitting', 'Kneeling', 'Lying down'], answer: 'Standing' },
      { id: 'img1-q6', prompt: 'What is the man doing with the fish bowl?', options: ['Holding it in both hands', 'Balancing it on his head', 'Setting it on a table', 'Pouring water from it'], answer: 'Holding it in both hands' },
      { id: 'img1-q7', prompt: 'Where in the image is the man positioned?', options: ['Left side', 'Right side', 'Center', 'Background'], answer: 'Right side' },
      { id: 'img1-q8', prompt: 'Is there a visible background in the image?', options: ['Yes, an indoor scene', 'Yes, an outdoor scene', 'Plain or minimal background', 'Dark background'], answer: 'Yes, an indoor scene' }
    ],
    2: [
      { id: 'img2-q1', prompt: 'What is the man in the center doing?', options: ['Raising both arms', 'Playing guitar', 'Reading', 'Running'], answer: 'Raising both arms' },
      { id: 'img2-q2', prompt: 'What is the woman in white holding?', options: ['A phone', 'A wine glass', 'A handbag', 'A flower'], answer: 'A wine glass' },
      { id: 'img2-q3', prompt: 'How many people are visible in the image?', options: ['2', '3', '4', '5 or more'], answer: '5 or more' },
      { id: 'img2-q4', prompt: 'Is the scene set indoors or outdoors?', options: ['Indoors', 'Outdoors', 'Both', 'Cannot tell'], answer: 'Indoors' },
      { id: 'img2-q5', prompt: 'What color clothing is the man in the center wearing?', options: ['White', 'Black', 'Blue', 'Red'], answer: 'White' },
      { id: 'img2-q6', prompt: 'Are the people in the image standing or sitting?', options: ['All standing', 'All sitting', 'Mix of both', 'Cannot tell'], answer: 'All standing' },
      { id: 'img2-q7', prompt: 'Is there any food or drink visible besides the wine glass?', options: ['Yes', 'No', 'Cannot tell', 'Only the wine glass'], answer: 'Only the wine glass' },
      { id: 'img2-q8', prompt: 'What is the general mood of the scene?', options: ['Celebratory or festive', 'Calm and quiet', 'Tense or serious', 'Sad or somber'], answer: 'Celebratory or festive' }
    ]
  };

  // -----------------------------------------------------------------
  // Utility: pick n unique random items from an array (Fisher-Yates)
  // -----------------------------------------------------------------
  function pickRandom(arr, n) {
    const copy = arr.slice();
    const result = [];
    for (let i = 0; i < n && copy.length > 0; i++) {
      const idx = Math.floor(Math.random() * copy.length);
      result.push(copy.splice(idx, 1)[0]);
    }
    return result;
  }

  function mapGazeToImagePixels(docX, docY) {
    if (!currentImgDocRect) return null;
    const { left, top, width, height } = currentImgDocRect;

    // Outside the displayed image (i.e. gaze landed on the letterbox padding)
    if (docX < left || docX > left + width || docY < top || docY > top + height) {
      return null;
    }

    const img = images[currentIndex];
    const relX = (docX - left) / width;   // 0..1 across the displayed image
    const relY = (docY - top) / height;

    return {
      x: relX * img.width,   // scaled to the ORIGINAL image's pixel dimensions
      y: relY * img.height
    };
  }

  // -----------------------------------------------------------------
  // Show an image for POSTER_DURATION_MS, then advance.
  // NO questions are shown between images.
  // -----------------------------------------------------------------
  function showPoster(index) {
    currentIndex = index;
    const img = images[index];

    const container = document.getElementById('posterContainer');
    container.innerHTML = '';
    currentImgEl = document.createElement('img');
    currentImgEl.src = img.url;
    currentImgEl.id = 'posterImg';
    container.appendChild(currentImgEl);

    document.getElementById('posterCounter').textContent =
      `Image ${index + 1} / ${images.length} — look carefully; questions follow after all images`;

    currentImgEl.onload = () => {
      const rect = currentImgEl.getBoundingClientRect();
      currentImgDocRect = {
        left: rect.left + window.scrollX,
        top: rect.top + window.scrollY,
        width: rect.width,
        height: rect.height
      };
    };

    setTimeout(() => {
      // Stop gaze attribution for the current image
      currentImgDocRect = null;
      if (index + 1 < images.length) {
        // Advance to next image — no questions yet
        showPoster(index + 1);
      } else {
        // All images viewed — now show recall questions
        showCombinedQuestions();
      }
    }, POSTER_DURATION_MS);
  }

  // -----------------------------------------------------------------
  // Combined recall screen: 4 questions (2 from each image's bank)
  // shown ONLY after all images have been viewed.
  // -----------------------------------------------------------------
  function showCombinedQuestions() {
    currentImgDocRect = null;
    const container = document.getElementById('posterContainer');
    container.innerHTML = '';

    const card = document.createElement('div');
    card.className = 'gaze-question-card';

    const title = document.createElement('h2');
    title.textContent = 'Quick recall — what did you see?';
    card.appendChild(title);

    const hint = document.createElement('p');
    hint.className = 'gaze-question-hint';
    hint.textContent = 'Answer all 4 questions about the images you just viewed, then continue.';
    card.appendChild(hint);

    selectedQuestions.forEach((sq, flatIndex) => {
      const fieldset = document.createElement('fieldset');
      fieldset.className = 'gaze-question';
      const legend = document.createElement('legend');
      legend.textContent = `${flatIndex + 1}. (Image ${sq.imageIndex + 1}) ${sq.question.prompt}`;
      fieldset.appendChild(legend);

      sq.question.options.forEach(option => {
        const label = document.createElement('label');
        label.className = 'gaze-option';
        const input = document.createElement('input');
        input.type = 'radio';
        input.name = `gaze-combined-q-${flatIndex}`;
        input.value = option;
        label.appendChild(input);
        label.appendChild(document.createTextNode(option));
        fieldset.appendChild(label);
      });
      card.appendChild(fieldset);
    });

    const continueButton = document.createElement('button');
    continueButton.type = 'button';
    continueButton.className = 'gaze-question-continue';
    continueButton.textContent = 'Finish gaze task';
    continueButton.disabled = true;
    card.appendChild(continueButton);

    function allAnswered() {
      return selectedQuestions.every((_, i) => {
        return card.querySelector(`input[name="gaze-combined-q-${i}"]:checked`) !== null;
      });
    }

    card.addEventListener('change', () => {
      continueButton.disabled = !allAnswered();
    });

    continueButton.addEventListener('click', () => {
      selectedQuestions.forEach((sq, flatIndex) => {
        const selected = card.querySelector(`input[name="gaze-combined-q-${flatIndex}"]:checked`);
        const selectedValue = selected ? selected.value : null;
        questionResults.push({
          imageId: images[sq.imageIndex].id,
          questionId: sq.question.id,
          questionText: sq.question.prompt,
          selected: selectedValue,
          correctAnswer: sq.question.answer,
          correct: selectedValue === sq.question.answer
        });
      });
      finish();
    });

    container.appendChild(card);
    document.getElementById('posterCounter').textContent = 'Delayed recall — answer from memory';
  }

  function finish() {
    currentImgDocRect = null;
    if (onCompleteCb) onCompleteCb();
  }

  function start(imageList, onComplete) {
    images = imageList;
    onCompleteCb = onComplete;
    questionResults = [];

    // Select 2 random unique questions from each image's bank.
    // This selection is fixed for the duration of this session.
    selectedQuestions = [];
    images.forEach((img, imgIndex) => {
      const bank = QUESTION_BANK[img.id] || [];
      const picked = pickRandom(bank, 2);
      picked.forEach(q => {
        selectedQuestions.push({ imageIndex: imgIndex, question: q });
      });
    });

    GazeTracker.onResult((gazeData) => {
      if (gazeData.state !== 0) return; // skip blinks / tracking loss / uncalibrated
      const mapped = mapGazeToImagePixels(gazeData.docX, gazeData.docY);
      if (!mapped) return; // gaze was off the poster (on the letterbox padding)

      const currentImageId = images[currentIndex].id;
      DataStore.addSample(currentImageId, mapped.x, mapped.y, gazeData.time);
    });

    showPoster(0);
  }

  function getQuestionResults() { return questionResults.slice(); }

  return { start, getQuestionResults };
})();
