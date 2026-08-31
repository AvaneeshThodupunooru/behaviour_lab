const Experiment = (function () {
  // Four posters × five seconds = the merged station's 20-second phase.
  const POSTER_DURATION_MS = 5000;
  let images = [];
  let currentIndex = 0;
  let currentImgEl = null;
  let currentImgDocRect = null; // {left, top, width, height} in document coordinates
  let onCompleteCb = null;
  let questionResults = [];

  const QUESTIONS = {
    1: [
      { prompt: 'What animal is the woman holding?', options: ['Cat', 'Rabbit', 'Dog', 'Fox'], answer: 'Cat' },
      { prompt: 'What is the man holding?', options: ['A camera', 'A fish bowl', 'A book', 'A coffee cup'], answer: 'A fish bowl' }
    ],
    2: [
      { prompt: 'What is the man in the center doing?', options: ['Raising both arms', 'Playing guitar', 'Reading', 'Running'], answer: 'Raising both arms' },
      { prompt: 'What is the woman in white holding?', options: ['A phone', 'A wine glass', 'A handbag', 'A flower'], answer: 'A wine glass' }
    ],
    3: [
      { prompt: 'What is the woman doing?', options: ['Playing tennis', 'Drawing', 'Shooting a bow', 'Riding a horse'], answer: 'Shooting a bow' },
      { prompt: 'What color is the woman’s top?', options: ['Blue', 'Red', 'Yellow', 'Green'], answer: 'Blue' }
    ],
    4: [
      { prompt: 'What color is the man’s shirt?', options: ['Blue', 'Black', 'White', 'Green'], answer: 'Blue' },
      { prompt: 'What color is the center woman’s top?', options: ['Pink', 'Purple', 'Yellow', 'White'], answer: 'Pink' }
    ]
  };

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
      `Image ${index + 1} / ${images.length} — look carefully; questions follow`;

    currentImgEl.onload = () => {
      const rect = currentImgEl.getBoundingClientRect();
      currentImgDocRect = {
        left: rect.left + window.scrollX,
        top: rect.top + window.scrollY,
        width: rect.width,
        height: rect.height
      };
    };

    setTimeout(() => showQuestions(index), POSTER_DURATION_MS);
  }

  function showQuestions(index) {
    // Stop attributing gaze samples to the poster while the participant answers.
    currentImgDocRect = null;
    const questions = QUESTIONS[images[index].id] || [];
    const container = document.getElementById('posterContainer');
    container.innerHTML = '';

    const card = document.createElement('div');
    card.className = 'gaze-question-card';

    const title = document.createElement('h2');
    title.textContent = `Quick recall — Image ${index + 1}`;
    card.appendChild(title);

    const hint = document.createElement('p');
    hint.className = 'gaze-question-hint';
    hint.textContent = 'Answer both questions, then continue.';
    card.appendChild(hint);

    const answers = [];
    questions.forEach((question, qIndex) => {
      const fieldset = document.createElement('fieldset');
      fieldset.className = 'gaze-question';
      const legend = document.createElement('legend');
      legend.textContent = `${qIndex + 1}. ${question.prompt}`;
      fieldset.appendChild(legend);

      question.options.forEach(option => {
        const label = document.createElement('label');
        label.className = 'gaze-option';
        const input = document.createElement('input');
        input.type = 'radio';
        input.name = `gaze-q-${index}-${qIndex}`;
        input.value = option;
        label.appendChild(input);
        label.appendChild(document.createTextNode(option));
        fieldset.appendChild(label);
      });
      card.appendChild(fieldset);
      answers.push(fieldset);
    });

    const continueButton = document.createElement('button');
    continueButton.type = 'button';
    continueButton.className = 'gaze-question-continue';
    continueButton.textContent = index + 1 < images.length ? 'Next image' : 'Finish gaze task';
    continueButton.disabled = true;
    card.appendChild(continueButton);

    function selectedValues() {
      return questions.map((_, qIndex) => {
        const selected = card.querySelector(`input[name="gaze-q-${index}-${qIndex}"]:checked`);
        return selected ? selected.value : null;
      });
    }

    card.addEventListener('change', () => {
      continueButton.disabled = selectedValues().some(value => value === null);
    });

    continueButton.addEventListener('click', () => {
      const values = selectedValues();
      values.forEach((value, qIndex) => {
        const question = questions[qIndex];
        questionResults.push({
          imageId: images[index].id,
          questionIndex: qIndex + 1,
          selected: value,
          correct: value === question.answer
        });
      });
      if (index + 1 < images.length) showPoster(index + 1);
      else finish();
    });

    container.appendChild(card);
    document.getElementById('posterCounter').textContent =
      `Image ${index + 1} / ${images.length} — recall check`;
  }

  function finish() {
    currentImgDocRect = null;
    if (onCompleteCb) onCompleteCb();
  }

  function start(imageList, onComplete) {
    images = imageList;
    onCompleteCb = onComplete;
    questionResults = [];

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
