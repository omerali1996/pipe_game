// game.js — Tam, çalışır sürüm
// Pipe types
const PIPE_TYPES = {
  STRAIGHT_V: 'straight_v',
  STRAIGHT_H: 'straight_h',
  CORNER_TR: 'corner_tr',
  CORNER_TL: 'corner_tl',
  CORNER_BR: 'corner_br',
  CORNER_BL: 'corner_bl',
  START: 'start',
  TARGET: 'target',
  BLOCKED: 'blocked'
};

// Levels (aynı yapı)
const LEVELS = [
  { grid: 5, straights: 6, corners: 4, moves: 20, blocked: 0, name: 'Başlangıç' },
  { grid: 6, straights: 7, corners: 5, moves: 18, blocked: 2, name: 'Kolay' },
  { grid: 7, straights: 8, corners: 6, moves: 16, blocked: 4, name: 'Orta' },
  { grid: 7, straights: 9, corners: 7, moves: 14, blocked: 6, name: 'Zor' },
  { grid: 8, straights: 10, corners: 8, moves: 12, blocked: 8, name: 'Uzman' }
];

class PipeChaosGame {
  constructor() {
    this.level = 0;
    this.score = 0;
    this.totalStars = 0;
    this.gridSize = 5;
    this.cells = []; // 2D array of cell objects
    this.availablePipeElements = []; // available pipe DOM objects
    this.selectedPipe = null; // the DOM element of selected available pipe
    this.flowActive = false;
    this.flowPath = [];
    this.flowProgress = 0;

    // DOM elements
    this.gameGrid = document.getElementById('gameGrid');
    this.availablePipes = document.getElementById('availablePipes');
    this.levelValue = document.getElementById('levelValue');
    this.levelName = document.getElementById('levelName');
    this.scoreValue = document.getElementById('scoreValue');
    this.movesValue = document.getElementById('movesValue');
    this.infoLabel = document.getElementById('infoLabel');

    // modals
    this.hintModal = document.getElementById('hintModal');
    this.closeHintBtn = document.getElementById('closeHint');

    this.initEventListeners();
    this.initLevel();
    this.flowTimer = null;
  }

  initEventListeners() {
    document.getElementById('startBtn').addEventListener('click', () => this.startFlow());
    document.getElementById('hintBtn').addEventListener('click', () => this.showHint());
    document.getElementById('resetBtn').addEventListener('click', () => this.initLevel());
    if (this.closeHintBtn) this.closeHintBtn.addEventListener('click', () => this.closeHint());

    // keyboard rotate with R when a cell is focused (optional)
    window.addEventListener('keydown', (e) => {
      if (e.key.toLowerCase() === 'r' && document.activeElement && document.activeElement.classList.contains('cell')) {
        const el = document.activeElement;
        const r = parseInt(el.dataset.r, 10);
        const c = parseInt(el.dataset.c, 10);
        this.rotateCellAt(r, c);
      }
    });
  }

  initLevel() {
    // stop any running flow
    this.stopFlow();

    if (this.level >= LEVELS.length) {
      // game complete
      this.level = 0;
      this.score = 0;
      this.totalStars = 0;
    }

    const cfg = LEVELS[this.level];
    this.gridSize = cfg.grid;
    this.movesLeft = cfg.moves;

    // update UI
    this.levelValue.textContent = this.level + 1;
    this.levelName.textContent = cfg.name;
    this.scoreValue.textContent = this.score;
    this.movesValue.textContent = this.movesLeft;
    this.movesValue.classList.remove('low');

    // build grid
    this.gameGrid.innerHTML = '';
    this.gameGrid.style.gridTemplateColumns = `repeat(${this.gridSize}, 64px)`;
    this.gameGrid.style.gridTemplateRows = `repeat(${this.gridSize}, 64px)`;
    this.cells = [];

    // blocked random positions
    const blockedPositions = new Set();
    for (let i = 0; i < cfg.blocked; i++) {
      let pos;
      do {
        const r = Math.floor(Math.random() * this.gridSize);
        const c = Math.floor(Math.random() * this.gridSize);
        pos = `${r},${c}`;
      } while (pos === '0,0' || pos === `${this.gridSize - 1},${this.gridSize - 1}` || blockedPositions.has(pos));
      blockedPositions.add(pos);
    }

    for (let r = 0; r < this.gridSize; r++) {
      const row = [];
      for (let c = 0; c < this.gridSize; c++) {
        const el = document.createElement('div');
        el.className = 'cell';
        el.tabIndex = 0; // make focusable
        el.dataset.r = r;
        el.dataset.c = c;

        // canvas to draw pipe/graphics
        const canvas = document.createElement('canvas');
        canvas.className = 'piece';
        canvas.width = 64;
        canvas.height = 64;
        el.appendChild(canvas);

        // cell object
        const cell = {
          row: r,
          col: c,
          placed: false,
          type: null,
          fixed: false,
          blocked: false,
          rotation: 0,
          el,
          canvas
        };

        // special start/target/blocked
        if (r === 0 && c === 0) {
          cell.placed = true;
          cell.type = PIPE_TYPES.START;
          cell.fixed = true;
          el.classList.add('fixed');
        } else if (r === this.gridSize - 1 && c === this.gridSize - 1) {
          cell.placed = true;
          cell.type = PIPE_TYPES.TARGET;
          cell.fixed = true;
          el.classList.add('fixed');
        } else if (blockedPositions.has(`${r},${c}`)) {
          cell.blocked = true;
          cell.fixed = true;
          el.classList.add('blocked');
          cell.type = PIPE_TYPES.BLOCKED;
        }

        // events
        el.addEventListener('click', (ev) => this.onCellClick(ev, r, c));
        el.addEventListener('dblclick', (ev) => this.onCellDoubleClick(ev, r, c));

        this.gameGrid.appendChild(el);
        row.push(cell);
        this.drawCell(cell);
      }
      this.cells.push(row);
    }

    // generate available pipes
    this.availablePipes.innerHTML = '';
    this.availablePipeElements = [];

    for (let i = 0; i < cfg.straights; i++) {
      const type = Math.random() > 0.5 ? PIPE_TYPES.STRAIGHT_V : PIPE_TYPES.STRAIGHT_H;
      this.addAvailablePipe(type);
    }
    for (let i = 0; i < cfg.corners; i++) {
      const arr = [PIPE_TYPES.CORNER_TR, PIPE_TYPES.CORNER_TL, PIPE_TYPES.CORNER_BR, PIPE_TYPES.CORNER_BL];
      const type = arr[Math.floor(Math.random() * arr.length)];
      this.addAvailablePipe(type);
    }

    this.selectedPipe = null;
    this.flowActive = false;
    this.flowPath = [];
    this.flowProgress = 0;
  }

