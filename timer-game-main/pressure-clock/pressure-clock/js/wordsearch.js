/* Drag-select word search game. */
(function (root) {
  'use strict';

  var GRID_SIZE = 12;
  var WORDS = ['PRESSURE', 'CLOCK', 'FOCUS', 'GLANCE', 'DEADLINE', 'NOTICE'];
  var DIRECTIONS = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];

  function createWordSearch(gridEl, wordListEl, callbacks) {
    callbacks = callbacks || {};
    var cells = [];
    var placedWords = [];
    var foundWords = {};
    var selecting = [];
    var start = null;
    var active = false;

    function randomLetter() { return String.fromCharCode(65 + Math.floor(Math.random() * 26)); }
    function key(row, col) { return row + ':' + col; }
    function cellAt(row, col) { return cells[row] && cells[row][col]; }
    function clearSelecting() { selecting.forEach(function (p) { cellAt(p.row, p.col).classList.remove('ws-cell--selecting'); }); selecting = []; }
    function pathBetween(a, b) {
      var dr = b.row - a.row, dc = b.col - a.col;
      if (!dr && !dc) return [{ row: a.row, col: a.col }];
      if (dr !== 0 && dc !== 0 && Math.abs(dr) !== Math.abs(dc)) return null;
      var rowStep = Math.sign(dr), colStep = Math.sign(dc), length = Math.max(Math.abs(dr), Math.abs(dc));
      var path = [];
      for (var i = 0; i <= length; i++) path.push({ row: a.row + i * rowStep, col: a.col + i * colStep });
      return path;
    }
    function samePath(a, b) { return a.length === b.length && a.every(function (p, i) { return p.row === b[i].row && p.col === b[i].col; }); }
    function showPath(path) { clearSelecting(); selecting = path; selecting.forEach(function (p) { cellAt(p.row, p.col).classList.add('ws-cell--selecting'); }); }
    function flash(className) {
      selecting.forEach(function (p) { cellAt(p.row, p.col).classList.add(className); });
      setTimeout(function () { if (className !== 'ws-cell--found') selecting.forEach(function (p) { cellAt(p.row, p.col).classList.remove(className); }); clearSelecting(); }, 300);
    }
    function closestCell(target) { return target && target.closest ? target.closest('.ws-cell') : null; }
    function pointCell(event) { return closestCell(document.elementFromPoint(event.clientX, event.clientY)); }
    function coords(cell) { return { row: Number(cell.dataset.row), col: Number(cell.dataset.col) }; }
    function selectedText(path) { return path.map(function (p) { return cellAt(p.row, p.col).textContent; }).join(''); }

    function buildPuzzle() {
      var board = Array.from({ length: GRID_SIZE }, function () { return Array(GRID_SIZE).fill(null); });
      placedWords = [];
      WORDS.slice().sort(function (a, b) { return b.length - a.length; }).forEach(function (word) {
        var placed = false;
        for (var attempt = 0; attempt < 200 && !placed; attempt++) {
          var direction = DIRECTIONS[Math.floor(Math.random() * DIRECTIONS.length)];
          var dc = direction[0], dr = direction[1];
          var minRow = dr < 0 ? word.length - 1 : 0, maxRow = dr > 0 ? GRID_SIZE - word.length : GRID_SIZE - 1;
          var minCol = dc < 0 ? word.length - 1 : 0, maxCol = dc > 0 ? GRID_SIZE - word.length : GRID_SIZE - 1;
          var row = minRow + Math.floor(Math.random() * (maxRow - minRow + 1));
          var col = minCol + Math.floor(Math.random() * (maxCol - minCol + 1));
          var path = word.split('').map(function (_, i) { return { row: row + i * dr, col: col + i * dc }; });
          if (path.every(function (p, i) { return board[p.row][p.col] === null || board[p.row][p.col] === word[i]; })) {
            path.forEach(function (p, i) { board[p.row][p.col] = word[i]; });
            placedWords.push({ word: word, cells: path });
            placed = true;
          }
        }
        if (!placed) console.warn('Word-search placement failed for ' + word);
      });
      board.forEach(function (row) { row.forEach(function (letter, col) { if (!letter) row[col] = randomLetter(); }); });
      return board;
    }

    function render() {
      var board = buildPuzzle();
      foundWords = {}; cells = [];
      gridEl.innerHTML = ''; wordListEl.innerHTML = '';
      board.forEach(function (row, r) {
        cells[r] = [];
        row.forEach(function (letter, c) {
          var cell = document.createElement('div');
          cell.className = 'ws-cell'; cell.dataset.row = r; cell.dataset.col = c; cell.textContent = letter;
          gridEl.appendChild(cell); cells[r][c] = cell;
        });
      });
      WORDS.forEach(function (word) {
        var li = document.createElement('li'); li.dataset.word = word; li.textContent = word;
        if (!placedWords.some(function (item) { return item.word === word; })) li.classList.add('ws-word--found');
        wordListEl.appendChild(li);
      });
    }

    function finalize() {
      if (!start) return;
      var path = selecting.slice(); start = null;
      if (path.length < 2) { clearSelecting(); return; }
      var text = selectedText(path);
      var match = placedWords.filter(function (item) {
        return !foundWords[item.word] && (text === item.word || text === item.word.split('').reverse().join('')) &&
          (samePath(path, item.cells) || samePath(path, item.cells.slice().reverse()));
      })[0];
      if (match) {
        foundWords[match.word] = true;
        match.cells.forEach(function (p) { cellAt(p.row, p.col).classList.add('ws-cell--found'); });
        var wordEl = wordListEl.querySelector('[data-word="' + match.word + '"]'); if (wordEl) wordEl.classList.add('ws-word--found');
        if (callbacks.onAttempt) callbacks.onAttempt({ correct: true, word: match.word, selectedString: text, at: performance.now() });
        flash('ws-cell--found');
      } else {
        if (callbacks.onAttempt) callbacks.onAttempt({ correct: false, word: null, selectedString: text, at: performance.now() });
        flash('ws-cell--wrong');
      }
    }

    function onDown(event) { if (!active) return; var cell = closestCell(event.target); if (!cell) return; start = coords(cell); showPath([start]); gridEl.setPointerCapture(event.pointerId); }
    function onMove(event) { if (!active || !start) return; var cell = pointCell(event); if (!cell) return; var path = pathBetween(start, coords(cell)); if (path) showPath(path); }
    function onUp(event) { if (!active || !start) return; var cell = pointCell(event); if (cell) { var path = pathBetween(start, coords(cell)); if (path) showPath(path); } finalize(); }
    gridEl.addEventListener('pointerdown', onDown); gridEl.addEventListener('pointermove', onMove); gridEl.addEventListener('pointerup', onUp); gridEl.addEventListener('pointercancel', onUp);

    return {
      startRound: function () { render(); active = true; },
      stopRound: function () { active = false; start = null; clearSelecting(); },
      destroy: function () { this.stopRound(); gridEl.removeEventListener('pointerdown', onDown); gridEl.removeEventListener('pointermove', onMove); gridEl.removeEventListener('pointerup', onUp); gridEl.removeEventListener('pointercancel', onUp); },
      getPlacedWords: function () { return placedWords.slice(); }
    };
  }
  root.PressureClockWordSearch = { createWordSearch: createWordSearch };
})(typeof window !== 'undefined' ? window : globalThis);
