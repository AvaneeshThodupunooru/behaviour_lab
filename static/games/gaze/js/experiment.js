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
  // Combined recall screen shown only after all images have been viewed.
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
    hint.textContent = `Answer all ${selectedQuestions.length} questions about the images you just viewed, then continue.`;
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

    selectedQuestions = [];
    images.forEach((img, imgIndex) => {
      img.questions.forEach(question => {
        selectedQuestions.push({ imageIndex: imgIndex, question });
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