  addAvailablePipe(type) {
    const btn = document.createElement('div');
    btn.className = 'pipe-btn';
    btn.dataset.type = type;
    btn.tabIndex = 0;

    // canvas on button to show shape
    const canvas = document.createElement('canvas');
    canvas.width = 70;
    canvas.height = 70;
    canvas.style.width = '70px';
    canvas.style.height = '70px';
    btn.appendChild(canvas);

    // initial draw
    this.drawPipeOnCanvas(canvas.getContext('2d'), type, 70, 70, 0);

    // click / dblclick
    btn.addEventListener('click', (ev) => this.onAvailableClick(ev, btn));
    btn.addEventListener('dblclick', (ev) => {
      ev.stopPropagation();
      // rotate type in place (cycle)
      const newType = this.rotateAvailableType(btn.dataset.type);
      btn.dataset.type = newType;
      this.drawPipeOnCanvas(canvas.getContext('2d'), newType, 70, 70, 0);
    });

    this.availablePipes.appendChild(btn);
    this.availablePipeElements.push(btn);
  }

  onAvailableClick(ev, btn) {
    ev.stopPropagation();
    if (this.flowActive) return;

    // deselect previous
    if (this.selectedPipe && this.selectedPipe !== btn) {
      this.selectedPipe.classList.remove('selected');
    }

    if (this.selectedPipe === btn) {
      // toggle off
      btn.classList.remove('selected');
      this.selectedPipe = null;
      this.infoLabel.innerHTML = 'Boruları yerleştir<br><small>Çift tık = Döndür</small>';
    } else {
      btn.classList.add('selected');
      this.selectedPipe = btn;
      this.infoLabel.innerHTML = 'Boruyu yerleştir veya çift tıkla döndür';
    }
  }

  rotateAvailableType(type) {
    const map = {
      [PIPE_TYPES.STRAIGHT_V]: PIPE_TYPES.STRAIGHT_H,
      [PIPE_TYPES.STRAIGHT_H]: PIPE_TYPES.STRAIGHT_V,
      [PIPE_TYPES.CORNER_TR]: PIPE_TYPES.CORNER_BR,
      [PIPE_TYPES.CORNER_BR]: PIPE_TYPES.CORNER_BL,
      [PIPE_TYPES.CORNER_BL]: PIPE_TYPES.CORNER_TL,
      [PIPE_TYPES.CORNER_TL]: PIPE_TYPES.CORNER_TR
    };
    return map[type] || type;
  }

  onCellClick(ev, r, c) {
    const cell = this.cells[r][c];
    if (this.flowActive || cell.fixed || cell.blocked) return;

    // if placed and not start/target => remove (return to available)
    if (cell.placed && cell.type !== PIPE_TYPES.START && cell.type !== PIPE_TYPES.TARGET) {
      const oldType = cell.type;
      cell.placed = false;
      cell.type = null;
      cell.rotation = 0;
      cell.el.classList.remove('placed');
      this.drawCell(cell);
      // return pipe to available
      this.addAvailablePipe(oldType);
      this.movesLeft++;
      this.movesValue.textContent = this.movesLeft;
      return;
    }

    // place selected pipe
    if (this.selectedPipe && !cell.placed) {
      const type = this.selectedPipe.dataset.type;
      cell.placed = true;
      cell.type = type;
      cell.rotation = 0;
      cell.el.classList.add('placed');
      this.drawCell(cell);

      // remove selected element from available
      this.availablePipes.removeChild(this.selectedPipe);
      const idx = this.availablePipeElements.indexOf(this.selectedPipe);
      if (idx > -1) this.availablePipeElements.splice(idx, 1);
      this.selectedPipe = null;
      this.infoLabel.innerHTML = 'Boruları yerleştir<br><small>Çift tık = Döndür</small>';

      this.movesLeft--;
      this.movesValue.textContent = this.movesLeft;
      if (this.movesLeft < 5) this.movesValue.classList.add('low');
    }
  }

  onCellDoubleClick(ev, r, c) {
    const cell = this.cells[r][c];
    if (this.flowActive || cell.fixed || cell.blocked) return;

    if (cell.placed && cell.type !== PIPE_TYPES.START && cell.type !== PIPE_TYPES.TARGET) {
      // rotate pipe type (for simplicity we change type in cycle)
      cell.type = this.rotateAvailableType(cell.type);
      // rotation value isn't necessary for our path logic (the type encodes orientation by itself)
      this.drawCell(cell);
    }
  }

  rotateCellAt(r, c) {
    const cell = this.cells[r][c];
    if (!cell || !cell.placed || cell.fixed || cell.blocked) return;
    cell.type = this.rotateAvailableType(cell.type);
    this.drawCell(cell);
  }

  draw
